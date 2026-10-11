#!/usr/bin/env python3
"""Foulée local web server with durable SQLite state and LAN access code."""
from __future__ import annotations

import json
import os
import secrets
import shutil
import sqlite3
import ssl
import time
import threading
import llm_local
from datetime import datetime
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent
DATA_DIR = Path.home() / "Library" / "Application Support" / "Foulee"
DB_PATH = DATA_DIR / "foulee.sqlite3"
BACKUP_DIR = DATA_DIR / "backups"
CODE_PATH = DATA_DIR / "access-code.txt"
PORT = int(os.environ.get("FOULEE_PORT", "8765"))
TOKEN_TTL = 12 * 60 * 60
TOKENS: dict[str, float] = {}
LOGIN_FAILURES: dict[str, tuple[int, float]] = {}
PUBLIC_FILES = {
    "/", "/index.html", "/app-v2.js", "/exercise-module.js", "/styles.css",
    "/manifest.webmanifest", "/sw.js", "/pwa.js", "/offline.html",
    "/icons/icon-192.png", "/icons/icon-512.png", "/icons/maskable-512.png",
    "/icons/apple-touch-icon.png", "/icons/favicon.png", "/icons/shoe-f.svg",
}


def ensure_data_dir() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True, mode=0o700)
    os.chmod(DATA_DIR, 0o700)
    BACKUP_DIR.mkdir(parents=True, exist_ok=True, mode=0o700)
    if not CODE_PATH.exists():
        fd = os.open(CODE_PATH, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            handle.write(secrets.token_urlsafe(9) + "\n")
    os.chmod(CODE_PATH, 0o600)
    with sqlite3.connect(DB_PATH) as db:
        db.execute("PRAGMA journal_mode=WAL")
        db.execute("CREATE TABLE IF NOT EXISTS state (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL)")


def create_daily_backup() -> None:
    if not DB_PATH.exists():
        return
    stamp = datetime.now().strftime("%Y-%m-%d")
    backup = BACKUP_DIR / f"foulee-{stamp}.sqlite3"
    if not backup.exists():
        with sqlite3.connect(DB_PATH) as source, sqlite3.connect(backup) as target:
            source.backup(target)
        os.chmod(backup, 0o600)
    backups = sorted(BACKUP_DIR.glob("foulee-*.sqlite3"))
    for expired in backups[:-30]:
        expired.unlink(missing_ok=True)


class Handler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map,
                      ".webmanifest": "application/manifest+json"}

    def end_headers(self):
        # Revalidate the app and worker so installed clients receive updates.
        if urlparse(self.path).path in PUBLIC_FILES:
            self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, fmt, *args):
        # Avoid logging access codes, request bodies, or profile data.
        super().log_message(fmt, *args)

    def send_json(self, status: int, payload: dict) -> None:
        encoded = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(encoded)

    def read_json(self):
        length = int(self.headers.get("Content-Length", "0"))
        if length < 0:
            raise ValueError("Longueur de requête invalide")
        raw = self.rfile.read(length)
        return json.loads(raw.decode("utf-8")) if raw else {}

    def authorized(self) -> bool:
        header = self.headers.get("Authorization", "")
        token = header.removeprefix("Bearer ")
        expiry = TOKENS.get(token, 0)
        if expiry < time.time():
            TOKENS.pop(token, None)
            return False
        TOKENS[token] = time.time() + TOKEN_TTL
        return True

    def do_OPTIONS(self):
        self.send_json(403, {"error": "Requête inter-origine refusée"})

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/api/health":
            self.send_json(200, {"ok": True})
        elif path == "/api/state":
            if not self.authorized():
                return self.send_json(401, {"error": "Accès non autorisé"})
            with sqlite3.connect(DB_PATH) as db:
                items = dict(db.execute("SELECT key, value FROM state"))
            self.send_json(200, {"items": items})
        elif path == "/api/llm/models":
            if not self.authorized():
                return self.send_json(401, {"error": "Accès non autorisé"})
            try:
                return self.send_json(200, llm_local.models())
            except llm_local.LLMError as error:
                return self.send_json(error.status, {"error": str(error)})
        elif path.startswith("/api/"):
            self.send_json(404, {"error": "Route inconnue"})
        elif path not in PUBLIC_FILES:
            self.send_error(404)
        else:
            super().do_GET()

    def do_HEAD(self):
        if urlparse(self.path).path not in PUBLIC_FILES:
            return self.send_error(404)
        super().do_HEAD()

    def do_POST(self):
        path = urlparse(self.path).path
        if path == "/api/llm/analyze":
            if not self.authorized():
                return self.send_json(401, {"error": "Accès non autorisé"})
            try:
                length = int(self.headers.get("Content-Length", "0"))
                if not 0 < length <= llm_local.MAX_BYTES:
                    return self.send_json(413, {"error": "Contexte LLM trop volumineux ou vide"})
                data = self.read_json()
                return self.send_json(200, llm_local.analyze(data))
            except llm_local.LLMError as error:
                return self.send_json(error.status, {"error": str(error)})
            except (ValueError, UnicodeDecodeError):
                return self.send_json(400, {"error": "JSON invalide"})
        try:
            data = self.read_json()
        except (ValueError, UnicodeDecodeError, json.JSONDecodeError) as error:
            return self.send_json(400, {"error": str(error)})
        if path == "/api/login":
            peer = self.client_address[0]
            failures, since = LOGIN_FAILURES.get(peer, (0, time.time()))
            if failures >= 8 and time.time() - since < 300:
                return self.send_json(429, {"error": "Trop d’essais. Réessaie dans quelques minutes."})
            try:
                expected = CODE_PATH.read_text(encoding="utf-8").strip()
            except OSError:
                return self.send_json(503, {"error": "Code d’accès indisponible"})
            if not secrets.compare_digest(str(data.get("code", "")), expected):
                LOGIN_FAILURES[peer] = (failures + 1 if time.time() - since < 300 else 1, since if time.time() - since < 300 else time.time())
                return self.send_json(403, {"error": "Code incorrect"})
            LOGIN_FAILURES.pop(peer, None)
            token = secrets.token_urlsafe(32)
            TOKENS[token] = time.time() + TOKEN_TTL
            return self.send_json(200, {"token": token})
        if path == "/api/state":
            if not self.authorized():
                return self.send_json(401, {"error": "Accès non autorisé"})
            items = data.get("items")
            if not isinstance(items, dict) or len(items) > 500:
                return self.send_json(400, {"error": "État invalide"})
            now = datetime.now().isoformat(timespec="seconds")
            clean = [(k, v, now) for k, v in items.items() if isinstance(k, str) and k.startswith("foulee.") and k != "foulee.active-athlete.v1" and isinstance(v, str)]
            create_daily_backup()
            with sqlite3.connect(DB_PATH) as db:
                db.executemany("INSERT OR IGNORE INTO state(key,value,updated_at) VALUES(?,?,?)", clean)
            return self.send_json(200, {"saved": len(clean)})
        self.send_json(404, {"error": "Route inconnue"})

    def do_PUT(self):
        if urlparse(self.path).path != "/api/state":
            return self.send_json(404, {"error": "Route inconnue"})
        if not self.authorized():
            return self.send_json(401, {"error": "Accès non autorisé"})
        try:
            data = self.read_json()
        except (ValueError, UnicodeDecodeError, json.JSONDecodeError) as error:
            return self.send_json(400, {"error": str(error)})
        key, value = data.get("key"), data.get("value")
        if not isinstance(key, str) or not key.startswith("foulee.") or key == "foulee.active-athlete.v1" or not isinstance(value, str):
            return self.send_json(400, {"error": "Clé ou valeur invalide"})
        create_daily_backup()
        with sqlite3.connect(DB_PATH) as db:
            db.execute("INSERT INTO state(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at", (key, value, datetime.now().isoformat(timespec="seconds")))
        self.send_json(200, {"saved": True})


if __name__ == "__main__":
    ensure_data_dir()
    if "--init-only" in os.sys.argv:
        raise SystemExit(0)
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    tls_dir = ROOT / ".https"
    cert = Path(os.environ.get("FOULEE_TLS_CERT", str(tls_dir / "server.crt")))
    key = Path(os.environ.get("FOULEE_TLS_KEY", str(tls_dir / "server.key")))
    https_server = None
    if cert.exists() or key.exists():
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        context.minimum_version = ssl.TLSVersion.TLSv1_2
        context.load_cert_chain(cert, key)
        https_port = int(os.environ.get("FOULEE_HTTPS_PORT", str(PORT + 1)))
        https_server = ThreadingHTTPServer(("0.0.0.0", https_port), Handler)
        https_server.socket = context.wrap_socket(https_server.socket, server_side=True)
        threading.Thread(target=https_server.serve_forever, daemon=True).start()
        print(f"Foulée HTTPS disponible sur https://localhost:{https_port}/")
    print(f"Foulée disponible sur http://localhost:{PORT}/")
    print(f"Code d’accès : {CODE_PATH}")
    print(f"Données et sauvegardes : {DATA_DIR}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        if https_server:
            https_server.shutdown()
            https_server.server_close()

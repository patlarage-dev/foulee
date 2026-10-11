#!/usr/bin/env python3
"""Install, remove, or inspect Foulée's per-user macOS LaunchAgent."""
import os
import plistlib
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
LABEL = "com.foulee.localserver"
PLIST = Path.home() / "Library" / "LaunchAgents" / f"{LABEL}.plist"
DATA = Path.home() / "Library" / "Application Support" / "Foulee"
DOMAIN = f"gui/{os.getuid()}"


def launchctl(*args):
    return subprocess.run(["launchctl", *args], text=True, capture_output=True)


def install():
    DATA.mkdir(parents=True, exist_ok=True, mode=0o700)
    subprocess.run([sys.executable, str(ROOT / "serve_local.py"), "--init-only"], check=True)
    PLIST.parent.mkdir(parents=True, exist_ok=True)
    config = {
        "Label": LABEL,
        "ProgramArguments": [sys.executable, str(ROOT / "serve_local.py")],
        "WorkingDirectory": str(ROOT),
        "RunAtLoad": True,
        "KeepAlive": True,
        "StandardOutPath": str(DATA / "server.log"),
        "StandardErrorPath": str(DATA / "server-error.log"),
    }
    llm_env = {name: os.environ[name] for name in ("FOULEE_LLM_PROVIDER", "FOULEE_LLM_URL", "FOULEE_LLM_MODEL", "FOULEE_LLM_API_KEY") if name in os.environ}
    if PLIST.exists():
        try:
            previous = plistlib.loads(PLIST.read_bytes()).get("EnvironmentVariables", {})
            llm_env = {**{k: v for k, v in previous.items() if k.startswith("FOULEE_LLM_")}, **llm_env}
        except (OSError, ValueError, plistlib.InvalidFileException):
            pass
    if llm_env:
        config["EnvironmentVariables"] = llm_env
    with PLIST.open("wb") as handle:
        plistlib.dump(config, handle)
    os.chmod(PLIST, 0o600)
    # A loaded prior revision must be removed before replacing its definition.
    launchctl("bootout", f"{DOMAIN}/{LABEL}")
    result = launchctl("bootstrap", DOMAIN, str(PLIST))
    if result.returncode:
        raise SystemExit(result.stderr.strip() or "Impossible de démarrer le service Foulée.")
    launchctl("kickstart", "-k", f"{DOMAIN}/{LABEL}")
    print(f"Démarrage automatique installé : {PLIST}")
    print(f"Code d’accès : {DATA / 'access-code.txt'}")
    print(f"Base et sauvegardes : {DATA}")


def uninstall():
    launchctl("bootout", f"{DOMAIN}/{LABEL}")
    PLIST.unlink(missing_ok=True)
    print("Démarrage automatique désactivé. Les données et sauvegardes sont conservées.")


def status():
    result = launchctl("print", f"{DOMAIN}/{LABEL}")
    print("installé" if result.returncode == 0 else "non installé")
    if result.returncode == 0:
        print(result.stdout[:2000])
    print(f"Fichier code : {DATA / 'access-code.txt'}")
    print(f"Données : {DATA}")


if __name__ == "__main__":
    if len(sys.argv) != 2 or sys.argv[1] not in {"install", "uninstall", "status"}:
        raise SystemExit("Usage: manage_foulee_service.py install|uninstall|status")
    {"install": install, "uninstall": uninstall, "status": status}[sys.argv[1]]()

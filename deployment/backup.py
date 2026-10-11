"""Emit a consistent SQLite backup to stdout; redirect it to a private file."""
from pathlib import Path
import sqlite3, sys, tempfile
source = Path.home() / "Library/Application Support/Foulee/foulee.sqlite3"
if not source.is_file():
    raise SystemExit("Base absente")
with tempfile.TemporaryDirectory() as folder:
    target = Path(folder) / "snapshot.sqlite3"
    with sqlite3.connect(f"file:{source}?mode=ro", uri=True) as db, sqlite3.connect(target) as copy:
        db.backup(copy)
        if copy.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
            raise SystemExit("Sauvegarde invalide")
    sys.stdout.buffer.write(target.read_bytes())

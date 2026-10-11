#!/usr/bin/env python3
"""Package a frozen release locally; never contacts the server."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
FILES = ['index.html', 'app-v2.js', 'exercise-module.js', 'styles.css',
         'manifest.webmanifest', 'sw.js', 'pwa.js', 'offline.html',
         'serve_local.py', 'llm_local.py']
p = argparse.ArgumentParser(description=__doc__)
p.add_argument('version')
p.add_argument('--output', type=Path, default=ROOT / 'dist')
a = p.parse_args()
if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.-]{0,100}', a.version):
    p.error('Identifiant de version invalide')
a.output.mkdir(parents=True, exist_ok=True)
archive = a.output / f'foulee-{a.version}.tar.gz'
if archive.exists():
    p.error('Archive existante : choisir une nouvelle version')
with tempfile.TemporaryDirectory() as tmp:
    release = Path(tmp) / a.version
    app = release / 'app'
    app.mkdir(parents=True)
    for name in FILES:
        shutil.copy2(ROOT / name, app / name)
    shutil.copytree(ROOT / 'icons', app / 'icons')
    for name in ['Dockerfile', 'compose.yaml', 'compose.local.yaml', 'backup.py', '.dockerignore', 'deployer.sh', 'rollback.sh', 'DEPLOIEMENT.md']:
        shutil.copy2(ROOT / 'deployment' / name, release / name)
    (release / '.env').write_text(f'FOULEE_RELEASE={a.version}\n')
    hashes = {str(f.relative_to(app)): hashlib.sha256(f.read_bytes()).hexdigest()
              for f in sorted(app.rglob('*')) if f.is_file()}
    (release / 'source-sha256.json').write_text(json.dumps(hashes, indent=2) + '\n')
    git = subprocess.run(['git', 'rev-parse', 'HEAD'], cwd=ROOT, capture_output=True, text=True)
    dirty = subprocess.run(['git', 'status', '--porcelain'], cwd=ROOT, capture_output=True, text=True)
    (release / 'release.json').write_text(json.dumps({'version': a.version,
        'commit': git.stdout.strip() if git.returncode == 0 else None,
        'workingTreeDirty': bool(dirty.stdout.strip())}, indent=2) + '\n')
    shutil.make_archive(str(archive)[:-7], 'gztar', tmp, a.version)
print(archive)
print('SHA256:', hashlib.sha256(archive.read_bytes()).hexdigest())

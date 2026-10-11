#!/usr/bin/env bash
# Run on Debian only after the exact release has been approved.
set -euo pipefail
[[ "${1:-}" == "--apply" ]] || { echo 'Usage: bash deployer.sh --apply (après validation de cette version)'; exit 2; }
cd "$(dirname "$0")"
[[ -f .env ]] || { echo '.env de version absent'; exit 1; }
release=$(sed -n 's/^FOULEE_RELEASE=//p' .env)
[[ "$release" =~ ^[A-Za-z0-9][A-Za-z0-9_.-]{0,100}$ ]] || exit 1
sudo -v
sudo docker compose config --quiet
# Never overwrite a previously built release tag.
if sudo docker image inspect "foulee:$release" >/dev/null 2>&1; then
    echo 'Image déjà présente : choisir un identifiant de version neuf'; exit 1
fi
python3 - <<'PY'
import hashlib,json
from pathlib import Path
for name, expected in json.loads(Path('source-sha256.json').read_text()).items():
    assert hashlib.sha256((Path('app')/name).read_bytes()).hexdigest()==expected, name
PY
active=$(sudo docker inspect foulee-foulee-1 --format '{{.Config.Image}}')
sudo docker compose build
umask 077
backup_dir="$HOME/foulee/sauvegardes"
mkdir -p "$backup_dir"
chmod 700 "$backup_dir"
stamp=$(date +%Y%m%d-%H%M%S)
backup="$backup_dir/foulee-$stamp.sqlite3"
sudo docker exec foulee-foulee-1 python /opt/backup.py > "$backup.partial"
python3 - "$backup.partial" <<'PY'
import sqlite3,sys
with sqlite3.connect('file:'+sys.argv[1]+'?mode=ro',uri=True) as db:
    assert db.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
PY
mv "$backup.partial" "$backup"
printf '%s\n' "$active" > "$backup.previous-image.txt"
echo "Sauvegarde : $backup ; ancienne image : $active"
# Separate approval stage: copy the backup off-server before replacing the container.
echo 'Copier cette sauvegarde et le code privé hors serveur, puis lancer :'
echo 'sudo docker compose up -d --no-build --wait --wait-timeout 120'
echo 'Aucun conteneur remplacé par ce script.'

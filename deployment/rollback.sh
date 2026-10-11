#!/usr/bin/env bash
set -euo pipefail
[[ "${1:-}" == "--apply" ]] || { echo 'Usage: bash rollback.sh --apply (depuis la release précédente validée)'; exit 2; }
cd "$(dirname "$0")"
[[ -f .env ]] || { echo 'Créer le .env avec le tag exact de cette ancienne release'; exit 1; }
sudo -v
sudo docker compose config --quiet
release=$(sed -n 's/^FOULEE_RELEASE=//p' .env)
[[ "$release" =~ ^[A-Za-z0-9][A-Za-z0-9_.-]{0,100}$ ]] || exit 1
sudo docker image inspect "foulee:$release" >/dev/null
sudo docker compose up -d --no-build --pull never --wait --wait-timeout 120
curl --fail --silent --show-error http://127.0.0.1:8765/api/health
# Data restoration is deliberately a separate, explicitly approved operation.

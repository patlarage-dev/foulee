#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
"${NODE_BIN:-node}" --test tests/*.test.cjs
PYTHONDONTWRITEBYTECODE=1 "${PYTHON_BIN:-python3}" -m unittest discover -s tests -p 'test_*.py'

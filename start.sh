#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"

if [ ! -d "$ROOT/backend/.venv" ]; then
  python3 -m venv "$ROOT/backend/.venv"
fi
# shellcheck disable=SC1091
source "$ROOT/backend/.venv/bin/activate"
pip install -q -r "$ROOT/backend/requirements.txt"

(cd "$ROOT/frontend" && npm install)

trap 'kill 0' EXIT
(cd "$ROOT/backend" && "$ROOT/backend/.venv/bin/uvicorn" app.main:app --host 127.0.0.1 --port 8000) &
(cd "$ROOT/frontend" && npm run dev) &
wait

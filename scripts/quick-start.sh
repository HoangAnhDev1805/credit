#!/usr/bin/env bash

# Quick Start Script for CreditV2
# - Kills ports 3000 (frontend) và 5000 (backend) nếu đang dùng
# - Cài phụ thuộc nếu thiếu
# - Khởi động backend (port 5000) và frontend (port 3000)
# - Kiểm tra health trước khi báo sẵn sàng

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
BACKEND_PORT="5000"
FRONTEND_PORT="3000"

echo "[QuickStart] Repo root: $ROOT_DIR"

kill_port() {
  local port="$1"
  if command -v fuser >/dev/null 2>&1; then
    fuser -k "${port}/tcp" 2>/dev/null || true
  fi
}

health_check() {
  local url="$1"
  local name="$2"
  echo "[QuickStart] Waiting for $name at $url ..."
  for i in {1..30}; do
    if curl -sk --max-time 2 "$url" | grep -qi 'success'; then
      echo "[QuickStart] $name is up"
      return 0
    fi
    sleep 1
  done
  echo "[QuickStart] WARNING: $name not responding to health check (continuing)"
  return 1
}

echo "[QuickStart] Freeing ports $BACKEND_PORT and $FRONTEND_PORT if in use..."
kill_port "$BACKEND_PORT"
kill_port "$FRONTEND_PORT"

echo "[QuickStart] Starting backend..."
(
  cd "$BACKEND_DIR"
  if [ ! -d node_modules ]; then
    echo "[QuickStart] Installing backend dependencies..."
    npm ci || npm install
  fi
  export NODE_ENV=production
  export PORT="$BACKEND_PORT"
  nohup node src/server.js > "$ROOT_DIR/diagnostics/backend.out.log" 2>&1 &
  echo $! > "$ROOT_DIR/diagnostics/backend.pid"
)

health_check "https://checkcc.live/api/health" "Backend"

echo "[QuickStart] Starting frontend..."
(
  cd "$FRONTEND_DIR"
  if [ ! -d node_modules ]; then
    echo "[QuickStart] Installing frontend dependencies..."
    npm ci || npm install
  fi
  # Build if .next missing (production start), else just start
  if [ ! -d .next ]; then
    echo "[QuickStart] Building frontend..."
    npm run build
  fi
  nohup npm run start -- -p "$FRONTEND_PORT" -H 0.0.0.0 > "$ROOT_DIR/diagnostics/frontend.out.log" 2>&1 &
  echo $! > "$ROOT_DIR/diagnostics/frontend.pid"
)

echo "[QuickStart] Frontend running at https://checkcc.live"
echo "[QuickStart] Backend health: https://checkcc.live/api/health"
echo "[QuickStart] Logs: diagnostics/backend.out.log, diagnostics/frontend.out.log"

exit 0

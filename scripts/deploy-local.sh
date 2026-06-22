#!/usr/bin/env bash
set -euo pipefail

log() { echo "[$(date +%T)] $*"; }

log "=== repair-calc deploy ==="
log "Commit: $(git rev-parse --short HEAD 2>/dev/null || echo "unknown")"
log "Branch: $(git branch --show-current 2>/dev/null || echo "unknown")"

# 1. Проверка чистоты (нет незакоммиченных изменений)
if [ -n "$(git status --porcelain 2>/dev/null || true)" ]; then
  log "ERROR: Незакоммиченные изменения. Закоммить или stash перед деплоем."
  exit 1
fi

# 2. Lint + test (fast fail)
log "Running lint..."
npm run lint
log "Running tests..."
npm test

# 3. Единственная сборка — внутри Docker
log "Building Docker images..."
export COMMIT_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
docker compose build --no-cache

# 4. Поднять сервисы
log "Starting services..."
docker compose up -d

# 5. Проверка health
sleep 3
docker compose ps
log "=== Deploy complete ==="

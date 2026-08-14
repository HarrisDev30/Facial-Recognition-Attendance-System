#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Detect if running inside WSL
if grep -qi microsoft /proc/version 2>/dev/null; then
  echo "[WSL] Installing Node.js via nvm if needed..."
  if ! command -v node &>/dev/null; then
    export NVM_DIR="$HOME/.nvm"
    if [ ! -d "$NVM_DIR" ]; then
      curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
    fi
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    nvm install 20
  fi
fi

echo ""
echo "=== 1. Backend setup ==="
cd "$PROJECT_DIR/backend"

if [ ! -d "venv" ]; then
  python3 -m venv venv
fi

source venv/bin/activate
pip install --upgrade pip -q
pip install -r requirements.txt -q
echo "  Backend dependencies installed."

echo ""
echo "=== 2. Frontend setup ==="
cd "$PROJECT_DIR/frontend"
npm install --silent
echo "  Frontend dependencies installed."

echo ""
echo "=== 3. Environment file ==="
cd "$PROJECT_DIR"
if [ ! -f ".env" ]; then
  cp .env.example .env
  echo "  Created .env from .env.example — edit DATABASE_URL if needed."
else
  echo "  .env already exists, skipping."
fi

echo ""
echo "=== 4. Database migrations ==="
cd "$PROJECT_DIR/backend"
source venv/bin/activate
echo "  Running alembic upgrade head..."
echo "  (Make sure PostgreSQL is running and the database exists)"
echo "  If this fails, run: createdb attendance_system"
alembic upgrade head || echo "  [SKIP] Run migrations manually after setting up the DB."
cd "$PROJECT_DIR"

echo ""
echo "=== 5. Seed default accounts ==="
cd "$PROJECT_DIR/backend"
source venv/bin/activate
python -m app.seed 2>/dev/null && echo "  Default accounts seeded." || echo "  [SKIP] Seed manually after DB is ready."
cd "$PROJECT_DIR"

echo ""
echo "============================================"
echo "  Setup complete!"
echo "============================================"
echo ""
echo "  To run the app:"
echo ""
echo "  Terminal 1 — Backend:"
echo "    source backend/venv/bin/activate"
echo "    uvicorn backend.main:app --reload"
echo ""
echo "  Terminal 2 — Frontend:"
echo "    cd frontend && npm run dev"
echo ""
echo "  The face recognition model will auto-download on first backend start."
echo ""

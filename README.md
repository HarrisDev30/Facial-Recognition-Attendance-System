# Facial Recognition Attendance System

A portable facial-recognition-based attendance monitoring system for institutional events. Built with FastAPI (Python) and React (TypeScript).

## Prerequisites

- **Python** 3.11+
- **Node.js** 20+
- **PostgreSQL** 15+ (running locally)
- **npm** (comes with Node.js)

## Quick Start

Run the setup script to install everything:

```bash
chmod +x setup.sh
./setup.sh
```

Then create the database and start the app:

```bash
# Create the PostgreSQL database
createdb attendance_system

# Activate backend and run migrations
source backend/venv/bin/activate
cd backend && alembic upgrade head && cd ..

# Seed default accounts
cd backend && python -m app.seed && cd ..

# Start backend (terminal 1)
source backend/venv/bin/activate
uvicorn backend.main:app --reload

# Start frontend (terminal 2)
cd frontend && npm run dev
```

The app will be available at:
- **Frontend:** http://localhost:5173
- **API:** http://localhost:8000
- **Docs:** http://localhost:8000/docs

## Manual Setup

### 1. Clone and enter the project

```bash
git clone https://github.com/HarrisDev30/Facial-Recognition-Attendance-System.git
cd Facial-Recognition-Attendance-System
```

### 2. Set up environment variables

```bash
cp .env.example .env
# Edit .env with your PostgreSQL credentials if needed
```

### 3. Backend setup

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 4. Frontend setup

```bash
cd frontend
npm install
```

### 5. Database setup

```bash
# Make sure PostgreSQL is running, then:
createdb attendance_system

# Run migrations
cd backend
source venv/bin/activate
alembic upgrade head

# Seed default accounts
python -m app.seed
```

### 6. Run the application

**Terminal 1 — Backend:**
```bash
cd backend
source venv/bin/activate
uvicorn backend.main:app --reload
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```

> **Note:** On the first startup, the backend will automatically download the InsightFace face recognition model (~200MB). This may take a minute.

## Default Accounts

After seeding, the following accounts are available:

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@gmail.com | admin123! |
| Marshal | marshal@gmail.com | marshal123! |

Student accounts can be created via the registration page.

## Tech Stack

- **Backend:** FastAPI, SQLAlchemy (async), PostgreSQL, Alembic
- **Frontend:** React 18, TypeScript, Vite, Mantine UI, Zustand
- **Face Recognition:** InsightFace (buffalo_l), FAISS
- **Real-time:** WebSockets

## Project Structure

```
backend/
  app/
    api/         # Route handlers
    models/      # SQLAlchemy models
    schemas/     # Pydantic schemas
    services/    # Business logic (face recognition, FAISS, etc.)
    middleware/  # Auth middleware
    utils/       # Helpers (security, cooldown)
  migrations/    # Alembic database migrations
  models/        # Face recognition model files (auto-downloaded)

frontend/
  src/
    api/         # API client modules
    components/  # React components
    pages/       # Page components
    hooks/       # Custom React hooks
    store/       # Zustand state store
    theme/       # Mantine theme configuration
    types/       # TypeScript type definitions
    utils/       # Utility functions
```

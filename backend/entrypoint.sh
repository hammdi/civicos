#!/usr/bin/env bash
set -e

echo "[CivicOS] Waiting for PostgreSQL to be ready..."
python - <<'PY'
import os, time, sys
import psycopg2
url = os.environ.get("DATABASE_URL", "postgresql://civicos:civicos@postgres:5432/civicos")
# psycopg2 wants the plain postgresql:// scheme
url = url.replace("postgresql+psycopg2://", "postgresql://")
for attempt in range(60):
    try:
        conn = psycopg2.connect(url)
        conn.close()
        print("[CivicOS] PostgreSQL is ready.")
        sys.exit(0)
    except Exception as exc:  # noqa: BLE001
        print(f"[CivicOS]   ...not ready yet ({attempt+1}/60): {exc}")
        time.sleep(2)
print("[CivicOS] PostgreSQL never became ready, exiting.")
sys.exit(1)
PY

echo "[CivicOS] Creating tables and seeding database (idempotent)..."
python -m app.seeds.seed

echo "[CivicOS] Starting API server on :8000"
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers ${UVICORN_EXTRA_ARGS:-}

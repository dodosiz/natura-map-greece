import os
import sqlite3
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]


def db_path() -> Path:
    return Path(os.environ.get("NATURA_DB_PATH", REPO_ROOT / "data" / "natura.db"))


def cors_origins() -> list[str]:
    raw = os.environ.get("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
    return [o.strip() for o in raw.split(",") if o.strip()]


def get_db():
    """FastAPI dependency: one read-only connection per request."""
    path = db_path()
    if not path.exists():
        raise FileNotFoundError(f"{path} not found - run the ETL first")
    con = sqlite3.connect(f"file:{path.as_posix()}?mode=ro", uri=True, check_same_thread=False)
    con.row_factory = sqlite3.Row
    try:
        yield con
    finally:
        con.close()

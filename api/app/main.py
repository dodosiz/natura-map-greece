from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from . import db
from .routes import router

app = FastAPI(title="Natura 2000 Greece API", version="1.0.0",
              description="Read-only API over the database built by the ETL.")
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(CORSMiddleware, allow_origins=db.cors_origins(), allow_methods=["GET"], allow_headers=["*"])
app.include_router(router)

frontend_dir = Path(__file__).parent / "static"
if frontend_dir.is_dir():
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")


@app.exception_handler(FileNotFoundError)
async def db_missing(_: Request, exc: FileNotFoundError):
    return JSONResponse({"detail": str(exc)}, status_code=503)

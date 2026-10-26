from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse

from . import db
from .routes import router

app = FastAPI(title="Natura 2000 Greece API", version="1.0.0",
              description="Read-only API over the database built by the ETL.")
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(CORSMiddleware, allow_origins=db.cors_origins(), allow_methods=["GET"], allow_headers=["*"])
app.include_router(router)


@app.exception_handler(FileNotFoundError)
async def db_missing(_: Request, exc: FileNotFoundError):
    return JSONResponse({"detail": str(exc)}, status_code=503)

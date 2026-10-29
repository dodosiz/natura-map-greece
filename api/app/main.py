from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

from . import db
from .routes import router

app = FastAPI(title="Natura 2000 Greece API", version="1.0.0",
              description="Read-only API over the database built by the ETL.")
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(CORSMiddleware, allow_origins=db.cors_origins(), allow_methods=["GET"], allow_headers=["*"])
app.include_router(router)


@app.middleware("http")
async def redirect_www_to_apex(request: Request, call_next):
    if request.url.hostname == "www.natura-map.gr":
        canonical_url = request.url.replace(scheme="https", netloc="natura-map.gr")
        return RedirectResponse(str(canonical_url), status_code=301)
    return await call_next(request)


frontend_dir = Path(__file__).parent / "static"


@app.get("/privacy", include_in_schema=False)
@app.get("/imprint", include_in_schema=False)
async def serve_legal_page() -> FileResponse:
    index_file = frontend_dir / "index.html"
    if not index_file.is_file():
        raise HTTPException(status_code=404, detail="Frontend is not built")
    return FileResponse(index_file)


if frontend_dir.is_dir():
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")


@app.exception_handler(FileNotFoundError)
async def db_missing(_: Request, exc: FileNotFoundError):
    return JSONResponse({"detail": str(exc)}, status_code=503)

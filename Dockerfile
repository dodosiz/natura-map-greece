FROM node:22-alpine AS web-build

WORKDIR /src/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM python:3.12-slim

ENV NATURA_DB_PATH=/app/data/natura.db \
    PYTHONUNBUFFERED=1

WORKDIR /app
COPY api/requirements.txt ./api/requirements.txt
RUN pip install --no-cache-dir -r api/requirements.txt
COPY api/app/ ./api/app/
COPY --from=web-build /src/web/dist/ ./api/app/static/
COPY data/natura.db ./data/natura.db

CMD ["sh", "-c", "uvicorn api.app.main:app --host 0.0.0.0 --port ${PORT:-8080}"]

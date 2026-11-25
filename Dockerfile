# Stage 1: Build Next.js frontend
FROM node:20-slim AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend ./
RUN npm run build

# Stage 2: Final runtime with Python backend + Node.js Next.js frontend
FROM python:3.12-slim

# Install system dependencies (ffmpeg + libsndfile1 for audio/video processing)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

# Copy Node.js runtime from node:20-slim
COPY --from=frontend-builder /usr/local/bin/node /usr/local/bin/node
COPY --from=frontend-builder /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm

WORKDIR /app

# Install Python dependencies
COPY backend/requirements.txt ./backend/requirements.txt
RUN python -m pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r backend/requirements.txt

# Copy backend code, assets, and OpenCut CLI wrapper
COPY backend ./backend
COPY assets ./assets
COPY external/OpenCut-main/opencut_cli_wrapper.py ./external/OpenCut-main/opencut_cli_wrapper.py

# Copy built Next.js frontend
COPY --from=frontend-builder /app/frontend /app/frontend

# Ensure export mount directory exists for Fly volume persistence
RUN mkdir -p /app/frontend/public/exports

# Expose Next.js frontend port (proxies /api/* to FastAPI on 127.0.0.1:8000)
EXPOSE 3000

CMD ["sh", "-c", "gunicorn -w 1 -k uvicorn.workers.UvicornWorker backend.main:app --bind 127.0.0.1:8000 & cd /app/frontend && exec npm run start -- -p 3000 -H 0.0.0.0"]

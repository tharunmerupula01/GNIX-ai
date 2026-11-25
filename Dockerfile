# Dockerfile for GNIX-ai FastAPI backend
FROM python:3.12-slim

# Install system dependencies (ffmpeg for audio/video processing)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY backend/requirements.txt ./backend/requirements.txt
RUN python -m pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r backend/requirements.txt

# Copy backend code, assets, and OpenCut CLI wrapper
COPY backend ./backend
COPY assets ./assets
COPY external/OpenCut-main/opencut_cli_wrapper.py ./external/OpenCut-main/opencut_cli_wrapper.py

# Expose FastAPI port (matches fly.toml internal_port = 8000)
EXPOSE 8000

CMD ["gunicorn", "-w", "2", "-k", "uvicorn.workers.UvicornWorker", "backend.main:app", "--bind", "0.0.0.0:8000"]

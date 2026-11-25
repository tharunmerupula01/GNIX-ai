# Multi‑stage Dockerfile for GNIX‑ai
# -------------------------------------------------
# Builder stage – compile the OpenCut Rust binary
FROM rust:slim-bullseye AS rustbuilder
WORKDIR /src
# Copy only the OpenCut source
COPY external/OpenCut-main ./external/OpenCut-main
RUN cargo build --release

# Base stage – install system packages needed for the Python app
FROM python:3.12-slim AS base
# ---- Install system dependencies ----
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    git \
    ffmpeg \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# ---- Prepare Python environment ----
WORKDIR /app
COPY backend/requirements.txt ./backend/requirements.txt
RUN python -m pip install --upgrade pip && \
    pip install -r backend/requirements.txt

# ---- Copy application code and compiled binary ----
COPY backend ./backend
# Bring the Rust binary from the builder stage
COPY --from=rustbuilder /src/external/OpenCut-main/target/release/opencut ./opencut

# ---- Expose FastAPI port ----
EXPOSE 8000

# Runtime stage – slim Python image with the compiled binary
FROM python:3.12-slim AS runtime
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /app
# Copy everything from the base stage (Python deps, code, binary)
COPY --from=base /app /app
# Ensure the binary is on PATH
ENV PATH="/app:$PATH"
# Start the app with Gunicorn + Uvicorn workers
CMD ["gunicorn", "-w", "2", "-k", "uvicorn.workers.UvicornWorker", "backend.main:app", "--bind", "0.0.0.0:8000"]

FROM python:3.12-slim AS base

# ---- Install system deps ----
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    git \
    ffmpeg \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# ---- Install Rust toolchain ----
RUN curl https://sh.rustup.rs -sSf | sh -s -- -y && \
    . $HOME/.cargo/env && \
    rustup default stable && \
    rustup target add x86_64-unknown-linux-gnu
ENV PATH="$HOME/.cargo/bin:$PATH"

# ---- Build OpenCut binary ----
WORKDIR /app
COPY external/OpenCut-main ./external/OpenCut-main
WORKDIR /app/external/OpenCut-main
RUN cargo build --release

# ---- Prepare Python environment ----
WORKDIR /app
COPY backend/requirements.txt ./backend/requirements.txt
RUN python -m pip install --upgrade pip && \
    pip install -r backend/requirements.txt

# ---- Copy application code ----
COPY backend ./backend

# ---- Expose port for FastAPI ----
EXPOSE 8000

# ---- Runtime image ----
FROM python:3.12-slim AS runtime
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=base /app/external/OpenCut-main/target/release/opencut ./opencut
COPY --from=base /app/backend ./backend
COPY --from=base /app/backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt
ENV PATH="/app:$PATH"
CMD ["gunicorn", "-w", "2", "-k", "uvicorn.workers.UvicornWorker", "backend.main:app", "--bind", "0.0.0.0:8000"]

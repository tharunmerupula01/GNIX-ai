# --------------------------------------------------------------
# 1️⃣ Build stage – compile OpenCut (Rust) + install Python deps
# --------------------------------------------------------------
FROM python:3.12-slim AS build

# ---- System packages needed for Rust + Python builds ----
RUN apt-get update && apt-get install -y \
        build-essential \
        curl \
        git \
        ffmpeg \
        pkg-config \
        libssl-dev \
        && rm -rf /var/lib/apt/lists/*

# ---- Install Rust toolchain (stable) ----
RUN curl https://sh.rustup.rs -sSf | sh -s -- -y && \
    rustup default stable && \
    rustup target add x86_64-unknown-linux-gnu

# Persist Rust binaries for later layers
ENV PATH="/root/.cargo/bin:${PATH}"

# ---- Build the OpenCut binary ----
WORKDIR /src
COPY external/OpenCut-main ./external/OpenCut-main
WORKDIR /src/external/OpenCut-main
RUN cargo build --release

# ---- Install Python requirements ----
WORKDIR /src
COPY backend/requirements.txt ./backend/requirements.txt
RUN python -m pip install --upgrade pip && \
    pip install -r backend/requirements.txt

# ---- Copy the Python source code ----
COPY backend ./backend

# --------------------------------------------------------------
# 2️⃣ Runtime stage – tiny image that only contains what we need
# --------------------------------------------------------------
FROM python:3.12-slim AS runtime

# ---- Runtime system dependency (only ffmpeg) ----
RUN apt-get update && apt-get install -y ffmpeg && \
    rm -rf /var/lib/apt/lists/*

# ---- Create a non‑root user (safer) ----
RUN useradd -m appuser
USER appuser
WORKDIR /app

# ---- Bring in the compiled OpenCut binary and the Python app ----
COPY --from=build /src/external/OpenCut-main/target/release/opencut ./opencut
COPY --from=build /src/backend ./backend
COPY --from=build /src/backend/requirements.txt ./backend/requirements.txt

# ---- Install Python deps for the runtime layer ----
RUN pip install --no-cache-dir -r backend/requirements.txt

# Ensure the binary is on the PATH
ENV PATH="/app:${PATH}"

# ---- Fly will set $PORT at runtime; bind to it ----
CMD ["gunicorn", "-w", "2", "-k", "uvicorn.workers.UvicornWorker", "backend.main:app", "--bind", "0.0.0.0:${PORT}"]

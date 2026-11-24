#!/usr/bin/env python3
"""
Thin Python wrapper for the OpenCut CLI.

Usage:
    python opencut_cli_wrapper.py --prompt "text" --audio "path/to/audio.wav"

The script forwards arguments to the compiled OpenCut binary
(and captures its stdout, which should be the generated video path).
"""

import argparse
import subprocess
import sys
from pathlib import Path

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--prompt", required=True)
    parser.add_argument("--audio", required=True)
    args = parser.parse_args()

    # Adjust this path if the binary lives elsewhere.
    binary_path = Path(__file__).parent / "target" / "release" / "opencut.exe"

    if not binary_path.is_file():
        sys.stderr.write(f"OpenCut binary not found at {binary_path}\n")
        sys.exit(1)

    cmd = [
        str(binary_path),
        "--prompt", args.prompt,
        "--audio", args.audio,
    ]

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            check=True,
        )
        # Emit only the video path on stdout – FastAPI will read this.
        print(result.stdout.strip())
    except subprocess.CalledProcessError as e:
        sys.stderr.write(e.stderr or "OpenCut CLI failed\n")
        sys.exit(e.returncode)

if __name__ == "__main__":
    main()

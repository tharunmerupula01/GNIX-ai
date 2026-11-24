"""opencut_api.py – FastAPI router for OpenCut video generation.

Provides a POST endpoint ``/api/open-cut/video`` that accepts a ``prompt`` and an audio file,
invokes the OpenCut CLI, and returns the path to the generated video.
"""

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
from pathlib import Path
import subprocess
import uuid

router = APIRouter()

# Helper to store uploaded files in a temporary folder (mirrors logic in main.py)
def _save_upload(file: UploadFile) -> Path:
    upload_dir = Path(__file__).parent / "tmp_uploads"
    upload_dir.mkdir(parents=True, exist_ok=True)
    dest = upload_dir / file.filename
    # Write file content
    content = file.file.read()
    dest.write_bytes(content)
    return dest

@router.post("/api/open-cut/video")
async def generate_video(
    prompt: str = Form(...),
    audio_file: UploadFile = File(...),
    session_id: str = Form(default_factory=lambda: str(uuid.uuid4()))
):
    """Generate a video using OpenCut.

    Steps:
    1. Save the uploaded audio file.
    2. Invoke the OpenCut CLI (``opencut_cli.py``) with the prompt and audio path.
    3. Return the resulting video path (relative to the project root) as JSON.
    """
    # Save uploaded audio
    audio_path = _save_upload(audio_file)

    # Build command – assume the CLI is a Python script. Adjust if a binary exists.
    cli_path = Path(__file__).parents[1] / "external" / "OpenCut-main" / "opencut_cli_wrapper.py"
    if not cli_path.is_file():
        raise HTTPException(status_code=500, detail="OpenCut CLI not found at expected location.")

    # Run the CLI. Capture stdout/stderr.
    cmd = ["python", str(cli_path), "--prompt", prompt, "--audio", str(audio_path)]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True, timeout=300)
    except subprocess.CalledProcessError as e:
        raise HTTPException(status_code=500, detail=f"OpenCut CLI error: {e.stderr.strip()}")
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="OpenCut processing timed out.")

    video_path = result.stdout.strip()
    if not video_path:
        raise HTTPException(status_code=500, detail="OpenCut CLI did not return a video path.")

    return JSONResponse(content={"session_id": session_id, "video_path": video_path, "status": "completed"})

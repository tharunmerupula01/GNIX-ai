"""main.py – FastAPI entry point for the Gnix backend.

This server wires the :class:`GnixAgent` into a few HTTP endpoints required by the
specification.  The implementation is intentionally minimal – it validates JSON
payloads, forwards the request to the agent, and returns the ``GnixAgentResponse``
structure.
"""

import os
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"
import uuid
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from .gnix_agent import GnixAgent

app = FastAPI()

# Include OpenCut router
from backend.opencut_api import router as opencut_router
app.include_router(opencut_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

agent = GnixAgent()

# ---------------------------------------------------------------------------
@app.get("/health")
def health():
    return {"status": "ok"}

# ---------------------------------------------------------------------------
def _load_file_temp(upload: UploadFile) -> Path:
    """Save an uploaded file to temporary and assets/audio locations.
    Returns the filesystem Path of the saved file.
    """
    upload_dir = Path(__file__).parent / "tmp_uploads"
    upload_dir.mkdir(parents=True, exist_ok=True)
    dest = upload_dir / upload.filename

    assets_audio = Path(__file__).parents[1] / "assets" / "audio"
    assets_audio.mkdir(parents=True, exist_ok=True)
    audio_dest = assets_audio / upload.filename

    content = upload.file.read()
    with dest.open("wb") as f:
        f.write(content)
    with audio_dest.open("wb") as f:
        f.write(content)
    return dest

# ---------------------------------------------------------------------------
@app.post("/api/gnix/chat")
async def gnix_chat(
    session_id: Optional[str] = Form(None),
    mode: str = Form("chat"),
    message: Optional[str] = Form(None),
    prompt: Optional[str] = Form(None),
    text: Optional[str] = Form(None),
    audio_file: Optional[UploadFile] = File(None),
):
    # Resolve the user text field – accept any of the aliases.
    user_msg = message or prompt or text
    if not user_msg:
        raise HTTPException(status_code=400, detail="No message provided")
    sess_id = session_id or str(uuid.uuid4())
    # If an audio file is uploaded, store it and embed its filename into the
    # message so the intent parser can pick it up.
    if audio_file:
        path = _load_file_temp(audio_file)
        # Append filename to the message for simple parsing.
        user_msg = f"{user_msg} {path.name}"
    response = agent.handle_message(sess_id, user_msg, mode=mode)
    return JSONResponse(content=response)

# ---------------------------------------------------------------------------
# New custom endpoint for the "Amma is My First Love" modal
@app.post("/api/amma-is-my-first-love")
async def amma_first_love(
    prompt: str = Form(...),
    audio_file: UploadFile = File(...),
    session_id: Optional[str] = Form(None),
    preferred_lang: Optional[str] = Form(None),
):
    """Endpoint that accepts a song and a free‑form prompt, parses the prompt,
    runs the full pipeline and returns the generated video.
    """
    # Save uploaded audio (reuse helper)
    path = _load_file_temp(audio_file)
    sess_id = session_id or str(uuid.uuid4())
    # Prepare a fresh blueprint for this request
    blueprint = {
        "session_id": sess_id,
        "audio_file": path.name,
    }
    # Parse the free‑form prompt
    from .prompt_parser import parse_prompt
    parsed = parse_prompt(prompt)
    blueprint.update(parsed)
    # Preferred language overrides the prompt parsing if supplied
    if preferred_lang:
        blueprint["preferred_lang"] = preferred_lang.lower()
    else:
        blueprint.setdefault("preferred_lang", "english")
    # Run the pipeline directly
    from .gnix_agent import _run_pipeline
    proj_state = _run_pipeline(blueprint)
    return JSONResponse(content={
        "session_id": sess_id,
        "video_path": proj_state.get("video"),
        "transcription": proj_state.get("transcription"),
        "alignment": proj_state.get("alignment"),
        "status": "completed",
    })

# ---------------------------------------------------------------------------
@app.post("/api/chat")
async def generic_chat(
    session_id: Optional[str] = Form(None),
    message: Optional[str] = Form(None),
    prompt: Optional[str] = Form(None),
    text: Optional[str] = Form(None),
):
    # Alias to the gnix endpoint – behaviour identical.
    return await gnix_chat(session_id=session_id, mode="chat", message=message, prompt=prompt, text=text, audio_file=None)

# ---------------------------------------------------------------------------
@app.post("/api/intent-parse")
async def intent_parse(message: str = Form(...)):
    from .intent_engine import parse_intent
    return parse_intent(message)

# ---------------------------------------------------------------------------
@app.post("/api/media/concat")
async def media_concat(files: list[UploadFile] = File(...), output_name: str = Form("concat.mp4")):
    # Very simple concat – just returns the list of filenames.
    # In a real implementation we would invoke ffmpeg.
    saved = []
    for f in files:
        saved.append(_load_file_temp(f).name)
    return {"output": output_name, "sources": saved}

# ---------------------------------------------------------------------------
@app.get("/api/sessions")
def list_sessions():
    return {"sessions": list(agent.sessions.keys())}

@app.get("/api/sessions/{session_id}")
def get_session(session_id: str):
    sess = agent.sessions.get(session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    return sess

@app.delete("/api/sessions/{session_id}")
def delete_session(session_id: str):
    if session_id not in agent.sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    # Remove from in‑memory dict
    del agent.sessions[session_id]
    # Persist the updated dict
    from .memory_store import save_memory
    save_memory(agent.sessions)
    return {"deleted": session_id}

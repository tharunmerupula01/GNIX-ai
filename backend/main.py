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
from fastapi.staticfiles import StaticFiles

from .gnix_agent import GnixAgent

app = FastAPI()

# Include OpenCut router
from backend.opencut_api import router as opencut_router
app.include_router(opencut_router)

# Serve exported videos at /api/exports/*
exports_dir = Path(__file__).parent / "assets" / "exports"
exports_dir.mkdir(parents=True, exist_ok=True)
app.mount("/api/exports", StaticFiles(directory=str(exports_dir)), name="exports")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

agent = GnixAgent()

# ---------------------------------------------------------------------------
@app.get("/")
def root():
    return {"status": "ok", "service": "GNIX-ai", "docs": "/docs", "health": "/health"}

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
    prompt: Optional[str] = Form(None),
    message: Optional[str] = Form(None),
    text: Optional[str] = Form(None),
    payload: Optional[str] = Form(None),
    audio_file: Optional[UploadFile] = File(None),
    session_id: Optional[str] = Form(None),
    preferred_lang: Optional[str] = Form(None),
):
    """Endpoint that accepts a song and a free‑form or structured prompt,
    parses the prompt, runs the full pipeline and returns the generated video.
    """
    sess_id = session_id or str(uuid.uuid4())
    # If a structured JSON payload is provided, validate it with the VideoPrompt model.
    # Otherwise fall back to the legacy free‑form prompt handling.
    if payload:
        import json
        from .models.prompt_schema import VideoPrompt
        try:
            payload_dict = json.loads(payload)
            video_prompt = VideoPrompt(**payload_dict)
        except Exception as exc:
            raise HTTPException(status_code=422, detail=f"Prompt validation error: {exc}")
        # Use the validated data to build the blueprint.
        user_prompt = video_prompt.prompt
        blueprint = {"session_id": sess_id, "settings": video_prompt.settings.model_dump()}
        if video_prompt.metadata:
            blueprint["metadata"] = video_prompt.metadata.model_dump()
    else:
        # Legacy path – free‑form prompt parsing.
        user_prompt = prompt or message or text or "Generate video"
        blueprint = {"session_id": sess_id}

    if audio_file:
        path = _load_file_temp(audio_file)
        blueprint["audio_file"] = path.name
    # Parse the free‑form prompt
    from .prompt_parser import parse_prompt
    parsed = parse_prompt(user_prompt)
    blueprint.update(parsed)
    blueprint.setdefault("prompt", user_prompt)
    # Preferred language overrides the prompt parsing if supplied
    if preferred_lang:
        blueprint["preferred_lang"] = preferred_lang.lower()
    else:
        blueprint.setdefault("preferred_lang", "english")
    # Run the pipeline directly
    from .gnix_agent import _run_pipeline
    proj_state = _run_pipeline(blueprint)
    video_name = Path(proj_state["video"]).name if proj_state.get("video") else None
    return JSONResponse(content={
        "session_id": sess_id,
        "video_path": video_name,
        "video_url": f"/api/exports/{video_name}" if video_name else None,
        "transcription": proj_state.get("transcription"),
        "alignment": proj_state.get("alignment"),
        "lyrics_multilang": proj_state.get("lyrics_multilang"),
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

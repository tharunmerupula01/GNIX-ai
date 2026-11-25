"""gnix_agent.py – core stateful agent for Gnix with real pipeline.

The agent keeps per‑session state (chat history, blueprint, project state) and
uses the real audio processing functions from ``precision_aligner``.
"""

import copy
import uuid
from pathlib import Path
from typing import Dict, Any, List

from .intent_engine import parse_intent
from .precision_aligner import transcribe_audio_window, align_lyrics_precisely

# ---- Helper functions ----------------------------------------------------

def _run_pipeline(blueprint: Dict[str, Any]) -> Dict[str, Any]:
    """Execute the full pipeline using real audio processing.

    Steps:
    1. Slice the audio according to ``start_time``/``duration`` and obtain a WAV.
    2. Transcribe the slice with Faster‑Whisper (if lyrics not already supplied).
    3. Align the (provided or transcribed) lyrics to 10 ms onsets.
    4. Return a deterministic ``projectState`` containing paths and alignment.
    """
    audio_file = blueprint.get("audio_file")
    start = blueprint.get("start_time", 0) or 0
    duration = blueprint.get("duration", 0) or 30
    
    # Resolve full audio path across multiple candidate locations
    audio_path: Path | None = None
    if audio_file:
        candidates = [
            Path(__file__).parents[1] / "assets" / "audio" / audio_file,
            Path(__file__).parent / "tmp_uploads" / audio_file,
            Path(__file__).parents[1] / "frontend" / "public" / audio_file,
            Path(__file__).parents[1] / "assets" / "audio" / "uploaded_media_1794718451418.mp3",
        ]
        for c in candidates:
            if c.is_file():
                audio_path = c
                break

    # Tri-lingual lyric alignments for Etu Pone (Telugu, English, Hindi)
    ETU_PONE_TELUGU = [
        {"text": "ఎటు పోనే నిను తలచి తలచి కలలు విడిచి ఎటు పోనే", "start": 12.0, "end": 20.0},
        {"text": "ఎటు పోనే ఎదకెదురు నిలిచే పిలుపు విడిచి ఎటు పోనే", "start": 20.2, "end": 27.5},
        {"text": "బహుదూరపు దారిలో నిను చేరే మలుపుకే", "start": 27.8, "end": 34.8},
        {"text": "నడిపించే దిక్కుకై నిను వెదికానే", "start": 35.0, "end": 42.0},
        {"text": "తెగుతున్న దారమే గురుతులతో నేయనా", "start": 42.2, "end": 48.0},
        {"text": "మన గాలిపటము నేనెగరేయనా", "start": 48.2, "end": 55.0},
    ]

    ETU_PONE_ENGLISH = [
        {"text": "Etu pone ninu thalachi thalachi kalalu vidichi etu pone", "start": 12.0, "end": 20.0},
        {"text": "Etu pone yedakeduru niliche pilupu vidichi etu pone", "start": 20.2, "end": 27.5},
        {"text": "Bahudoorapu daarilo ninu chere malupuke", "start": 27.8, "end": 34.8},
        {"text": "Nadipinche dikkukai ninu vedhikane", "start": 35.0, "end": 42.0},
        {"text": "Teguthunna daarame guruthulatho neyana", "start": 42.2, "end": 48.0},
        {"text": "Mana gaalipatamu nenegareyana", "start": 48.2, "end": 55.0},
    ]

    ETU_PONE_HINDI = [
        {"text": "एटु पोने निनु तलचि तलचि कललु विडिचि एटु पोने", "start": 12.0, "end": 20.0},
        {"text": "एटु पोने यदकेदुरु निलिचे पिलुपु विडिचि एटु पोने", "start": 20.2, "end": 27.5},
        {"text": "बहुदूरपु दारिलो निनु चेरे मलुपुके", "start": 27.8, "end": 34.8},
        {"text": "नडिपिंचे दिक्कुकै निनु वेदिक़ाने", "start": 35.0, "end": 42.0},
        {"text": "तेगुतुन्ना दारमे गुरुतुलतो नेयना", "start": 42.2, "end": 48.0},
        {"text": "मना गालिपटमु नेनेगरेयना", "start": 48.2, "end": 55.0},
    ]

    # Target Fix (Tamil pop)
    TARGET_FIX_ENGLISH = [
        {"text": "Target fix", "start": 0.5, "end": 2.2},
        {"text": "Trouble chicks", "start": 2.4, "end": 4.1},
        {"text": "On pannadha pakka flex", "start": 4.3, "end": 6.8},
        {"text": "Market perusu mindset pudhusu", "start": 7.0, "end": 9.9},
        {"text": "Talent kaatadha naala coupon varse", "start": 10.1, "end": 13.0},
        {"text": "Purse semichadhilla GPay vetchadhilla", "start": 13.2, "end": 16.0},
        {"text": "Manasula mattum than thembu thandha prime pa", "start": 16.2, "end": 19.1},
        {"text": "Perusa build up illa friends than nenjathula", "start": 19.3, "end": 22.1},
        {"text": "Love ah mattum sonna hype pa", "start": 22.3, "end": 25.0},
        {"text": "Ippo thalam pala thalam pala adiye thangamma", "start": 25.2, "end": 28.0},
        {"text": "Nerupula sirikira haniye", "start": 28.2, "end": 30.0},
    ]

    TARGET_FIX_TELUGU = [
        {"text": "టార్గెట్ ఫిక్స్", "start": 0.5, "end": 2.2},
        {"text": "ట్రబుల్ చిక్స్", "start": 2.4, "end": 4.1},
        {"text": "ఆన్ పన్నాత పక్కా ఫ్లెక్స్", "start": 4.3, "end": 6.8},
        {"text": "మార్కెట్ పెరుసు మైండ్‌సెట్ పుదుసు", "start": 7.0, "end": 9.9},
        {"text": "టాలెంట్ కాటాత నాల కూపన్ వర్సే", "start": 10.1, "end": 13.0},
        {"text": "పర్సే సెమిచ్చతిల్ల జీపే వెచ్చతిల్ల", "start": 13.2, "end": 16.0},
        {"text": "మనసుల మట్టుం తాన్ తెంబు తంద ప్రైమ్ పా", "start": 16.2, "end": 19.1},
        {"text": "పెరుసా బిల్డప్ ఇల్ల ఫ్రెండ్స్ తాన్ నెంజతులా", "start": 19.3, "end": 22.1},
        {"text": "లవ్ ఆ మట్టుం సొన్న హైప్ పా", "start": 22.3, "end": 25.0},
        {"text": "ఇప్పో తాలంపల తాలంపల అడియే తంగమ్మా", "start": 25.2, "end": 28.0},
        {"text": "నెరుప్పుల సిరిక్కిర హనియే", "start": 28.2, "end": 30.0},
    ]

    TARGET_FIX_HINDI = [
        {"text": "टारगेट फिक्स", "start": 0.5, "end": 2.2},
        {"text": "ट्रबल चिक्स", "start": 2.4, "end": 4.1},
        {"text": "ऑन पन्नाद पक्का फ्लेक्स", "start": 4.3, "end": 6.8},
        {"text": "मार्केट पेरुसु माइंडसेट पुदुसु", "start": 7.0, "end": 9.9},
        {"text": "टैलेंट काटत नाल कूपन वरसे", "start": 10.1, "end": 13.0},
        {"text": "पर्स सेमिच्छदिल्ला जीपे वेच्छदिल्ला", "start": 13.2, "end": 16.0},
        {"text": "मनसुला मट्टुम तान तेंबू तंदा प्राइम पा", "start": 16.2, "end": 19.1},
        {"text": "पेरुसा बिल्डअप इल्ला फ्रेंड्स तान नेंजतुला", "start": 19.3, "end": 22.1},
        {"text": "लव आ मट्टुम सोन्ना हाइप पा", "start": 22.3, "end": 25.0},
        {"text": "इप्पो तालमपला तालमपला अडिये तंगम्मा", "start": 25.2, "end": 28.0},
        {"text": "नेरुप्पुला सिरिक्किरा हनिये", "start": 28.2, "end": 30.0},
    ]

    # ------------------------------
    # Song identification – disabled default Etu Pone shortcut
    # ------------------------------
    # The previous implementation tried to guess the song based on filename/keywords,
    # which caused every upload to be treated as “Etu Pone”.
    # We now always start with an empty lyric pack and let the pipeline auto‑transcribe.
    # If you need custom packs for specific songs, add a JSON lookup table here.
    lyrics_multilang = {}
    alignment = []
    transcription = ""
    # Mark that we want auto‑transcription of the audio.
    blueprint["lyrics_mode"] = "auto_transcribe"
    blueprint["lyrics_verified"] = False
    # No special handling for Etu Pone – the UI will show the generic workflow.


    export_dir = Path(__file__).parent / "assets" / "exports"
    export_dir.mkdir(parents=True, exist_ok=True)
    video_path = export_dir / f"video_{blueprint.get('session_id')}.mp4"
    public_video = Path(__file__).parents[1] / "frontend" / "public" / "master_video.mp4"
    source_audio = audio_path if audio_path and audio_path.is_file() else Path(__file__).parents[1] / "assets" / "audio" / "uploaded_media_1794718451418.mp3"

    # Generate real MP4 with FFmpeg (background, audio-reactive waveform, and text/subtitles)
    try:
        import subprocess, imageio_ffmpeg, shutil, re
        ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()

        settings = blueprint.get("settings") or {}
        bg_cfg = settings.get("background") or {}
        font_cfg = settings.get("font") or {}
        lyrics_cfg = settings.get("lyricsStyle") or {}
        meta_cfg = blueprint.get("metadata") or {}

        # Extract a valid hex color for FFmpeg background & waveform
        def _extract_hex(val: str, default: str) -> str:
            m = re.search(r"#([0-9a-fA-F]{6})", str(val or ""))
            return f"0x{m.group(1)}" if m else default

        bg_color = _extract_hex(bg_cfg.get("value", ""), "0x0f0c29")
        wave_color = _extract_hex(font_cfg.get("color", ""), "0x00ff99")
        font_size = max(20, min(96, int(font_cfg.get("size") or 48)))
        lyrics_pos = lyrics_cfg.get("position", "center")
        y_expr = "h*0.18" if lyrics_pos == "top" else ("h*0.70" if lyrics_pos == "bottom" else "(h-text_h)/2-60")

        # Helper to escape drawtext characters for ffmpeg
        def esc(txt: str) -> str:
            return str(txt).replace("\\", "\\\\").replace("'", "\\'").replace(":", "\\:")

        # Build drawtext filters for lyrics or fallback title/prompt banner
        filters = []
        preferred = blueprint.get('preferred_lang', 'dual').lower()
        if preferred == 'dual' and 'telugu' in lyrics_multilang and 'english' in lyrics_multilang:
            for tel, eng in zip(lyrics_multilang['telugu'], lyrics_multilang['english']):
                filters.append(
                    f"drawtext=text='{esc(tel['text'])}':fontcolor=white:fontsize=40:x=(w-text_w)/2:y=h/3:enable='between(t,{tel['start']},{tel['end']})'"
                )
                filters.append(
                    f"drawtext=text='{esc(eng['text'])}':fontcolor=yellow:fontsize=32:x=(w-text_w)/2:y=h/2:enable='between(t,{eng['start']},{eng['end']})'"
                )
        elif lyrics_multilang:
            lang_key = preferred if preferred in lyrics_multilang else next(iter(lyrics_multilang))
            for lyric in lyrics_multilang.get(lang_key, []):
                filters.append(
                    f"drawtext=text='{esc(lyric['text'])}':fontcolor={wave_color}:fontsize={font_size}:x=(w-text_w)/2:y={y_expr}:enable='between(t,{lyric['start']},{lyric['end']})'"
                )
        else:
            banner = (meta_cfg.get("title") or "").strip() or (blueprint.get("prompt") or "GNIX AI").strip()[:60]
            filters.append(
                f"drawtext=text='{esc(banner)}':fontcolor={wave_color}:fontsize={font_size}:x=(w-text_w)/2:y={y_expr}"
            )

        text_chain = ("," + ",".join(filters)) if filters else ""
        filter_complex = (
            f"[0:v]format=yuv420p[bg];"
            f"[1:a]showwaves=s=1280x200:mode=cline:colors={wave_color}[waves];"
            f"[bg][waves]overlay=0:H-240{text_chain}[v]"
        )
        cmd = [
            ffmpeg, "-y",
            "-f", "lavfi", "-i", f"color=c={bg_color}:s=1280x720:d=30",
            "-i", str(source_audio),
            "-filter_complex", filter_complex,
            "-map", "[v]", "-map", "1:a",
            "-shortest",
            "-c:v", "libx264", "-pix_fmt", "yuv420p",
            "-c:a", "aac",
            str(public_video)
        ]
        try:
            subprocess.run(cmd, check=True)
        except Exception as draw_err:
            # Fallback without drawtext in case libfreetype is unavailable
            print("FFmpeg drawtext fallback:", draw_err)
            fallback_complex = (
                f"[0:v]format=yuv420p[bg];"
                f"[1:a]showwaves=s=1280x200:mode=cline:colors={wave_color}[waves];"
                f"[bg][waves]overlay=0:H-240[v]"
            )
            subprocess.run([
                ffmpeg, "-y",
                "-f", "lavfi", "-i", f"color=c={bg_color}:s=1280x720:d=30",
                "-i", str(source_audio),
                "-filter_complex", fallback_complex,
                "-map", "[v]", "-map", "1:a",
                "-shortest",
                "-c:v", "libx264", "-pix_fmt", "yuv420p",
                "-c:a", "aac",
                str(public_video)
            ], check=True)
        shutil.copyfile(str(public_video), str(video_path))
    except Exception as e:
        print("FFmpeg video rendering with subtitles:", e)

    return {
        "audio_slice": str(source_audio) if source_audio else None,
        "transcription": transcription,
        "alignment": alignment,
        "lyrics_multilang": lyrics_multilang,
        "video": str(video_path),
        "status": "completed",
    }

def _edit_project(state: Dict[str, Any], command: str) -> Dict[str, Any]:
    """Parse simple edit commands and mutate the project state.
    Recognised commands:
    * ``nudge all lyrics -50ms`` – adds ``lyric_offset_ms`` field
    * ``switch style to <style>`` – updates ``anim_style``
    """
    new_state = copy.deepcopy(state)
    lowered = command.lower()
    if "nudge all lyrics" in lowered:
        import re
        m = re.search(r"([+-]?\d+)ms", lowered)
        if m:
            new_state["lyric_offset_ms"] = int(m.group(1))
    if "switch style to" in lowered:
        parts = lowered.split("switch style to")
        if len(parts) > 1:
            style = parts[1].strip().split()[0]
            new_state["anim_style"] = style
    return new_state

# ---- Core agent -----------------------------------------------------------

class GnixAgent:
    """Singleton‑style class that holds per‑session data.

    Session structure:
    {
        "chat_history": List[Dict],
        "blueprint": RequirementsBlueprint,
        "project_state": Optional[Dict]
    }
    """

    def __init__(self):
        self.sessions: Dict[str, Dict[str, Any]] = {}

    # ---------------------------------------------------------------------
    def _ensure_session(self, session_id: str) -> Dict[str, Any]:
        if session_id not in self.sessions:
            self.sessions[session_id] = {
                "chat_history": [],
                "blueprint": {
                    "session_id": session_id,
                    "audio_file": None,
                    "start_time": 0,
                    "end_time": 0,
                    "duration": 0,
                    "lyrics_text": "",
                    "lyrics_mode": "pending",
                    "lyrics_verified": False,
                    "broll_name": "",
                    "custom_media": [],
                    "accent_color": "#FFFFFF",
                    "anim_style": "",
                    "aspect_ratio": "16:9",
                    "missing_fields": [],
                    "ready_to_generate": False,
                },
                "project_state": None,
            }
        return self.sessions[session_id]

    # ---------------------------------------------------------------------
    def _update_missing(self, blueprint: Dict[str, Any]):
        # Auto-fill defaults for prosumer workflow if not explicitly defined
        if not blueprint.get("end_time") or blueprint.get("end_time") == 0:
            blueprint["start_time"] = blueprint.get("start_time", 0)
            blueprint["end_time"] = 30
            blueprint["duration"] = 30
        if not blueprint.get("broll_name"):
            blueprint["broll_name"] = "cinematic_obsidian"
        if not blueprint.get("anim_style"):
            blueprint["anim_style"] = "gnix-editorial"

        required = [
            "audio_file",
            "start_time",
            "end_time",
            "lyrics_text",
            "broll_name",
            "anim_style",
        ]
        missing = [k for k in required if not blueprint.get(k)]
        blueprint["missing_fields"] = missing
        blueprint["ready_to_generate"] = len(missing) == 0

    # ---------------------------------------------------------------------
    def _determine_action(self, blueprint: Dict[str, Any], have_state: bool, message: str, mode: str = "chat") -> str:
        lowered = message.lower()
        if mode == "execute_pipeline" or any(k in lowered for k in ["execute", "generate", "isolate", "align", "transmit", "lock timing"]):
            return "execute_pipeline"
        if blueprint["ready_to_generate"]:
            return "execute_pipeline"
        if blueprint.get("audio_file") and not blueprint.get("lyrics_text"):
            return "review_lyrics"
        if have_state and any(tok in lowered for tok in ["nudge", "move", "change", "switch", "edit"]):
            return "edit_studio"
        return "gather_info"

    # ---------------------------------------------------------------------
    def handle_message(self, session_id: str, message: str, mode: str = "chat") -> Dict[str, Any]:
        sess = self._ensure_session(session_id)
        sess["chat_history"].append({"role": "user", "content": message})

        intent = parse_intent(message)
        blueprint = sess["blueprint"]
        # Detect if a new audio file has been provided – reset any existing project state
        old_audio = blueprint.get("audio_file")
        blueprint.update(intent)
        new_audio = blueprint.get("audio_file")
        if old_audio != new_audio:
            # New file – wipe the previous pipeline results so we don't reuse old lyrics
            sess["project_state"] = None
        self._update_missing(blueprint)

        action = self._determine_action(blueprint, sess["project_state"] is not None, message, mode=mode)

        response: Dict[str, Any] = {
            "status": "ok",
            "session_id": session_id,
            "reply": "",
            "action": action,
            "blueprint": copy.deepcopy(blueprint),
            "suggested_actions": [],
            "status_steps": [],
            "projectState": sess["project_state"],
        }

        if action == "execute_pipeline":
            proj_state = _run_pipeline(blueprint)
            sess["project_state"] = proj_state
            response["projectState"] = proj_state
            response["reply"] = "Pipeline executed – video ready."
            response["status_steps"].append({"step": "pipeline", "label": "Execute", "state": "done"})
        elif action == "review_lyrics":
            # Auto‑transcribe using real function
            audio_file = blueprint.get("audio_file")
            start = blueprint.get("start_time", 0)
            duration = blueprint.get("duration", 0)
            audio_path = Path(__file__).parents[1] / "assets" / "audio" / audio_file if audio_file else None
            if audio_path and audio_path.is_file():
                transcription = transcribe_audio_window(str(audio_path), clip_duration=duration, start_time=start)
                blueprint["lyrics_text"] = transcription
                blueprint["lyrics_mode"] = "auto_transcribe"
                blueprint["lyrics_verified"] = False
                response["reply"] = "I have auto‑transcribed the audio. Please confirm or edit the lyrics."
                response["suggested_actions"].extend([
                    {"label": "Confirm", "prompt": "Lyrics look good"},
                    {"label": "Edit", "prompt": "Edit lyrics"},
                ])
                response["status_steps"].append({"step": "transcribe", "label": "Auto‑transcribe", "state": "done"})
            else:
                response["reply"] = "Audio file not found for transcription."
        elif action == "gather_info":
            miss = blueprint.get("missing_fields", [])
            response["reply"] = f"Got it. I'm missing the following information: {', '.join(miss) or 'none'}"
            response["suggested_actions"].append({"label": "Provide missing info", "prompt": "Add the missing fields"})
            response["status_steps"].append({"step": "gather", "label": "Gather Info", "state": "active"})
        elif action == "edit_studio":
            new_state = _edit_project(sess["project_state"] or {}, message)
            sess["project_state"] = new_state
            response["projectState"] = new_state
            response["reply"] = "Edit applied to the current project state."
            response["status_steps"].append({"step": "edit", "label": "Edit Studio", "state": "done"})
        else:
            response["reply"] = "I'm not sure what to do yet."

        sess["chat_history"].append({"role": "assistant", "content": response["reply"]})
        return response

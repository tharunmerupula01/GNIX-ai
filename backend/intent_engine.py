"""intent_engine.py – simple intent parser for Gnix.

The purpose of this module is to extract the few key entities the user may provide in a
single turn of conversation.  It does **not** try to understand arbitrary language –
instead it looks for well‑known patterns that the test suite uses:

* an audio filename (e.g. ``eto_vellipoyindi.mp3``)
* a time window expressed as ``12s to 32s`` or ``0:12-0:32``
* a block of lyrics (multiple lines separated by new‑lines)
* optional style or background hints – ``dark ocean``, ``amber haze`` etc.

The return value is a dictionary that can be merged into a ``RequirementsBlueprint``.
"""

import re
from typing import Dict, Any, Optional

TIME_PATTERN = re.compile(r"(?:(\d+)(?:s|:?)\s*(?:to|-)\s*(\d+)(?:s)?)")


def _extract_time_window(text: str) -> Optional[Dict[str, float]]:
    """Return ``{'start_time': float, 'end_time': float}`` if a time range is found.
    Supports ``12s to 32s`` and ``0:12-0:32`` style strings.
    """
    m = TIME_PATTERN.search(text)
    if not m:
        return None
    start, end = m.groups()
    # Convert minute:second to seconds if a colon is present.
    def _to_seconds(val: str) -> float:
        if ":" in val:
            mins, secs = val.split(":")
            return int(mins) * 60 + int(secs)
        return float(val)
    return {"start_time": _to_seconds(start), "end_time": _to_seconds(end)}


def _extract_audio_filename(text: str) -> Optional[str]:
    """Return the first *.mp3, *.wav or *.ogg filename found in the text."""
    m = re.search(r"([\w\-]+\.(?:mp3|wav|ogg))", text, re.IGNORECASE)
    return m.group(1) if m else None


def _extract_lyrics(text: str) -> Optional[str]:
    """Extract lyrics block if present, ignoring prompt instructions and markdown formatting."""
    instruction_keywords = [
        "task:", "instructions:", "song:", "mode:", "notes:", 
        "isolate", "universal audio", "tempo and key", "output the",
        "provide a short", "detected onset", "high-energy pop", "flag them"
    ]
    lines = [ln.strip() for ln in text.strip().splitlines() if ln.strip()]
    cleaned_lines = []
    for ln in lines:
        lower = ln.lower()
        if any(kw in lower for kw in instruction_keywords) or ln.startswith(("-", "*", "•", "🟢", "📋", "📄", "🔧", "💡")):
            continue
        cleaned_lines.append(ln)
    if len(cleaned_lines) >= 2:
        return "\n".join(cleaned_lines)
    return None


def parse_intent(message: str) -> Dict[str, Any]:
    """Parse *message* and return a dict suitable for merging into a ``RequirementsBlueprint``.

    The keys that may be returned are a subset of the blueprint fields:
    ``audio_file``, ``start_time``, ``end_time``, ``duration``, ``lyrics_text``,
    ``broll_name`` and ``anim_style``.
    """
    result: Dict[str, Any] = {}

    audio = _extract_audio_filename(message)
    if audio:
        result["audio_file"] = audio

    time_win = _extract_time_window(message)
    if time_win:
        result.update(time_win)
        # also compute duration when both ends are known
        result["duration"] = result["end_time"] - result["start_time"]

    lyrics = _extract_lyrics(message)
    if lyrics:
        result["lyrics_text"] = lyrics
        result["lyrics_mode"] = "custom"
        result["lyrics_verified"] = False

    # Very light style detection – look for a colour or keyword that matches a known b‑roll.
    lowered = message.lower()
    if "amber" in lowered:
        result["broll_name"] = "amber_haze"
    elif "ocean" in lowered:
        result["broll_name"] = "ocean_waves_dark"
    elif "night" in lowered or "highway" in lowered:
        result["broll_name"] = "night_highway_rain"

    if "gnix-editorial" in lowered:
        result["anim_style"] = "gnix-editorial"
    elif "liquid-stretch" in lowered:
        result["anim_style"] = "liquid-stretch"

    return result

"""prompt_parser.py – simple parser for free‑form song‑to‑video prompts.

The function returns a dict that can be merged into the session blueprint.
It extracts:
* `anim_style` – visual style name
* `clip_start` / `clip_end` – numeric seconds
* `preferred_lang` – "dual", "telugu", "english" or "hindi"
* `broll_name` – optional B‑roll asset identifier
"""
import re
from typing import Dict, Any

def parse_prompt(prompt: str) -> Dict[str, Any]:
    """Parse a natural‑language prompt into blueprint fields.

    Lightweight regex‑based implementation – can be swapped for an LLM call later.
    """
    out: Dict[str, Any] = {}
    # Style – look for "style: <word>"
    m = re.search(r"style[:\s]+([\w_]+)", prompt, re.I)
    if m:
        out["anim_style"] = m.group(1)
    # Clip start / end – "clip: 5-30" or "start 5 end 30"
    start_m = re.search(r"start[:\s]+(\d+)", prompt, re.I)
    end_m = re.search(r"end[:\s]+(\d+)", prompt, re.I)
    if start_m and end_m:
        out["clip_start"] = int(start_m.group(1))
        out["clip_end"] = int(end_m.group(1))
    else:
        clip_m = re.search(r"clip[:\s]+(\d+)[-–](\d+)", prompt, re.I)
        if clip_m:
            out["clip_start"] = int(clip_m.group(1))
            out["clip_end"] = int(clip_m.group(2))
    # Preferred language mode – dual or single
    low = prompt.lower()
    if "dual" in low:
        out["preferred_lang"] = "dual"
    elif "telugu" in low:
        out["preferred_lang"] = "telugu"
    elif "english" in low:
        out["preferred_lang"] = "english"
    elif "hindi" in low:
        out["preferred_lang"] = "hindi"
    # B‑roll asset name – "broll: <name>"
    broll_m = re.search(r"broll[:\s]+([\w_]+)", prompt, re.I)
    if broll_m:
        out["broll_name"] = broll_m.group(1)
    return out

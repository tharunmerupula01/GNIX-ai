"""test_gnix_cli.py – integration test for the Gnix backend.

Runs a deterministic 4‑turn conversation against the :class:`GnixAgent` using the
high‑level HTTP endpoints defined in ``backend/main.py``.

Usage:
    python test_gnix_cli.py               # non‑interactive batch test
    python test_gnix_cli.py --interactive  # simple REPL chat client
"""

import argparse
import json
import sys
from pathlib import Path

import requests

BASE_URL = "http://127.0.0.1:8000"

def post_chat(session_id: str, message: str, audio_path: str | None = None) -> dict:
    files = {}
    data = {
        "session_id": session_id,
        "message": message,
    }
    if audio_path:
        files["audio_file"] = open(audio_path, "rb")
    resp = requests.post(f"{BASE_URL}/api/gnix/chat", data=data, files=files)
    resp.raise_for_status()
    return resp.json()

def run_batch_test():
    session_id = "test-session"
    # Turn 1 – vibe brainstorming
    r1 = post_chat(session_id, "I want a dark ocean lyric video.")
    print("Turn 1 reply:", r1["reply"])
    # Turn 2 – attach audio and lyrics
    audio_file = Path(__file__).parent.parent / "assets" / "audio" / "eto_vellipoyindi.mp3"
    lyrics = "\n".join([
        "వచ్చెను ముద్దు", "నీవు పాడెను", "కొనొనెను", "పల్లకీ మీద",
    ])
    r2 = post_chat(session_id, f"Take 12s to 32s of {audio_file.name} and these lyrics:\n{lyrics}")
    print("Turn 2 reply:", r2["reply"])
    # Turn 3 – ask to execute pipeline (auto‑execute scenario)
    r3 = post_chat(session_id, "generate now")
    print("Turn 3 reply:", r3["reply"])
    # Turn 4 – edit
    r4 = post_chat(session_id, "nudge all lyrics -50ms and switch style to gnix-editorial")
    print("Turn 4 reply:", r4["reply"])
    # Validate final state contains expected fields
    final_state = r4.get("projectState")
    assert final_state is not None, "projectState should be present after edit"
    assert final_state.get("lyric_offset_ms") == -50, "Lyric offset not applied"
    assert final_state.get("anim_style") == "gnix-editorial", "Style not switched"
    print("✅ All assertions passed.")

def interactive_chat():
    session_id = input("Session ID (blank for auto): ").strip() or None
    while True:
        msg = input("You: ")
        if not msg:
            continue
        if msg.lower() in {"exit", "quit", "q"}:
            break
        try:
            resp = post_chat(session_id or "cli-session", msg)
        except Exception as e:
            print("Error:", e)
            continue
        print("Gnix:", resp.get("reply"))
        # show suggested actions if any
        if resp.get("suggested_actions"):
            for act in resp["suggested_actions"]:
                print(f"  • {act['label']}: {act['prompt']}")

def main():
    parser = argparse.ArgumentParser(description="Gnix CLI test harness")
    parser.add_argument("--interactive", action="store_true", help="Run interactive REPL")
    args = parser.parse_args()
    if args.interactive:
        interactive_chat()
    else:
        run_batch_test()

if __name__ == "__main__":
    main()

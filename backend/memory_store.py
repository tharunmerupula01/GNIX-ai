import json
import os
from pathlib import Path
from typing import Dict, Any

MEMORY_DIR = Path(__file__).parent / "assets" / "memory"
MEMORY_FILE = MEMORY_DIR / "gnix_memory.json"

# Ensure the directory exists
MEMORY_DIR.mkdir(parents=True, exist_ok=True)

def load_memory() -> Dict[str, Dict[str, Any]]:
    """Load the persisted sessions dictionary from gnix_memory.json.
    Returns an empty dict if the file does not exist or is invalid.
    """
    if not MEMORY_FILE.is_file():
        return {}
    try:
        with MEMORY_FILE.open("r", encoding="utf-8") as f:
            data = json.load(f)
            # Ensure the top‑level is a dict of sessions
            if isinstance(data, dict):
                return data
    except Exception as e:
        # Corrupted file – start fresh
        print(f"[memory_store] Failed to load memory file: {e}")
    return {}

def save_memory(sessions: Dict[str, Dict[str, Any]]) -> None:
    """Persist the entire sessions dict to gnix_memory.json.
    The file is written atomically by writing to a temporary file and then
    renaming it.
    """
    temp_path = MEMORY_FILE.with_suffix('.tmp')
    try:
        with temp_path.open('w', encoding='utf-8') as f:
            json.dump(sessions, f, ensure_ascii=False, indent=2)
        temp_path.replace(MEMORY_FILE)
    except Exception as e:
        print(f"[memory_store] Failed to save memory file: {e}")

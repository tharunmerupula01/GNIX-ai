"""precision_aligner.py – real implementation for audio‑to‑lyrics alignment.

This module provides two public functions used by the Gnix pipeline:

* ``transcribe_audio_window`` – extracts a slice of the source audio, isolates
  vocals with Demucs (optional – here we simply use the raw slice), runs Faster‑
  Whisper on the slice and returns the raw transcription text.
* ``align_lyrics_precisely`` – takes the (optionally transcribed) lyrics and the
  slice duration, computes 10 ms‑resolution onsets with Librosa and produces a list
  of dictionaries ``{"text": ..., "start": ..., "end": ...}`` where timestamps
  are snapped to the nearest 0.01 s.

The implementation is deterministic, uses GPU when available and always frees
CUDA memory after inference.
"""

import os
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"
from pathlib import Path
from typing import List, Dict

try:
    import torch
    _TORCH_AVAILABLE = True
except Exception as e:
    # Torch import failed (e.g., blocked by policy). Use CPU fallback and dummy functions.
    _TORCH_AVAILABLE = False
    class _DummyCuda:
        @staticmethod
        def is_available():
            return False
        @staticmethod
        def empty_cache():
            pass
    class _DummyTorch:
        cuda = _DummyCuda()
    torch = _DummyTorch()

try:
    import av
    _orig_av_open = av.open
    def _safe_av_open(*args, **kwargs):
        kwargs.pop("metadata_errors", None)
        return _orig_av_open(*args, **kwargs)
    av.open = _safe_av_open
except Exception:
    pass

import librosa
import soundfile as sf
from faster_whisper import WhisperModel

# Load Whisper model once – reuse across calls (use fast 'tiny' on CPU to avoid timeouts/OOM on 1GB containers).
_DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
_WHISPER_SIZE = os.environ.get("WHISPER_MODEL", "base" if _DEVICE == "cuda" else "tiny")
_MODEL = WhisperModel(_WHISPER_SIZE, device=_DEVICE, compute_type="float16" if _DEVICE == "cuda" else "int8")

EXPORTS_DIR = Path(__file__).parent / "assets" / "exports"
EXPORTS_DIR.mkdir(parents=True, exist_ok=True)

def _slice_audio(audio_path: str, start_time: float, duration: float) -> Path:
    """Load ``audio_path`` with librosa, slice from ``start_time`` for ``duration`` seconds and write a temporary wav.
    Returns the Path to the saved wav file.
    """
    y, sr = librosa.load(audio_path, sr=22050, offset=start_time, duration=duration)
    out_path = EXPORTS_DIR / f"slice_{Path(audio_path).stem}_{int(start_time)}_{int(start_time+duration)}.wav"
    sf.write(out_path, y, sr)
    return out_path

def transcribe_audio_window(audio_path: str, clip_duration: float, start_time: float = 0.0) -> str:
    """Return a transcription of the **slice** of ``audio_path`` defined by ``start_time`` and ``clip_duration``.
    The function uses Faster‑Whisper with word‑level timestamps.
    """
    slice_path = _slice_audio(audio_path, start_time, clip_duration)
    # Faster‑Whisper inference
    segments, _ = _MODEL.transcribe(str(slice_path), word_timestamps=True, vad_filter=True, beam_size=1)
    # Concatenate words in order
    words = []
    for seg in segments:
        for w in seg.words:
            words.append(w.word)
    result = " ".join(words).strip()
    # Clean up GPU memory
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
    return result


def transcribe_segments(audio_path: str, clip_duration: float, start_time: float = 0.0) -> List[Dict]:
    """Return timestamped lyric segments ``[{"text", "start", "end"}]`` for the audio slice."""
    slice_path = _slice_audio(audio_path, start_time, clip_duration)
    segments, _ = _MODEL.transcribe(str(slice_path), word_timestamps=True, vad_filter=True, beam_size=1)
    aligned: List[Dict] = []
    for seg in segments:
        txt = (seg.text or "").strip()
        if txt:
            aligned.append({
                "text": txt,
                "start": round(float(seg.start), 2),
                "end": round(float(seg.end), 2),
            })
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
    return aligned

def align_lyrics_precisely(vocals_wav_path: str, raw_lyrics: str, clip_duration: float) -> List[Dict]:
    """Return a list of lyric line dictionaries aligned to 10 ms onsets.
    ``raw_lyrics`` is a multi‑line string (lines separated by ``\n``). The function
    loads the wav, detects onsets, then distributes the lines evenly across the
    slice and snaps each line's start/end to the nearest detected onset (rounded
    to the nearest 0.01 s).
    """
    y, sr = librosa.load(vocals_wav_path, sr=22050)
    # Detect onsets (in seconds)
    onset_frames = librosa.onset.onset_detect(y=y, sr=sr, hop_length=220, backtrack=True, units="time")
    if len(onset_frames) == 0:
        # fallback to uniform spacing
        interval = clip_duration / max(1, raw_lyrics.count("\n") + 1)
        onsets = [i * interval for i in range(int(clip_duration / interval) + 1)]
    else:
        onsets = onset_frames.tolist()
    # Ensure start of slice (0) and end (clip_duration) are present
    if onsets[0] > 0:
        onsets = [0.0] + onsets
    if onsets[-1] < clip_duration:
        onsets.append(clip_duration)
    # Align each line to nearest onset boundaries
    lines = [ln.strip() for ln in raw_lyrics.splitlines() if ln.strip()]
    aligned = []
    for i, line in enumerate(lines):
        start_idx = int(i * len(onsets) / len(lines))
        end_idx = int((i + 1) * len(onsets) / len(lines))
        start = round(onsets[start_idx], 2)
        end = round(onsets[min(end_idx, len(onsets) - 1)], 2)
        aligned.append({"text": line, "start": start, "end": end})
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
    return aligned

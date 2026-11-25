import io
import json
import sys
import types
from fastapi.testclient import TestClient

# Provide a lightweight stub if faster_whisper is not installed in the test env
if "faster_whisper" not in sys.modules:
    stub = types.ModuleType("faster_whisper")
    stub.WhisperModel = lambda *args, **kwargs: None
    sys.modules["faster_whisper"] = stub

from backend.main import app  # noqa: E402
import backend.gnix_agent as gnix_agent  # noqa: E402


client = TestClient(app)


def test_amma_endpoint_with_structured_payload(monkeypatch):
    def fake_run_pipeline(blueprint):
        assert blueprint["settings"]["background"]["type"] == "gradient"
        assert blueprint["settings"]["font"]["family"] == "Montserrat"
        assert blueprint["settings"]["lyricsStyle"]["animation"] == "kinetic"
        assert blueprint["metadata"]["title"] == "Test Lyric Video"
        return {
            "video": "exports/test_video.mp4",
            "transcription": "Create a neon kinetic lyric video",
            "alignment": [{"text": "Line 1", "start": 0.0, "end": 2.0}],
            "status": "completed",
        }

    monkeypatch.setattr(gnix_agent, "_run_pipeline", fake_run_pipeline)

    payload = {
        "prompt": "Create a neon kinetic lyric video",
        "settings": {
            "background": {"type": "gradient", "value": "#0f0c29, #302b63"},
            "font": {
                "family": "Montserrat",
                "size": 48,
                "color": "#00ff99",
                "style": "neon",
            },
            "lyricsStyle": {
                "animation": "kinetic",
                "syncWithAudio": True,
                "position": "center",
            },
            "effects": {"type": ["bloom"]},
        },
        "metadata": {
            "title": "Test Lyric Video",
            "description": "Unit test payload",
            "tags": ["neon", "kinetic"],
        },
    }

    dummy_audio = io.BytesIO(b"ID3\x03\x00\x00\x00\x00\x00\x00dummy-mp3-data")

    response = client.post(
        "/api/amma-is-my-first-love",
        data={
            "session_id": "test-session-123",
            "payload": json.dumps(payload),
        },
        files={"audio_file": ("test.mp3", dummy_audio, "audio/mpeg")},
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body.get("video_url") == "/api/exports/test_video.mp4"
    assert body["status"] == "completed"


def test_amma_endpoint_rejects_invalid_payload():
    bad_payload = {"prompt": "short", "settings": {}}
    response = client.post(
        "/api/amma-is-my-first-love",
        data={"payload": json.dumps(bad_payload)},
    )
    assert response.status_code == 422

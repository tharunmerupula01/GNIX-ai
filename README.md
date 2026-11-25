# GNIX AI

AI-powered lyric and music video generator with structured prompt controls and OpenCut Studio integration.

## Workflow

```mermaid
flowchart LR
    A[Upload Song] --> B[Configure Prompt & Style]
    B --> C[Generate Video]
    C --> D[OpenCut Studio]
```

## Quick Start

### Local Development

1. **Backend (FastAPI)**
   ```bash
   python -m pip install -r backend/requirements.txt
   uvicorn backend.main:app --reload --port 8000
   ```

2. **Frontend (Next.js)**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000).

### Running Tests

```bash
python -m pytest backend/tests -v
```

### Deployment (Fly.io)

Pushing to `main` triggers [.github/workflows/deploy.yml](.github/workflows/deploy.yml), which runs backend tests, lints the frontend, and deploys via `flyctl deploy --remote-only` (requires the `FLY_API_TOKEN` repository secret).

To persist generated videos across machine restarts on Fly.io, create the `video_data` volume referenced in `fly.toml`:

```bash
fly volumes create video_data --size 1 --region sin
```

## Structured Prompt JSON Example

The `/api/amma-is-my-first-love` endpoint accepts a multipart `audio_file` along with an optional `payload` JSON matching the `VideoPrompt` schema:

```json
{
  "prompt": "Create a neon kinetic lyric video synced to the beat",
  "settings": {
    "background": {
      "type": "gradient",
      "value": "#0f0c29, #302b63"
    },
    "font": {
      "family": "Montserrat",
      "size": 48,
      "color": "#00ff99",
      "style": "neon"
    },
    "lyricsStyle": {
      "animation": "kinetic",
      "syncWithAudio": true,
      "position": "center"
    },
    "effects": {
      "type": ["bloom", "particle"]
    }
  },
  "metadata": {
    "title": "Neon Night",
    "description": "AI-generated lyric video",
    "tags": ["neon", "kinetic", "lyrics"]
  }
}
```

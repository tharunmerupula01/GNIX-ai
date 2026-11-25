# Gnix Engine Specification (Single Source of Truth)

## Data Contracts

```json
// SubWord – a tokenized fragment of a lyric word
{
  "text": "string",
  "start": "number",
  "end": "number"
}
```

```json
// LyricWord – a full lyric token with positioning and animation metadata
{
  "id": "string",
  "text": "string",
  "start": "number",
  "end": "number",
  "subWords": ["SubWord"],
  "x": "number",
  "y": "number",
  "fontSize": "number",
  "isHero": "boolean",
  "animationStyle": "gnix-editorial | editorial-karaoke | liquid-stretch | blur-reveal | kinetic-pop | minimal-fade",
  "inAnimation": "fade | pop | blur | slide-up",
  "outAnimation": "fade | blur"
}
```

```json
// BeatEvent – a rhythmic cue for video‑audio sync
{
  "time": "number",
  "intensity": "number",
  "type": "kick | snare | onset"
}
```

```json
// RequirementsBlueprint – the mutable request payload for a Gnix session
{
  "session_id": "string",
  "audio_file": "string | null",
  "start_time": "number",
  "end_time": "number",
  "duration": "number",
  "lyrics_text": "string",
  "lyrics_mode": "custom | auto_transcribe | pending",
  "lyrics_verified": "boolean",
  "broll_name": "string",
  "custom_media": ["string"],
  "accent_color": "string",
  "anim_style": "string",
  "aspect_ratio": "9:16 | 16:9 | 1:1",
  "missing_fields": ["string"],
  "ready_to_generate": "boolean"
}
```

```json
// GnixAgentResponse – the canonical reply from the engine
{
  "status": "ok",
  "session_id": "string",
  "reply": "string",
  "action": "gather_info | review_lyrics | execute_pipeline | edit_studio | concat_media",
  "blueprint": "RequirementsBlueprint",
  "suggested_actions": [{
    "label": "string",
    "prompt": "string"
  }],
  "status_steps": [{
    "step": "string",
    "label": "string",
    "state": "done | active | pending"
  }],
  "projectState": "ProjectState | null"
}
```

> [!NOTE] This file is the **single source of truth** for all JSON contracts used across the Gnix backend. Any change to the schema must be reflected here first.

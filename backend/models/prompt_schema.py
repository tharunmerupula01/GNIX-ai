from pydantic import BaseModel, Field, validator
from typing import List, Literal, Optional

class Background(BaseModel):
    type: Literal['image', 'color', 'gradient', 'video']
    value: str  # URL for image/video or CSS color/gradient string

class Font(BaseModel):
    family: str = Field(..., description="Font family name, e.g., 'Montserrat'")
    size: int = Field(..., gt=0, description="Font size in pixels")
    color: str = Field(..., description="CSS color string, e.g., '#00ff99'")
    style: Literal['solid', 'neon', 'glow', 'outline']

class LyricsStyle(BaseModel):
    animation: Literal['kinetic', 'bounce', 'fade', 'typewriter']
    syncWithAudio: bool = True
    position: Literal['center', 'bottom', 'top']

class Effects(BaseModel):
    type: List[Literal['strobe', 'particle', 'glitch', 'bloom']]

class Settings(BaseModel):
    background: Background
    font: Font
    lyricsStyle: LyricsStyle
    effects: Effects

class Metadata(BaseModel):
    title: Optional[str]
    description: Optional[str]
    tags: Optional[List[str]]

class VideoPrompt(BaseModel):
    prompt: str = Field(..., min_length=10, max_length=500)
    settings: Settings
    metadata: Optional[Metadata]

    @validator('prompt')
    def strip_prompt(cls, v: str) -> str:
        return v.strip()

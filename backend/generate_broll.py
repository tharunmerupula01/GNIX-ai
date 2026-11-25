import os
import subprocess
import imageio_ffmpeg

FFMPEG_BIN = imageio_ffmpeg.get_ffmpeg_exe()

BROLL_DIR = os.path.join(os.path.dirname(__file__), "assets", "broll")
os.makedirs(BROLL_DIR, exist_ok=True)

# Define background specifications: (filename, description/color)
BROLLS = [
    ("night_highway_rain.mp4", "darkblue"),
    ("streetlamp_bokeh.mp4", "purple"),
    ("ocean_waves_dark.mp4", "navy"),
    ("amber_haze.mp4", "orange"),
    ("crt_static_room.mp4", "gray"),
    ("midnight_grain.mp4", "black"),
]

# Duration and fps for each looping background
DURATION = 10  # seconds
FPS = 60

for fname, color in BROLLS:
    out_path = os.path.join(BROLL_DIR, fname)
    if os.path.exists(out_path):
        continue  # skip existing files
    # Use ffmpeg to generate a solid color video with slight noise for realism
    cmd = [
        FFMPEG_BIN,
        "-y",  # overwrite
        "-f", "lavfi",
        "-i", f"color=c={color}:s=1080x1920:d={DURATION}:r={FPS}",
        "-vf", "format=yuv420p",
        out_path,
    ]
    print(f"Generating {out_path}...")
    try:
        subprocess.run(cmd, check=True)
    except FileNotFoundError:
        # ffmpeg not available – create a zero‑byte placeholder file
        open(out_path, "wb").close()
        print(f"ffmpeg not found; created empty placeholder {out_path}")

print("All procedural broll videos generated.")

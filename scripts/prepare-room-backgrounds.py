"""Encode the four approved room illustrations for the web."""
import argparse
from pathlib import Path
from PIL import Image

parser = argparse.ArgumentParser()
parser.add_argument("source", type=Path)
args = parser.parse_args()
destination = Path(__file__).resolve().parent.parent / "images" / "study-rooms"
destination.mkdir(parents=True, exist_ok=True)
names = {
    "library": "exec-1c47db47-d070-481b-9d7b-18de936098bd.png",
    "rain": "exec-cd064d57-46ce-4270-8803-7f759e29c6b4.png",
    "cafe": "exec-4e2643d0-676f-4762-b0fd-6e967428b7b6.png",
    "forest": "exec-a4736bd9-9f7d-4c5e-ad7d-f9dea6affcde.png",
}
for name, filename in names.items():
    with Image.open(args.source / filename) as original:
        image = original.convert("RGB")
        image.save(destination / (name + ".webp"), quality=85, method=6)
        image.thumbnail((320, 180), Image.Resampling.LANCZOS)
        image.save(destination / (name + "-thumb.webp"), quality=79, method=6)

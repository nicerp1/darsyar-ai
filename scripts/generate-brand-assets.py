from pathlib import Path
from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets/brand/darsyar-logo.png"
NAVY = (3, 16, 55, 255)


def contain(image: Image.Image, size: tuple[int, int], ratio: float = 1.0) -> Image.Image:
    canvas = Image.new("RGBA", size, (0, 0, 0, 0))
    limit = (max(1, int(size[0] * ratio)), max(1, int(size[1] * ratio)))
    layer = image.copy()
    layer.thumbnail(limit, Image.Resampling.LANCZOS)
    canvas.alpha_composite(layer, ((size[0] - layer.width) // 2, (size[1] - layer.height) // 2))
    return canvas


def save_png(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, "PNG", optimize=True)


master = Image.open(SOURCE).convert("RGBA")
master = contain(master, (1024, 1024))
save_png(master, ROOT / "assets/brand/darsyar-logo.png")

for size in (64, 192, 512):
    save_png(master.resize((size, size), Image.Resampling.LANCZOS), ROOT / f"icons/icon-{size}.png")

densities = {
    "mdpi": (48, 108),
    "hdpi": (72, 162),
    "xhdpi": (96, 216),
    "xxhdpi": (144, 324),
    "xxxhdpi": (192, 432),
}
for density, (launcher_size, foreground_size) in densities.items():
    folder = ROOT / f"android/app/src/main/res/mipmap-{density}"
    launcher = master.resize((launcher_size, launcher_size), Image.Resampling.LANCZOS)
    save_png(launcher, folder / "ic_launcher.png")

    round_mask = Image.new("L", (launcher_size, launcher_size), 0)
    ImageDraw.Draw(round_mask).ellipse((0, 0, launcher_size - 1, launcher_size - 1), fill=255)
    round_icon = Image.new("RGBA", (launcher_size, launcher_size), NAVY)
    round_icon.alpha_composite(launcher)
    round_icon.putalpha(round_mask)
    save_png(round_icon, folder / "ic_launcher_round.png")

    foreground = contain(master, (foreground_size, foreground_size), 0.68)
    save_png(foreground, folder / "ic_launcher_foreground.png")

for splash_path in (ROOT / "android/app/src/main/res").glob("drawable*/splash.png"):
    with Image.open(splash_path) as current:
        size = current.size
    splash = Image.new("RGBA", size, NAVY)
    mark = contain(master, size, 0.26)
    splash.alpha_composite(mark)
    save_png(splash.convert("RGB"), splash_path)

print("Brand assets generated successfully.")

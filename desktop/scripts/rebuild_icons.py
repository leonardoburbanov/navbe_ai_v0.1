"""Rebuild tight, sharp Navbe icons — crop by alpha so glow fringe is discarded."""
from __future__ import annotations

import struct
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "navbe_without_bg.png"
ICONS = ROOT / "src-tauri" / "icons"
ASSETS = ROOT / "src" / "assets"
PUBLIC = ROOT / "public"


def alpha_bbox(im: Image.Image, threshold: int = 40) -> tuple[int, int, int, int]:
    """Bounding box using alpha only (ignore RGB dirt in transparent pixels)."""
    arr = np.asarray(im)
    ys, xs = np.where(arr[:, :, 3] > threshold)
    if len(xs) == 0:
        raise SystemExit("no opaque pixels")
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def pack_square(crop: Image.Image, pad_ratio: float = 1.06) -> Image.Image:
    """Center crop on a transparent square with small padding."""
    cw, ch = crop.size
    side = int(max(cw, ch) * pad_ratio)
    side += side % 2
    out = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    out.paste(crop, ((side - cw) // 2, (side - ch) // 2), crop)
    return out


def main() -> None:
    src = Image.open(SRC).convert("RGBA")
    box = alpha_bbox(src, threshold=40)
    crop = src.crop(box)
    packed = pack_square(crop, pad_ratio=1.03)
    master = packed.resize((1024, 1024), Image.Resampling.LANCZOS)

    ASSETS.mkdir(parents=True, exist_ok=True)
    PUBLIC.mkdir(parents=True, exist_ok=True)
    ICONS.mkdir(parents=True, exist_ok=True)

    # Local master only (gitignored); UI gets a sharp mid-res copy
    master.save(ICONS / "app-icon-source.png")
    ui = master.resize((256, 256), Image.Resampling.LANCZOS)
    ui.save(ASSETS / "navbe-logo.png", optimize=True)
    ui.save(PUBLIC / "navbe-logo.png", optimize=True)

    sizes = [16, 24, 32, 48, 64, 128, 256]
    frames: list[Image.Image] = []
    for s in sizes:
        im = master.resize((s, s), Image.Resampling.LANCZOS)
        im = im.filter(
            ImageFilter.UnsharpMask(radius=max(0.45, s / 48), percent=180, threshold=1)
        )
        # Title-bar sizes: solid dark plate (Windows blurs transparent small icons)
        if s <= 48:
            bg = Image.new("RGBA", (s, s), (12, 12, 14, 255))
            bg.paste(im, (0, 0), im)
            frames.append(bg)
        else:
            frames.append(im)

    frames[-1].save(
        ICONS / "icon.ico",
        format="ICO",
        sizes=[(s, s) for s in sizes],
    )

    for s, name in [
        (32, "32x32.png"),
        (64, "64x64.png"),
        (128, "128x128.png"),
        (256, "128x128@2x.png"),
        (512, "icon.png"),
    ]:
        fg = master.resize((s, s), Image.Resampling.LANCZOS)
        fg = fg.filter(
            ImageFilter.UnsharpMask(radius=max(0.45, s / 64), percent=150, threshold=1)
        )
        tile = Image.new("RGBA", (s, s), (12, 12, 14, 255))
        tile.paste(fg, (0, 0), fg)
        tile.save(ICONS / name)

    with open(ICONS / "icon.ico", "rb") as f:
        count = struct.unpack("<HHH", f.read(6))[2]

    cw, ch = crop.size
    print(f"ok crop={cw}x{ch} packed={packed.size} ico={count}")
    frames[0].save(ICONS / "_preview16.png")
    frames[2].save(ICONS / "_preview32.png")
    master.save(ICONS / "_preview_master.png")


if __name__ == "__main__":
    main()

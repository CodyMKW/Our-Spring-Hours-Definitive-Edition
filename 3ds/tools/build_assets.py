#!/usr/bin/env python3
"""Convert the web assets into 3DS-sized PNGs.
   usage: python3 3ds/tools/build_assets.py [OUT_DIR]      (default 3ds/build/gfx)
   backgrounds/*.jpg   -> bg_<name>.png   400x240 (top-screen size, 16:9 cover-crop)
   characters/*.webp   -> ch_<id>.png     height <= 224, keeps alpha
   The CI then runs `tex3ds -f rgba8888 -z auto -o romfs/gfx/NAME.t3x NAME.png` on each."""
import os, sys
from PIL import Image
root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(root, "3ds", "build", "gfx")
os.makedirs(out, exist_ok=True)
n = 0
for f in sorted(os.listdir(os.path.join(root, "assets", "backgrounds"))):
    if not f.endswith(".jpg"): continue
    im = Image.open(os.path.join(root, "assets", "backgrounds", f)).convert("RGB")
    w, h = im.size; tw, th = 400, 240
    s = max(tw / w, th / h); im = im.resize((round(w * s), round(h * s)), Image.LANCZOS)
    l, t = (im.width - tw) // 2, (im.height - th) // 2
    im.crop((l, t, l + tw, t + th)).save(os.path.join(out, "bg_" + f[:-4] + ".png")); n += 1
for f in sorted(os.listdir(os.path.join(root, "assets", "characters"))):
    if not f.endswith(".webp"): continue
    im = Image.open(os.path.join(root, "assets", "characters", f)).convert("RGBA")
    bb = im.getbbox(); im = im.crop(bb) if bb else im
    s = 224 / im.height; im = im.resize((max(1, round(im.width * s)), 224), Image.LANCZOS)
    im.save(os.path.join(out, "ch_" + f[:-5] + ".png")); n += 1
print("wrote", n, "images to", out)

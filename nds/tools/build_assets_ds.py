#!/usr/bin/env python3
"""DS asset pipeline.  usage: build_assets_ds.py GFX_DIR OUT_DIR [FONT.ttf]
 - GFX_DIR: the 3DS-sized PNGs from 3ds/tools/build_assets.py (bg_*.png 400x240, ch_*.png, orb*.png)
 - OUT_DIR: gets gfx/NAME.img (custom raw format) and font.bin (pre-baked bitmap font) -> packed into the ROM's NitroFS

.img format (little endian):  u8 fmt (0 = RGB555 opaque, 1 = RGB555 + 8-bit alpha plane)  u8 pad  u16 logical_w u16 logical_h
                              u16 stored_w u16 stored_h  then stored_w*stored_h u16 pixels (bit15 set), then (fmt 1) stored_w*stored_h u8 alpha.
 'logical' = the 3DS-sized picture the game code positions; 'stored' = pre-shrunk for the 256x192 screens.
font.bin:  'OFNT' u16 nsizes u16 nglyphs ; nsizes x { u8 px, u8 ascent, u8 height, u8 pad, u32 table_off, u32 bitmaps_off }
           glyph table per size (sorted by codepoint), 16 bytes each: u32 cp, u8 adv, i8 bx, i8 by, u8 w, u8 h, u8[3] pad, u32 off(from bitmaps_off)"""
import os, struct, sys, glob, re
import numpy as np
from PIL import Image, ImageFont, ImageDraw

gfx, out = sys.argv[1], sys.argv[2]
fontpath = sys.argv[3] if len(sys.argv) > 3 else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
os.makedirs(os.path.join(out, "gfx"), exist_ok=True)

BAYER = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]], dtype=np.float32) / 16.0 - 0.5

def to555(rgb, dither=True):
    a = rgb.astype(np.float32)
    h, w, _ = a.shape
    if dither:
        t = np.tile(BAYER, (h // 4 + 1, w // 4 + 1))[:h, :w, None] * 8.0
        a = a + t
    q = np.clip(np.round(a / 255.0 * 31.0), 0, 31).astype(np.uint16)
    return (q[..., 0] | (q[..., 1] << 5) | (q[..., 2] << 10) | 0x8000).astype("<u2")

def stored_size(name, w, h):
    if name.startswith("bg_"): return 256, 154
    if name.startswith("orb128"): return 64, 64
    if name.startswith("orb"): return round(w * 0.8), round(h * 0.8)
    return max(1, round(w * 0.7)), max(1, round(h * 0.7))          # characters

n = 0; total = 0
for f in sorted(glob.glob(os.path.join(gfx, "*.png"))):
    name = os.path.basename(f)[:-4]
    im = Image.open(f); lw, lh = im.size
    sw, sh = stored_size(name, lw, lh)
    has_alpha = im.mode == "RGBA" and name.split("_")[0] != "bg"
    if has_alpha:
        rgba = im.convert("RGBA")
        # premultiply-free resize: resize colour with alpha-weighted blur-free approach (LANCZOS on RGBA is fine for these sprites)
        r = rgba.resize((sw, sh), Image.LANCZOS)
        arr = np.asarray(r); px = to555(arr[..., :3]); al = arr[..., 3].astype(np.uint8)
        data = struct.pack("<BBHHHH", 1, 0, lw, lh, sw, sh) + px.tobytes() + al.tobytes()
    else:
        r = im.convert("RGB").resize((sw, sh), Image.LANCZOS)
        px = to555(np.asarray(r))
        data = struct.pack("<BBHHHH", 0, 0, lw, lh, sw, sh) + px.tobytes()
    open(os.path.join(out, "gfx", name + ".img"), "wb").write(data); n += 1; total += len(data)
print("images:", n, "total %.2f MB" % (total / 1048576))

# ---------------- font
chars = set(chr(c) for c in range(32, 127))
srcs = [os.path.join(root, "3ds", "romfs", "story.js")] + glob.glob(os.path.join(root, "3ds", "source", "*.c")) + glob.glob(os.path.join(root, "3ds", "js", "*.js"))
for s in srcs:
    if os.path.exists(s):
        for ch in open(s, encoding="utf-8", errors="ignore").read():
            if ord(ch) >= 32 and ord(ch) != 127: chars.add(ch)
# keep only characters the font can draw
probe = ImageFont.truetype(fontpath, 16)
cps = []
for ch in sorted(chars, key=ord):
    if ord(ch) < 128 or probe.getmask(ch).getbbox() is not None or ch == " ": cps.append(ord(ch))
sizes = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 24, 26]
tables, bitmaps = [], bytearray()
hdr_sizes = []
for px in sizes:
    font = ImageFont.truetype(fontpath, px)
    asc, desc = font.getmetrics()
    tab = []
    for cp in cps:
        ch = chr(cp)
        adv = int(round(font.getlength(ch)))
        m = font.getmask(ch, mode="L")
        bb = font.getbbox(ch, anchor="ls")           # relative to baseline origin
        w, h = m.size
        if w == 0 or h == 0:
            tab.append((cp, adv, 0, 0, 0, 0, len(bitmaps))); continue
        # render onto a transparent canvas to get exact bitmap + offsets
        img = Image.new("L", (w + 4, h + 4), 0); d = ImageDraw.Draw(img); d.text((2, 2 + asc), ch, font=font, fill=255, anchor="ls")
        bx = bb[0]; by = bb[1]                       # by is negative above the baseline
        g = font.getmask(ch, mode="L"); gw, gh = g.size
        arr = np.array(g, dtype=np.uint8).reshape(gh, gw)
        off = len(bitmaps); bitmaps += arr.tobytes()
        tab.append((cp, adv, bx, -by, gw, gh, off))   # y offset: pixels above baseline
    hdr_sizes.append((px, asc, asc + desc)); tables.append(tab)
# serialise
head = b"OFNT" + struct.pack("<HH", len(sizes), len(cps))
table_base = len(head) + len(sizes) * 12
blob_tables = bytearray(); recs = []
for tab in tables:
    recs.append(table_base + len(blob_tables))
    for (cp, adv, bx, by, w, h, off) in tab:
        blob_tables += struct.pack("<IBbbBB3xI", cp, min(adv, 255), max(-128, min(127, bx)), max(-128, min(127, by)), w, h, off)
bitmaps_off = table_base + len(blob_tables)
sizerecs = b"".join(struct.pack("<BBBBII", px, min(asc, 255), min(hh, 255), 0, recs[i], bitmaps_off) for i, (px, asc, hh) in enumerate(hdr_sizes))
open(os.path.join(out, "font.bin"), "wb").write(head + sizerecs + bytes(blob_tables) + bytes(bitmaps))
print("font: %d glyphs x %d sizes, %.0f KB" % (len(cps), len(sizes), (len(head) + len(sizerecs) + len(blob_tables) + len(bitmaps)) / 1024))

#!/usr/bin/env python3
"""build_assets_gba.py GEN_DIR ASSETS_ROOT FONT.ttf OUT_DIR
Reads GEN_DIR/story_ids.json + story_chars.txt (from compile_story.js) and the web art in ASSETS_ROOT (repo root),
writes OUT_DIR/assets.bin and OUT_DIR/assets.h (offsets).

assets.bin layout (all little-endian, every blob 4-byte aligned):
  BG i   : 192 x u16 RGB555 palette, then 240x135 8-bit indices into palette entries 0..191
  CHAR i : 16 x u16 OBJ palette (entry 0 transparent), 64x96 4bpp as OBJ tiles: sprite A (64x64, 64 tiles) then sprite B (64x32, 32 tiles)
  FONT   : see font section in gba/README.md (glyph table sorted by codepoint, 2-bit alpha, 1 byte per pixel)
"""
import sys, json, struct, os
from PIL import Image, ImageFont, ImageDraw
import numpy as np

gen, root, fontpath, out = sys.argv[1:5]
os.makedirs(out, exist_ok=True)
ids = json.load(open(os.path.join(gen, "story_ids.json")))
chars = open(os.path.join(gen, "story_chars.txt"), encoding="utf8").read()
blob = bytearray(); hdr = []

def align():
    while len(blob) % 4: blob.append(0)
def add(b):
    align(); off = len(blob); blob.extend(b); return off
def rgb555(r, g, b): return (r >> 3) | ((g >> 3) << 5) | ((b >> 3) << 10)

BGW, BGH, NCOL = 240, 135, 192
for b in ids["bgs"]:
    im = Image.open(os.path.join(root, b["file"])).convert("RGB").resize((BGW, BGH), Image.LANCZOS)
    q = im.quantize(colors=NCOL, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.FLOYDSTEINBERG)
    pal = q.getpalette()[: NCOL * 3]; pal += [0] * (NCOL * 3 - len(pal))
    pb = b"".join(struct.pack("<H", rgb555(pal[i * 3], pal[i * 3 + 1], pal[i * 3 + 2])) for i in range(NCOL))
    px = np.array(q, dtype=np.uint8)
    px = np.minimum(px, NCOL - 1)
    hdr.append(("BG_" + b["id"], add(pb + px.tobytes())))

CW, CH_ = 64, 96
def tiles4(arr, w, h):          # arr: HxW uint8 (0..15) → 4bpp 8x8 tiles, row-major tile order
    out = bytearray()
    for ty in range(h // 8):
        for tx in range(w // 8):
            for y in range(8):
                row = arr[ty * 8 + y, tx * 8:tx * 8 + 8]
                for x in range(0, 8, 2): out.append(int(row[x]) | (int(row[x + 1]) << 4))
    return bytes(out)
for c in ids["chars"]:
    im = Image.open(os.path.join(root, c["file"])).convert("RGBA")
    bbox = im.getchannel("A").point(lambda v: 255 if v > 24 else 0).getbbox()
    if bbox: im = im.crop(bbox)
    sc = min(CW / im.width, CH_ / im.height)
    im = im.resize((max(1, round(im.width * sc)), max(1, round(im.height * sc))), Image.LANCZOS)
    canvas = Image.new("RGBA", (CW, CH_), (0, 0, 0, 0))
    canvas.paste(im, ((CW - im.width) // 2, CH_ - im.height), im)
    a = np.array(canvas.getchannel("A")) >= 110
    rgb = Image.new("RGB", (CW, CH_), (0, 0, 0)); rgb.paste(canvas.convert("RGB"), mask=canvas.getchannel("A").point(lambda v: 255 if v >= 110 else 0))
    q = rgb.quantize(colors=15, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.FLOYDSTEINBERG)
    pal = q.getpalette()[: 45]; pal += [0] * (45 - len(pal))
    idx = np.array(q, dtype=np.uint8) + 1
    idx[~a] = 0
    palb = struct.pack("<H", 0) + b"".join(struct.pack("<H", rgb555(pal[i * 3], pal[i * 3 + 1], pal[i * 3 + 2])) for i in range(15))
    hdr.append(("CHAR_" + c["id"], add(palb + tiles4(idx[:64], 64, 64) + tiles4(idx[64:], 64, 32))))


# ---------------- Blossom Drop orb sprites (drawn here; the GBA jar is the web jar at SCALE)
SCALE = 0.22
SS = 8
def lerp(a, b, t): return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))
def hex_rgb(h): h = h.lstrip("#"); return tuple(int(h[i:i + 2], 16) for i in range(0, 6, 2))
def orb_image(S, R, cols):
    n = S * SS; img = np.zeros((n, n, 4), dtype=np.float32)
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32); cx = cy = n / 2; Rr = R * SS
    d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
    hx, hy = cx - 0.32 * Rr, cy - 0.36 * Rr
    dh = np.sqrt((xx - hx) ** 2 + (yy - hy) ** 2) / (1.5 * Rr)
    t = np.clip(dh, 0, 1)[..., None]
    c0, c1, c2 = (np.array(hex_rgb(c), dtype=np.float32) for c in cols)
    col = np.where(t < 0.5, c0 + (c1 - c0) * (t / 0.5), c1 + (c2 - c1) * ((t - 0.5) / 0.5))
    inside = d <= Rr
    edge = (d > Rr - 1.3 * SS) & inside
    col = np.where(edge[..., None], c2 * 0.55, col)
    gl = (((xx - (cx - 0.36 * Rr)) / (0.22 * Rr)) ** 2 + ((yy - (cy - 0.42 * Rr)) / (0.13 * Rr)) ** 2) < 1
    col = np.where((gl & inside)[..., None], np.minimum(col * 0.35 + 255 * 0.65, 255), col)
    img[..., :3] = col; img[..., 3] = inside * 255
    im = Image.fromarray(img.astype(np.uint8), "RGBA").resize((S, S), Image.BOX)
    return im
def to_obj(im, ncol=15):
    a = np.array(im.getchannel("A")) >= 128
    rgb = Image.new("RGB", im.size, (0, 0, 0)); rgb.paste(im.convert("RGB"), mask=im.getchannel("A").point(lambda v: 255 if v >= 128 else 0))
    q = rgb.quantize(colors=ncol, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    pal = q.getpalette()[: ncol * 3]; pal += [0] * (ncol * 3 - len(pal))
    idx = np.array(q, dtype=np.uint8) + 1; idx[~a] = 0
    return idx, [0] + [rgb555(pal[i * 3], pal[i * 3 + 1], pal[i * 3 + 2]) for i in range(ncol)]
bdt = ids["bd"]["tiers"]
orb_tiles = bytearray(); orb_pal = bytearray(); orb_info = []
for k, t in enumerate(bdt):
    diam = 2 * t["r"] * SCALE; S = 8 if diam <= 8 else 16 if diam <= 16 else 32 if diam <= 32 else 64
    idx, pal = to_obj(orb_image(S, diam / 2, t["c24"]))
    orb_info.append((S, len(orb_tiles) // 32)); orb_tiles += tiles4(idx, S, S)
    orb_pal += b"".join(struct.pack("<H", c) for c in pal)
# extras: fireball 16x16 (pal bank 10), shelf block 32x8 (bank 11)
fire = orb_image(16, 7.5, ["#fff1b8", "#ff8a3d", "#c0301f"]); idx, pal = to_obj(fire); orb_info.append((16, len(orb_tiles) // 32)); orb_tiles += tiles4(idx, 16, 16); orb_pal += b"".join(struct.pack("<H", c) for c in pal)
stone = np.full((8, 32), 1, dtype=np.uint8); stone[0, :] = 2; stone[7, :] = 3; stone[:, 0] = 3; stone[:, 31] = 3
orb_info.append((32, len(orb_tiles) // 32)); orb_tiles += tiles4(stone, 32, 8)
orb_pal += b"".join(struct.pack("<H", c) for c in [0, rgb555(185, 160, 135), rgb555(215, 195, 170), rgb555(110, 90, 75)] + [0] * 12)
hdr.append(("ORBPAL", add(bytes(orb_pal))))
hdr.append(("ORBTILES", add(bytes(orb_tiles))))

# ---------------- font: 9px DejaVu Sans, 2-bit alpha stored as 1 byte per pixel
FS = 9
font = ImageFont.truetype(fontpath, FS, layout_engine=ImageFont.Layout.BASIC)
cps = sorted(set(chars) | set(chr(c) for c in range(32, 127)))
glyphs = []
for ch in cps:
    adv = font.getlength(ch)
    im = Image.new("L", (24, 20), 0); ImageDraw.Draw(im).text((4, 4), ch, font=font, fill=255)
    a = np.array(im)
    ys, xs = np.nonzero(a > 20)
    if len(xs) == 0: glyphs.append((ord(ch), int(round(adv)), 0, 0, 0, 0, b"")); continue
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    sub = a[y0:y1, x0:x1].astype(float) / 255
    lv = np.digitize(sub, [0.18, 0.5, 0.8]).astype(np.uint8)       # 0..3
    glyphs.append((ord(ch), int(round(adv)), int(x0 - 4), int(y0 - 4), int(x1 - x0), int(y1 - y0), lv.tobytes()))
tab = bytearray(); pix = bytearray()
for cp, adv, xo, yo, w, h, d in glyphs:
    tab += struct.pack("<IBbbBBH", cp, adv, xo, yo, w, h, len(pix)); pix += d    # 12 bytes
font_blob = struct.pack("<HBB", len(glyphs), FS, 0) + bytes(tab) + bytes(pix)
hdr.append(("FONT", add(font_blob)))

open(os.path.join(out, "assets.bin"), "wb").write(blob)
with open(os.path.join(out, "assets.h"), "w") as f:
    f.write("/* GENERATED by build_assets_gba.py */\n#pragma once\n")
    for n, o in hdr: f.write(f"#define OFF_{n.replace('-', '_')} {o}u\n")
    f.write("static const unsigned BG_OFF[] = { " + ", ".join(str(o) for n, o in hdr if n.startswith("BG_")) + " };\n")
    f.write("static const unsigned CHAR_OFF[] = { " + ", ".join(str(o) for n, o in hdr if n.startswith("CHAR_")) + " };\n")
    f.write("static const unsigned short CHAR_COL[] = { " + ", ".join(str(c["color"]) for c in ids["chars"]) + " };\n")
    f.write("/* orb sprite sheet: (size px, first tile) per tier 0..9, then fireball, stone shelf */\nstatic const unsigned char ORB_SIZE[] = { " + ", ".join(str(a) for a, b in orb_info) + " };\nstatic const unsigned short ORB_TILE[] = { " + ", ".join(str(b) for a, b in orb_info) + " };\n#define ORBTILES_BYTES " + str(len(orb_tiles)) + "u\n")
    f.write(f"#define ASSETS_SIZE {len(blob)}u\n")
print("assets.bin", len(blob) // 1024, "KB;", len(ids["bgs"]), "bgs,", len(ids["chars"]), "chars,", len(glyphs), "glyphs")

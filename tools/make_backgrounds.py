#!/usr/bin/env python3
"""
make_backgrounds.py — generates the extra backgrounds for the Definitive Edition.

Every new background is derived from one of the original 9 backgrounds (the ones
the original Gemini versions shipped with) using colour grading + procedural
lighting (lantern strings, stars, ash, bokeh, fog, glows). That keeps the art
style consistent with the originals.

Usage (from the repo root):
    pip install pillow numpy
    python3 tools/make_backgrounds.py            # build everything
    python3 tools/make_backgrounds.py home_night # build one

Output: assets/backgrounds/<name>.jpg   (1280x720)
"""
import sys, os, math, random
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BG = os.path.join(ROOT, "assets", "backgrounds")
W, H = 1280, 720
rng = np.random.default_rng(7)
random.seed(7)

# ---------------------------------------------------------------- helpers
def load(name):
    im = Image.open(os.path.join(BG, name + ".jpg")).convert("RGB").resize((W, H), Image.LANCZOS)
    return np.asarray(im, dtype=np.float32) / 255.0

def save(a, name):
    a = np.clip(a, 0, 1)
    Image.fromarray((a * 255 + 0.5).astype(np.uint8)).save(os.path.join(BG, name + ".jpg"), quality=90)
    print("wrote", name)

def luma(a):
    return a @ np.array([0.299, 0.587, 0.114], dtype=np.float32)

def blur(a, r):
    """gaussian blur on float array (H,W) or (H,W,3)"""
    if a.ndim == 2:
        im = Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8))
        return np.asarray(im.filter(ImageFilter.GaussianBlur(r)), dtype=np.float32) / 255
    out = np.stack([blur(a[..., i], r) for i in range(3)], axis=-1)
    return out

def tone(a, bright=1.0, contrast=1.0, sat=1.0, tint=(1, 1, 1), gamma=1.0, lift=(0, 0, 0)):
    a = np.clip(a, 0, 1) ** gamma
    l = luma(a)[..., None]
    a = l + (a - l) * sat
    a = (a - 0.5) * contrast + 0.5
    a = a * bright * np.array(tint, dtype=np.float32) + np.array(lift, dtype=np.float32)
    return np.clip(a, 0, 1)

def hue_shift(a, deg):
    im = Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8)).convert("HSV")
    h = np.asarray(im).astype(np.int32)
    h[..., 0] = (h[..., 0] + int(deg / 360 * 255)) % 256
    return np.asarray(Image.fromarray(h.astype(np.uint8), "HSV").convert("RGB"), dtype=np.float32) / 255

def screen(a, b):
    return 1 - (1 - a) * (1 - b)

def yy_xx():
    y, x = np.mgrid[0:H, 0:W].astype(np.float32)
    return y, x

def glow(a, cx, cy, r, color, strength=1.0, squash=1.0):
    """additive radial glow"""
    y, x = yy_xx()
    d = np.sqrt(((x - cx) / r) ** 2 + (((y - cy) / r) * squash) ** 2)
    g = np.exp(-d * d * 2.2) * strength
    return screen(a, g[..., None] * np.array(color, dtype=np.float32))

def bloom(a, thresh=0.65, radius=14, strength=0.7):
    l = luma(a)
    m = np.clip((l - thresh) / (1 - thresh), 0, 1)[..., None] * a
    return screen(a, blur(m, radius) * strength)

def vignette(a, amt=0.45, power=2.2):
    y, x = yy_xx()
    d = np.sqrt(((x - W / 2) / (W / 2)) ** 2 + ((y - H / 2) / (H / 2)) ** 2) / 1.41
    v = 1 - amt * np.clip(d, 0, 1) ** power
    return a * v[..., None]

def grain(a, amt=0.018):
    n = rng.normal(0, amt, (H, W, 1)).astype(np.float32)
    return a + n

def vgrad(top, bottom, y0=0.0, y1=1.0):
    y, _ = yy_xx()
    t = np.clip((y / H - y0) / (y1 - y0), 0, 1)[..., None]
    return np.array(top, dtype=np.float32) * (1 - t) + np.array(bottom, dtype=np.float32) * t

def layer_new():
    return Image.new("RGBA", (W, H), (0, 0, 0, 0))

def layer_to_arr(im):
    """returns (rgb premult-ish additive array)"""
    a = np.asarray(im, dtype=np.float32) / 255
    return a[..., :3] * a[..., 3:4]

def add_layer(a, im, glow_r=0, glow_strength=1.0):
    arr = layer_to_arr(im)
    out = screen(a, arr)
    if glow_r:
        out = screen(out, blur(arr, glow_r) * glow_strength)
    return out

def fog(a, color, density=0.35, y_center=0.7, spread=0.25, seed=1):
    y, x = yy_xx()
    r = np.random.default_rng(seed)
    noise = r.random((H // 24 + 2, W // 24 + 2)).astype(np.float32)
    noise = np.asarray(Image.fromarray((noise * 255).astype(np.uint8)).resize((W, H), Image.BICUBIC), dtype=np.float32) / 255
    noise = blur(noise, 20)
    band = np.exp(-((y / H - y_center) / spread) ** 2)
    f = np.clip((band * (0.55 + 0.9 * noise)) * density, 0, 1)[..., None]
    return a * (1 - f) + np.array(color, dtype=np.float32) * f

def particles(n, color, size=(1, 3), alpha=(120, 255), region=(0, 0, W, H), seed=3):
    r = random.Random(seed)
    im = layer_new()
    d = ImageDraw.Draw(im)
    for _ in range(n):
        x = r.uniform(region[0], region[2]); y = r.uniform(region[1], region[3])
        s = r.uniform(*size)
        al = int(r.uniform(*alpha))
        d.ellipse([x - s, y - s, x + s, y + s], fill=(*color, al))
    return im

def lantern_string(im, p0, p1, sag, count, colors, size=9, seed=0):
    """draws a catenary-ish string with lanterns hanging off it onto RGBA layer `im`"""
    r = random.Random(seed)
    d = ImageDraw.Draw(im)
    pts = []
    steps = 80
    for i in range(steps + 1):
        t = i / steps
        x = p0[0] + (p1[0] - p0[0]) * t
        y = p0[1] + (p1[1] - p0[1]) * t + sag * 4 * t * (1 - t)
        pts.append((x, y))
    d.line(pts, fill=(40, 25, 20, 230), width=2)
    for i in range(count):
        t = (i + 0.5) / count
        x = p0[0] + (p1[0] - p0[0]) * t
        y = p0[1] + (p1[1] - p0[1]) * t + sag * 4 * t * (1 - t)
        c = r.choice(colors)
        s = size * r.uniform(0.85, 1.15)
        d.line([(x, y), (x, y + 6)], fill=(40, 25, 20, 230), width=2)
        # lantern body
        d.rounded_rectangle([x - s * 0.7, y + 6, x + s * 0.7, y + 6 + s * 1.6], radius=s * 0.45, fill=(*c, 255))
        d.rounded_rectangle([x - s * 0.35, y + 8, x + s * 0.35, y + 4 + s * 1.5], radius=s * 0.3,
                            fill=(255, 235, 190, 255))
    return pts

def night_grade(a, strength=1.0, blue=(0.20, 0.30, 0.55), bright=0.42):
    a = tone(a, bright=bright, contrast=1.05, sat=0.7, gamma=1.15)
    l = luma(a)[..., None]
    tinted = l * np.array(blue, dtype=np.float32) * 3.2
    return a * (1 - 0.55 * strength) + tinted * (0.55 * strength) + 0.01

def stars(a, region, n=260, seed=5, sky_mask=None):
    r = random.Random(seed)
    im = layer_new()
    d = ImageDraw.Draw(im)
    for _ in range(n):
        x = r.uniform(region[0], region[2]); y = r.uniform(region[1], region[3])
        if sky_mask is not None and sky_mask[int(y), int(x)] < 0.5:
            continue
        s = r.choice([0.6, 0.8, 1.0, 1.4, 1.8]) * (1.0 if r.random() > 0.1 else 1.7)
        al = int(r.uniform(110, 255))
        col = r.choice([(255, 255, 255), (210, 225, 255), (255, 240, 215)])
        d.ellipse([x - s, y - s, x + s, y + s], fill=(*col, al))
    return add_layer(a, im, glow_r=2.2, glow_strength=1.2)

# ---------------------------------------------------------------- backgrounds
def home_night():
    a = load("home_day")
    a = night_grade(a, bright=0.46, blue=(0.2, 0.28, 0.52))
    # window: cool moonlight
    a = glow(a, 380, 230, 220, (0.25, 0.35, 0.6), 0.55)
    # warm lamp
    a = glow(a, 812, 195, 300, (1.0, 0.72, 0.38), 0.6)
    a = glow(a, 812, 215, 90, (1.0, 0.85, 0.55), 0.35)
    a = glow(a, 700, 520, 330, (1.0, 0.68, 0.34), 0.28, squash=1.6)   # lamp pooling on floor
    # laptop glow
    a = glow(a, 480, 450, 150, (0.35, 0.75, 0.95), 0.55)
    a = bloom(a, 0.7, 18, 0.35)
    a = vignette(a, 0.5)
    save(grain(a), "home_night")

def home_ruined():
    a = load("home_day")
    a = tone(a, bright=0.55, contrast=0.95, sat=0.32, tint=(0.95, 1.0, 1.08), gamma=1.1)
    a = fog(a, (0.45, 0.47, 0.5), 0.45, 0.55, 0.45, seed=4)
    # dust shafts from window
    shafts = np.zeros((H, W), dtype=np.float32)
    y, x = yy_xx()
    for k in range(5):
        x0 = 250 + k * 70
        ang = 0.55 + k * 0.03
        d = (x - (x0 + (y - 120) * ang))
        shafts += np.exp(-(d / 38) ** 2) * (y > 120) * np.clip(1 - (y - 120) / 520, 0, 1)
    shafts = blur(np.clip(shafts, 0, 1), 6)
    a = screen(a, shafts[..., None] * np.array([0.55, 0.52, 0.45]) * 0.35)
    a = screen(a, blur(layer_to_arr(particles(260, (255, 240, 210), (0.8, 2.2), (80, 200), (150, 100, 900, 640), 8)), 1.2))
    a = vignette(a, 0.65)
    save(grain(a, 0.03), "home_ruined")

def courtyard_sunset():
    a = load("courtyard_day")
    a = tone(a, bright=0.78, contrast=1.1, sat=1.05, tint=(1.25, 0.88, 0.7), gamma=1.1)
    a = glow(a, 1100, 160, 420, (1.0, 0.6, 0.3), 0.55)
    a = bloom(a, 0.55, 22, 0.55)
    # drifting petals
    a = screen(a, blur(layer_to_arr(particles(110, (255, 205, 220), (1.5, 4), (140, 255), (0, 0, W, H), 12)), 0.9) * 1.2)
    a = vignette(a, 0.5)
    save(grain(a), "courtyard_sunset")

def courtyard_night():
    a = load("courtyard_day")
    a = night_grade(a, bright=0.40, blue=(0.17, 0.24, 0.50))
    # warm light pooling on tree + plaza from lantern strings
    a = glow(a, 880, 280, 330, (1.0, 0.62, 0.35), 0.55)
    a = glow(a, 700, 560, 480, (1.0, 0.55, 0.3), 0.35, squash=1.8)
    im = layer_new()
    cols = [(235, 70, 55), (255, 150, 60), (255, 200, 90), (235, 90, 110)]
    lantern_string(im, (-20, 120), (560, 90), 70, 11, cols, 10, 1)
    lantern_string(im, (540, 90), (1300, 130), 90, 14, cols, 10, 2)
    lantern_string(im, (-20, 250), (620, 210), 90, 10, cols, 9, 3)
    lantern_string(im, (600, 205), (1300, 280), 80, 12, cols, 9, 4)
    a = add_layer(a, im, glow_r=14, glow_strength=1.3)
    # bokeh
    bk = layer_new(); d = ImageDraw.Draw(bk)
    r = random.Random(21)
    for _ in range(46):
        x, y = r.uniform(0, W), r.uniform(380, 700)
        s = r.uniform(5, 16)
        c = r.choice([(255, 170, 90), (255, 120, 90), (255, 210, 130)])
        d.ellipse([x - s, y - s, x + s, y + s], fill=(*c, r.randint(40, 90)))
    a = add_layer(a, bk, glow_r=3, glow_strength=0.6)
    a = screen(a, blur(layer_to_arr(particles(60, (255, 210, 225), (1.2, 3), (120, 230), (0, 0, W, H), 15)), 0.8))
    a = bloom(a, 0.5, 20, 0.6)
    a = vignette(a, 0.55)
    save(grain(a), "courtyard_night")

def courtyard_ruined():
    a = load("courtyard_day")
    a = tone(a, bright=0.62, contrast=1.0, sat=0.38, tint=(1.0, 1.0, 0.98), gamma=1.15)
    # overcast sky: pull the bright top down to ash grey
    sky = vgrad((0.40, 0.40, 0.42), (0.0, 0.0, 0.0), 0.0, 0.45)[..., 0:1]
    mask = np.clip(1 - np.arange(H)[:, None] / (H * 0.38), 0, 1)[..., None]
    a = a * (1 - mask * 0.55) + np.array([0.33, 0.33, 0.35]) * mask * 0.55
    # keep the cherry tree faintly pink
    y, x = yy_xx()
    tree = np.exp(-(((x - 880) / 230) ** 2 + ((y - 250) / 150) ** 2))[..., None]
    a = a + tree * np.array([0.11, 0.02, 0.05]) * 1.4
    a = fog(a, (0.5, 0.5, 0.52), 0.5, 0.45, 0.4, seed=9)
    # ash flakes
    a = screen(a, blur(layer_to_arr(particles(240, (210, 210, 215), (0.8, 2.4), (60, 190), (0, 0, W, H), 18)), 0.9))
    a = vignette(a, 0.7)
    save(grain(a, 0.03), "courtyard_ruined")

def rooftop_night():
    src = load("rooftop_sunset")
    # sky mask: bright + saturated regions in the upper area right of the building
    l = luma(src)
    y, x = yy_xx()
    sky = ((l > 0.28) & (y < H * 0.52) & (x > 330)).astype(np.float32)
    sky = blur(sky, 4)
    a = hue_shift(src, 190)  # orange -> blue
    a = tone(a, bright=0.5, contrast=1.1, sat=0.95, gamma=1.2, tint=(0.8, 0.9, 1.15))
    # deep dusk gradient in the sky
    grad = vgrad((0.03, 0.05, 0.16), (0.14, 0.17, 0.36), 0.0, 0.52)
    a = a * (1 - sky[..., None] * 0.65) + grad * sky[..., None] * 0.65
    a = stars(a, (330, 0, W, int(H * 0.36)), 170, 6, sky)
    # horizon afterglow
    a = glow(a, 700, 360, 380, (0.35, 0.3, 0.6), 0.45, squash=2.5)
    # city lights
    cl = layer_new(); d = ImageDraw.Draw(cl); r = random.Random(33)
    for _ in range(150):
        x0 = r.uniform(340, W - 20); y0 = r.uniform(345, 400)
        d.rectangle([x0, y0, x0 + 2, y0 + 2], fill=(255, r.randint(190, 235), r.randint(120, 170), r.randint(90, 200)))
    a = add_layer(a, cl, glow_r=2.5, glow_strength=1.1)
    # lit windows on left building
    wl = layer_new(); d = ImageDraw.Draw(wl)
    for _ in range(36):
        x0 = r.uniform(0, 150); y0 = r.uniform(20, 340)
        d.rectangle([x0, y0, x0 + 12, y0 + 16], fill=(255, 215, 140, r.randint(90, 200)))
    a = add_layer(a, wl, glow_r=6, glow_strength=0.8)
    # cool moon-light over floor tiles
    a = glow(a, 640, 640, 520, (0.35, 0.5, 0.85), 0.28, squash=3)
    a = bloom(a, 0.5, 20, 0.5)
    a = vignette(a, 0.5)
    save(grain(a), "rooftop_night")

def rooftop_garden():
    a = load("rooftop_sunset")
    a = tone(a, bright=0.97, contrast=1.05, sat=1.05, tint=(1.0, 1.02, 0.95))
    r = random.Random(40)
    fg = layer_new(); d = ImageDraw.Draw(fg)     # soft foreground foliage (out of focus)
    def bush(cx, cy, rw, rh, n, lo=14, hi=36):
        for _ in range(n):
            x = cx + r.gauss(0, rw); y = cy + r.gauss(0, rh)
            s_ = r.uniform(lo, hi); g = r.randint(50, 100)
            d.ellipse([x - s_, y - s_ * 0.75, x + s_, y + s_ * 0.75], fill=(16, g, 30, 255))
        for _ in range(int(n * 0.3)):
            x = cx + r.gauss(0, rw); y = cy + r.gauss(0, rh) - 10
            s_ = r.uniform(4, 11)
            d.ellipse([x - s_, y - s_, x + s_, y + s_], fill=(225, 140, 45, 140))
    for (cx, cy, rw, rh, n) in [(70, 705, 150, 36, 170), (1180, 700, 170, 40, 190), (640, 735, 220, 18, 90)]:
        bush(cx, cy, rw, rh, n)
    fgi = fg.filter(ImageFilter.GaussianBlur(3.2))
    # mid-ground planters + tomato bushes along the right railing, a touch sharper
    mg = layer_new(); d = ImageDraw.Draw(mg)
    for k in range(6):
        cx = 830 + k * 70
        d.rectangle([cx - 26, 600, cx + 26, 632], fill=(86, 46, 32, 255))
        for _ in range(26):
            x = cx + r.gauss(0, 20); y = 585 + r.gauss(0, 22)
            s_ = r.uniform(9, 19)
            d.ellipse([x - s_, y - s_ * 0.8, x + s_, y + s_ * 0.8], fill=(22, r.randint(72, 118), 34, 255))
        for _ in range(3):
            x = cx + r.gauss(0, 15); y = 590 + r.gauss(0, 14)
            d.ellipse([x - 5, y - 5, x + 5, y + 5], fill=(214, 52, 40, 255))
    mgi = mg.filter(ImageFilter.GaussianBlur(1.1))
    for layer_im in (mgi, fgi):
        layer = np.asarray(layer_im, dtype=np.float32) / 255
        a = a * (1 - layer[..., 3:4]) + layer[..., :3] * layer[..., 3:4]
    a = glow(a, 700, 360, 360, (1.0, 0.65, 0.3), 0.25, squash=2.2)
    a = vignette(a, 0.4)
    save(grain(a), "rooftop_garden")

def hallway_ruined():
    a = load("hallway")
    a = tone(a, bright=0.55, contrast=1.05, sat=0.45, tint=(1.05, 0.98, 0.9), gamma=1.15)
    a = fog(a, (0.55, 0.5, 0.45), 0.4, 0.6, 0.35, seed=12)
    a = glow(a, 560, 300, 330, (1.0, 0.8, 0.5), 0.35, squash=1.6)
    # dust motes
    a = screen(a, blur(layer_to_arr(particles(240, (255, 235, 200), (0.8, 2.2), (70, 200), (0, 0, W, H), 25)), 1.1))
    a = vignette(a, 0.65)
    save(grain(a, 0.03), "hallway_ruined")

def hideout_alert():
    a = load("hideout")
    a = tone(a, bright=0.78, contrast=1.15, sat=0.6, tint=(1.1, 0.7, 0.7), gamma=1.1)
    a = glow(a, 700, 360, 520, (1.0, 0.1, 0.1), 0.32, squash=1.3)
    a = bloom(a, 0.55, 16, 0.5)
    a = vignette(a, 0.7)
    save(grain(a, 0.025), "hideout_alert")

def ruined_dawn():
    a = load("ruined_city")
    a = tone(a, bright=0.95, contrast=1.05, sat=0.9, tint=(1.18, 1.0, 0.82), gamma=1.0)
    a = glow(a, 700, 330, 520, (1.0, 0.72, 0.4), 0.75, squash=1.4)
    a = glow(a, 700, 300, 160, (1.0, 0.9, 0.65), 0.7)
    a = bloom(a, 0.45, 26, 0.7)
    a = vignette(a, 0.5)
    save(grain(a), "ruined_dawn")

def battlegrounds_dawn():
    a = load("battlegrounds")
    a = tone(a, bright=1.1, contrast=1.0, sat=0.75, tint=(1.1, 1.0, 0.88), gamma=0.95)
    a = glow(a, 640, 210, 600, (1.0, 0.78, 0.45), 0.7, squash=1.7)
    a = glow(a, 640, 190, 150, (1.0, 0.92, 0.7), 0.8)
    a = bloom(a, 0.5, 22, 0.6)
    a = vignette(a, 0.5)
    save(grain(a), "battlegrounds_dawn")

def battlegrounds_dusk():
    a = load("battlegrounds")
    a = tone(a, bright=0.55, contrast=1.1, sat=0.55, tint=(0.95, 0.9, 1.1), gamma=1.1)
    a = fog(a, (0.22, 0.2, 0.27), 0.45, 0.55, 0.35, seed=31)
    a = screen(a, blur(layer_to_arr(particles(180, (255, 140, 60), (0.8, 2.4), (90, 230), (0, 150, W, 650), 41)), 1.1))
    a = vignette(a, 0.7)
    save(grain(a, 0.03), "battlegrounds_dusk")

def forest_dusk():
    a = load("forest")
    a = tone(a, bright=0.82, contrast=1.08, sat=0.95, tint=(1.22, 0.98, 0.72), gamma=1.05)
    a = glow(a, 560, 140, 460, (1.0, 0.7, 0.35), 0.55, squash=1.5)
    # fireflies
    ff = particles(70, (255, 235, 150), (1.2, 2.8), (150, 255), (0, 220, W, 660), 52)
    a = add_layer(a, ff, glow_r=5, glow_strength=2.0)
    a = bloom(a, 0.5, 20, 0.55)
    a = vignette(a, 0.55)
    save(grain(a), "forest_dusk")

def night_sky():
    """fully procedural: a starry night with aurora-ish haze and a moon. Used for memory interludes and endings."""
    a = vgrad((0.015, 0.02, 0.07), (0.10, 0.12, 0.28), 0.0, 1.0)
    y, x = yy_xx()
    aur = np.exp(-(((y - 260 - 60 * np.sin(x / 190)) / 90) ** 2)) * (0.5 + 0.5 * np.sin(x / 130 + 1))
    a = a + aur[..., None] * np.array([0.05, 0.22, 0.28]) * 0.7
    a = stars(a, (0, 0, W, H * 0.8), 520, 71)
    a = glow(a, 980, 150, 120, (0.9, 0.92, 1.0), 0.85)
    a = glow(a, 980, 150, 36, (1.0, 1.0, 1.0), 1.0)
    a = glow(a, 980, 150, 320, (0.4, 0.5, 0.9), 0.3)
    # silhouetted hills
    hills = np.zeros((H, W), dtype=np.float32)
    ridge = 560 + 40 * np.sin(np.arange(W) / 140.0) + 24 * np.sin(np.arange(W) / 53.0 + 2)
    hills[y > ridge[None, :]] = 1
    hills = blur(hills, 1.2)[..., None]
    a = a * (1 - hills) + np.array([0.01, 0.015, 0.04]) * hills
    a = screen(a, blur(layer_to_arr(particles(50, (255, 205, 225), (1.5, 3.2), (110, 230), (0, 0, W, H), 72)), 0.8))
    a = vignette(a, 0.4)
    save(grain(a, 0.012), "night_sky")

ALL = {
    "home_night": home_night, "home_ruined": home_ruined,
    "courtyard_sunset": courtyard_sunset, "courtyard_night": courtyard_night, "courtyard_ruined": courtyard_ruined,
    "rooftop_night": rooftop_night, "rooftop_garden": rooftop_garden,
    "hallway_ruined": hallway_ruined, "hideout_alert": hideout_alert,
    "ruined_dawn": ruined_dawn, "battlegrounds_dawn": battlegrounds_dawn, "battlegrounds_dusk": battlegrounds_dusk,
    "forest_dusk": forest_dusk, "night_sky": night_sky,
}

if __name__ == "__main__":
    names = sys.argv[1:] or list(ALL)
    for n in names:
        ALL[n]()

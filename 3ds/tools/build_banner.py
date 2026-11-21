#!/usr/bin/env python3
"""HOME-menu banner assets for the CIA: banner.png (256x128) + banner.wav (short chime, <= 3 s).
   usage: python3 3ds/tools/build_banner.py [OUT_DIR]   (default 3ds/build)"""
import math, os, struct, sys, wave
from PIL import Image, ImageDraw, ImageFont
root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(root, "3ds", "build")
os.makedirs(out, exist_ok=True)

bg = Image.open(os.path.join(root, "assets", "backgrounds", "courtyard_bloom.jpg")).convert("RGB")
s = max(256 / bg.width, 128 / bg.height); bg = bg.resize((round(bg.width * s), round(bg.height * s)), Image.LANCZOS)
l, t = (bg.width - 256) // 2, (bg.height - 128) // 2
img = bg.crop((l, t, l + 256, t + 128)).convert("RGBA")
shade = Image.new("RGBA", img.size, (30, 10, 40, 110)); img.alpha_composite(shade)
d = ImageDraw.Draw(img)
def font(size):
    for p in ("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"):
        if os.path.exists(p): return ImageFont.truetype(p, size)
    return ImageFont.load_default()
def centered(text, y, size, fill):
    f = font(size); w = d.textlength(text, font=f)
    d.text(((256 - w) / 2 + 1, y + 1), text, font=f, fill=(0, 0, 0, 170)); d.text(((256 - w) / 2, y), text, font=f, fill=fill)
centered("Our Spring Hours", 34, 24, (255, 255, 255, 255))
centered("Definitive Edition + Blossom Drop", 70, 12, (255, 214, 228, 255))
img.convert("RGB").save(os.path.join(out, "banner.png"))

# 2.6 s spring chime (STEREO: mono banner audio is not played by HOME): bell-like arpeggio (E5 G#5 B5 E6 + high sparkles), stereo 16-bit 22050 Hz
rate = 22050; n = int(rate * 2.6); data = [0.0] * n
def bell(f, t0, dur, amp):
    for i in range(int(rate * dur)):
        j = int(t0 * rate) + i
        if j >= n: break
        t = i / rate; env = min(1, t / 0.004) * math.exp(-2.6 * t)
        v = math.sin(2 * math.pi * f * t) + 0.35 * math.sin(2 * math.pi * f * 2.76 * t) * math.exp(-6 * t) + 0.2 * math.sin(2 * math.pi * f * 4 * t) * math.exp(-9 * t)
        data[j] += v * amp * env
for f, t0 in ((659.25, 0.0), (830.61, 0.16), (987.77, 0.32), (1318.5, 0.48)): bell(f, t0, 1.8, 0.28)
for f, t0 in ((1975.5, 0.7), (2637.0, 0.82), (2349.3, 0.94), (3135.9, 1.06)): bell(f, t0, 1.0, 0.10)
for f in (329.63, 493.88): bell(f, 0.0, 2.4, 0.16)
pk = max(abs(v) for v in data); data = [v / pk * 0.92 for v in data]
for i in range(int(rate * 0.15)): data[n - 1 - i] *= i / (rate * 0.15)
with wave.open(os.path.join(out, "banner.wav"), "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(rate)
    w.writeframes(b"".join(struct.pack("<hh", *(2 * [max(-32767, min(32767, int(v * 32767)))])) for v in data))
print("wrote banner.png + banner.wav to", out)

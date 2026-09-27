"""Generates the bundled icons and tone files. Run: python3 scripts/generate-assets.py (needs Pillow).

Everything is generated locally so no remote fonts or images are needed (ARCH-011).
"""
import math
import os
import struct
import wave

from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(__file__), '..', 'assets')
BG = (15, 23, 32, 255)
ACCENT = (96, 165, 250, 255)
LIGHT = (191, 219, 254, 255)


def diamond(draw, cx, cy, w, h, fill, outline=None, width=0):
    top = (cx, cy - h * 0.5)
    mid_l = (cx - w * 0.5, cy - h * 0.18)
    mid_r = (cx + w * 0.5, cy - h * 0.18)
    bottom = (cx, cy + h * 0.5)
    draw.polygon([top, mid_r, bottom, mid_l], fill=fill, outline=outline, width=width)
    draw.line([mid_l, mid_r], fill=BG if fill != BG else ACCENT, width=max(2, int(w * 0.03)))


def icon(size, scale, bg=True, path='icon.png'):
    img = Image.new('RGBA', (size, size), BG if bg else (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    diamond(d, size / 2, size / 2, size * 0.55 * scale, size * 0.62 * scale, ACCENT)
    img.save(os.path.join(ROOT, path))


def notification_icon():
    size = 96
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx, cy, w, h = size / 2, size / 2, size * 0.7, size * 0.8
    d.polygon([(cx, cy - h / 2), (cx + w / 2, cy - h * 0.18), (cx, cy + h / 2), (cx - w / 2, cy - h * 0.18)], fill=(255, 255, 255, 255))
    img.save(os.path.join(ROOT, 'notification-icon.png'))


def tone(path, freqs, dur_s, rate=22050, vol=0.5):
    n = int(rate * dur_s)
    frames = bytearray()
    for i in range(n):
        t = i / rate
        f = freqs[0] + (freqs[-1] - freqs[0]) * (i / n)
        env = min(1.0, i / (rate * 0.01), (n - i) / (rate * 0.03))
        v = int(32767 * vol * env * math.sin(2 * math.pi * f * t))
        frames += struct.pack('<h', v)
    with wave.open(path, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(bytes(frames))


if __name__ == '__main__':
    os.makedirs(os.path.join(ROOT, 'sounds'), exist_ok=True)
    icon(1024, 1.0)
    icon(1024, 0.62, bg=False, path='adaptive-icon.png')
    icon(512, 0.9, bg=False, path='splash.png')
    notification_icon()
    tone(os.path.join(ROOT, 'sounds', 'squeeze.wav'), [660, 880], 0.25)
    tone(os.path.join(ROOT, 'sounds', 'release.wav'), [520, 390], 0.35)
    tone(os.path.join(ROOT, 'sounds', 'tick.wav'), [1000, 1000], 0.06, vol=0.3)
    tone(os.path.join(ROOT, 'sounds', 'done.wav'), [520, 780], 0.6)

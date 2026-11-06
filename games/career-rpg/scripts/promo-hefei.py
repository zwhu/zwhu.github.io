#!/usr/bin/env python3
"""Cut the Hefei square promo from the cinematic recording.

Reads games/career-rpg/web/review/cinematic/hefei.mp4 and writes
games/career-rpg/web/review/promo/hefei.mp4 plus one still per storyboard beat.

The picture is 1080×1080, five times the 216 capture, nearest-neighbor.
Title, skill names, the handbook list, and 「下一章：南京」 are drawn on that
pixel grid so they stay readable. Walking, sitting, map labels, narrow-wrap,
camera math, and the play path are not touched.

The score is synthesized here: square, triangle, and noise. No samples,
no borrowed melody. Seeded so a rerun matches.

  python3 games/career-rpg/scripts/promo-hefei.py
"""

import math
import random
import re
import struct
import subprocess
import wave
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[3]
SRC = ROOT / 'games/career-rpg/web/review/cinematic/hefei.mp4'
OUT_DIR = ROOT / 'games/career-rpg/web/review/promo'
STILL_DIR = OUT_DIR / 'stills'
VIDEO = OUT_DIR / 'hefei.mp4'
WAV = OUT_DIR / 'hefei-score.wav'
FONT = '/usr/share/fonts/truetype/wqy/wqy-microhei.ttc'

FPS = 30
SCALE = 5
GRID = 216
SIZE = GRID * SCALE
DURATION = 25.0
FRAMES = int(FPS * DURATION)
SR = 44100

INK = (41, 40, 37)
CREAM = (250, 248, 243)
PAPER = (232, 223, 200)
ACCENT = (166, 67, 53)

# On-screen copy. The old slogan and the old name are refused below.
TITLE = '《像素前端》'
CITY = '合肥'
NEXT = '下一章：南京'
HANDBOOK = '工作手册'
SKILLS = [
    ('linux', '精通 Linux 系统重装'),
    ('jquery', '熟练使用 jQuery 切西瓜'),
    ('java', '细品 Java'),
    ('sql', '问 SQL 你 No 不 No'),
]
BANNED = ('欢迎你游戏我的职业前半生', '一路写来')


def require_copy():
    shown = [TITLE, CITY, NEXT, HANDBOOK, *[name for _, name in SKILLS]]
    for text in shown:
        for banned in BANNED:
            if banned in text:
                raise SystemExit('banned copy in overlay: ' + banned)


def midi_of(name):
    match = re.fullmatch(r'([A-G])([#b]?)(-?\d)', name)
    if not match:
        raise ValueError(name)
    semis = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}[match.group(1)]
    accidental = match.group(2)
    if accidental == '#':
        semis += 1
    elif accidental == 'b':
        semis -= 1
    return 12 * (int(match.group(3)) + 1) + semis


def freq_of(name):
    return 440 * 2 ** ((midi_of(name) - 69) / 12)


def shift(name, semis):
    midi = midi_of(name) + semis
    letters = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
    return f'{letters[midi % 12]}{midi // 12 - 1}'


def synthesize():
    """Original 120 BPM pulse score, 25 seconds, stereo."""
    total = int(SR * DURATION)
    left = [0.0] * total
    right = [0.0] * total
    beat = 60 / 120
    rng = random.Random(216)

    def place(start_beat, beats, note, kind, vol, duty=0.5, pan=0.0):
        start = int(start_beat * beat * SR)
        length = int(beats * beat * SR)
        if length <= 8 or start >= total:
            return
        length = min(length, total - start)
        attack = min(int(0.01 * SR), length // 5)
        release = min(int(0.045 * SR), max(1, length // 3))
        freq = freq_of(note)
        phase = 0.0
        for i in range(length):
            if i < attack:
                env = i / attack
            elif i > length - release:
                env = (length - i) / release
            else:
                env = 1.0
            phase += freq / SR
            frac = phase - int(phase)
            if kind == 'triangle':
                sample = 4 * abs(frac - 0.5) - 1
            else:
                sample = 1.0 if frac < duty else -1.0
            sample *= vol * env
            # pan -1..1
            left[start + i] += sample * (1 - max(0, pan))
            right[start + i] += sample * (1 + min(0, pan))

    def hat(start_beat, vol, pan=0.35):
        start = int(start_beat * beat * SR)
        length = int(0.045 * SR)
        if start >= total:
            return
        length = min(length, total - start)
        for i in range(length):
            env = (1 - i / length) ** 2
            sample = rng.uniform(-1, 1) * vol * env
            left[start + i] += sample * (1 - max(0, pan))
            right[start + i] += sample * (1 + min(0, pan))

    # 0–3s title: a major arpeggio up and back down. Not a quoted sting.
    fanfare = [(0, 0.5, 'C5'), (0.5, 0.5, 'E5'), (1, 0.5, 'G5'), (1.5, 1.6, 'C6'),
               (3.2, 0.5, 'G5'), (3.7, 0.5, 'E5'), (4.2, 1.6, 'C5')]
    for start, dur, note in fanfare:
        place(start, dur, note, 'square', 0.16, 0.25, pan=-0.08)
        place(start, dur, shift(note, -12), 'square', 0.05, 0.5, pan=0.08)
    for step in range(6):
        for tone in ('C4', 'E4', 'G4'):
            place(step, 0.42, tone, 'square', 0.045, 0.25)

    # 3–8s walk, beats 6–16.
    roots = ['C2', 'C2', 'F2', 'F2', 'G2', 'G2', 'A2', 'A2', 'C2', 'C2']
    for index, root in enumerate(roots):
        place(6 + index, 0.48, root, 'triangle', 0.24)
        place(6 + index + 0.5, 0.42, shift(root, 7), 'triangle', 0.14)
    walk = [
        (6, 0.5, 'E5'), (6.5, 0.5, 'D5'), (7, 0.5, 'E5'), (7.5, 0.5, 'G5'),
        (8, 0.5, 'A5'), (8.5, 0.5, 'G5'), (9, 0.5, 'E5'), (9.5, 0.5, 'D5'),
        (10, 0.5, 'C5'), (10.5, 0.5, 'E5'), (11, 0.7, 'G5'), (11.8, 0.45, 'A5'),
        (12.3, 0.5, 'G5'), (12.8, 0.5, 'E5'), (13.3, 0.45, 'D5'), (13.8, 1.1, 'C5'),
        (15, 0.5, 'E5'), (15.5, 0.5, 'G5'),
    ]
    for start, dur, note in walk:
        place(start, dur, note, 'square', 0.13, 0.25, pan=-0.12)
    for step in range(6, 16):
        hat(step, 0.09, pan=0.15)
        hat(step + 0.5, 0.045, pan=0.45)

    # 8–20s, four skill phrases of 6 beats. Each opens with its own little run.
    phrase_roots = ['C2', 'F2', 'G2', 'C2']
    phrase_tune = [
        (0.5, 0.5, 'G5'), (1, 0.5, 'A5'), (1.5, 0.5, 'C6'), (2, 0.5, 'A5'),
        (2.5, 0.5, 'G5'), (3, 0.5, 'E5'), (3.5, 0.5, 'D5'), (4, 0.5, 'C5'),
        (4.5, 0.5, 'E5'), (5, 0.9, 'G5'),
    ]
    for rep, root in enumerate(phrase_roots):
        origin = 16 + rep * 6
        place(origin, 0.16, 'C6', 'square', 0.12, 0.125, pan=-0.2)
        place(origin + 0.16, 0.16, 'E6', 'square', 0.12, 0.125, pan=0.0)
        place(origin + 0.32, 0.18, 'G6', 'square', 0.11, 0.125, pan=0.2)
        hat(origin, 0.14, pan=0.2)
        for offset, dur, note in phrase_tune:
            place(origin + offset, dur, note, 'square', 0.13, 0.25, pan=-0.1)
        for step in range(6):
            bass = root if step % 2 == 0 else shift(root, 7)
            place(origin + step, 0.46, bass, 'triangle', 0.2)
            hat(origin + step, 0.07, pan=0.1)
            hat(origin + step + 0.5, 0.035, pan=0.4)

    # 20–22.4s handbook, beats 40–44.8. Triangle only.
    for start, dur, note, vol in (
        (40, 1.15, 'E5', 0.16), (41.2, 1.15, 'G5', 0.15),
        (42.4, 1.15, 'A5', 0.14), (43.6, 1.15, 'G5', 0.12),
    ):
        place(start, dur, note, 'triangle', vol, pan=-0.05)
    place(40, 4.6, 'C4', 'triangle', 0.09)
    place(40, 4.6, 'G3', 'triangle', 0.06)

    # 22.4–25s journey, beats 44.8–50. Rise, then a held chord that ends clean.
    rise = [(44.8, 0.4, 'C5'), (45.2, 0.4, 'E5'), (45.6, 0.4, 'G5'), (46.0, 0.45, 'C6')]
    for start, dur, note in rise:
        place(start, dur, note, 'square', 0.15, 0.25, pan=-0.08)
    for tone, vol in (('C4', 0.06), ('E4', 0.05), ('G4', 0.05), ('C5', 0.07), ('E5', 0.05)):
        place(46.5, 2.7, tone, 'square', vol, 0.25)
    place(46.5, 2.6, 'C2', 'triangle', 0.22)
    place(46.5, 2.2, 'G2', 'triangle', 0.1)
    hat(44.8, 0.08)
    hat(46.5, 0.1)

    def shape(channel):
        # One-pole, about 6.5 kHz, so the pulse is bright without a razor edge.
        alpha = (1 / SR) / (1 / (2 * math.pi * 6500) + 1 / SR)
        follow = 0.0
        for index, sample in enumerate(channel):
            follow += alpha * (sample - follow)
            channel[index] = follow

    shape(left)
    shape(right)
    peak = max(1e-6, max(max(abs(s) for s in left), max(abs(s) for s in right)))
    gain = 0.89 / peak
    pcm = bytearray()
    for a, b in zip(left, right):
        pcm += struct.pack('<hh', int(a * gain * 32767), int(b * gain * 32767))
    with wave.open(str(WAV), 'w') as handle:
        handle.setnchannels(2)
        handle.setsampwidth(2)
        handle.setframerate(SR)
        handle.writeframes(pcm)
    return peak


def text_sprite(text, font_px, color, max_w, thresh=108):
    """Draw type, collapse it onto the 216 grid, keep the ink pixels.

    Large titles stay crisp at a high threshold. Smaller Chinese needs a
    lower one, or strokes like 重 disappear into a block.
    """
    font_px = int(font_px)
    while font_px >= 28:
        font = ImageFont.truetype(FONT, font_px)
        probe = ImageDraw.Draw(Image.new('L', (4, 4)))
        box = probe.textbbox((0, 0), text, font=font)
        width = box[2] - box[0] + 8
        height = box[3] - box[1] + 8
        mask = Image.new('L', (width, height), 0)
        ImageDraw.Draw(mask).text((4 - box[0], 4 - box[1]), text, font=font, fill=255)
        grid_w = max(1, math.ceil(mask.width / SCALE))
        grid_h = max(1, math.ceil(mask.height / SCALE))
        if grid_w <= max_w or font_px <= 28:
            small = mask.resize((grid_w, grid_h), Image.Resampling.BOX)
            out = Image.new('RGBA', (grid_w, grid_h), (0, 0, 0, 0))
            src = small.load()
            dst = out.load()
            for y in range(grid_h):
                for x in range(grid_w):
                    if src[x, y] >= thresh:
                        dst[x, y] = (*color, 255)
            return out
        font_px -= 4
    raise RuntimeError('text did not fit: ' + text)


def paste_center(base, sprite, cx, cy):
    base.alpha_composite(sprite, (int(cx - sprite.width / 2), int(cy - sprite.height / 2)))


def rpg_border(image, inset=5):
    draw = ImageDraw.Draw(image)
    w, h = image.size
    draw.rectangle([inset, inset, w - 1 - inset, h - 1 - inset], outline=INK, width=2)
    inner = inset + 4
    draw.rectangle([inner, inner, w - 1 - inner, h - 1 - inner], outline=INK, width=1)


def title_card():
    card = Image.new('RGB', (GRID, GRID), PAPER)
    rpg_border(card)
    layer = Image.new('RGBA', (GRID, GRID), (0, 0, 0, 0))
    title = text_sprite(TITLE, 132, INK, 188)
    city = text_sprite(CITY, 96, ACCENT, 120)
    paste_center(layer, title, GRID / 2, 96)
    draw = ImageDraw.Draw(layer)
    rule = min(148, title.width + 8)
    draw.rectangle([(GRID - rule) // 2, 118, (GRID + rule) // 2, 119], fill=(*INK, 255))
    paste_center(layer, city, GRID / 2, 142)
    card.paste(layer, mask=layer)
    return card


def grab(start, duration):
    directory = Path('/tmp/hefei-promo-src')
    directory.mkdir(exist_ok=True)
    tag = f'{start:.2f}-{duration:.2f}'
    folder = directory / tag
    if folder.exists():
        frames = sorted(folder.glob('*.png'))
        if frames:
            return [Image.open(path).convert('RGB') for path in frames]
    folder.mkdir(exist_ok=True)
    subprocess.check_call([
        'ffmpeg', '-y', '-v', 'error', '-i', str(SRC),
        '-ss', f'{start:.3f}', '-t', f'{duration:.3f}',
        '-vf', f'fps={FPS}', '-start_number', '0', str(folder / '%04d.png'),
    ])
    frames = sorted(folder.glob('*.png'))
    if not frames:
        raise RuntimeError(f'no frames at {start}')
    return [Image.open(path).convert('RGB') for path in frames]


def still_at(start):
    path = Path('/tmp/hefei-promo-src') / f'still-{start:.2f}.png'
    path.parent.mkdir(exist_ok=True)
    if not path.exists():
        subprocess.check_call([
            'ffmpeg', '-y', '-v', 'error', '-i', str(SRC),
            '-ss', f'{start:.3f}', '-frames:v', '1', str(path),
        ])
    return Image.open(path).convert('RGB')


def fit_count(frames, count):
    if not frames:
        raise RuntimeError('empty clip')
    if len(frames) >= count:
        return frames[:count]
    return frames + [frames[-1]] * (count - len(frames))


def upscale(image):
    if image.size != (GRID, GRID):
        image = image.resize((GRID, GRID), Image.Resampling.NEAREST)
    return image.resize((SIZE, SIZE), Image.Resampling.NEAREST)


def name_plate(image, text):
    """Cover the clipped award line and the keyboard hint with the full name."""
    plate = image.copy()
    sample = plate.getpixel((GRID // 2, 78))
    draw = ImageDraw.Draw(plate)
    top = 108
    draw.rectangle([8, top, GRID - 9, GRID - 8], fill=sample)
    sprite = text_sprite(text, 90, INK, 192, thresh=70)
    layer = Image.new('RGBA', plate.size, (0, 0, 0, 0))
    paste_center(layer, sprite, GRID / 2, (top + GRID - 8) / 2)
    plate.paste(layer, mask=layer)
    return plate


def handbook_card(background):
    card = background.copy()
    # Keep the shelf and the head. The list sits on the lower half.
    dim = Image.blend(card, Image.new('RGB', card.size, INK), 0.28)
    heading = text_sprite(HANDBOOK, 80, ACCENT, 190, thresh=80)
    sprites = [text_sprite(name, 88, INK, 196, thresh=70) for _, name in SKILLS]
    gap = 3
    body = heading.height + 8 + sum(sprite.height + gap for sprite in sprites)
    panel = Image.new('RGB', (210, body + 14), CREAM)
    rpg_border(panel, inset=3)
    layer = Image.new('RGBA', panel.size, (0, 0, 0, 0))
    y = 10
    paste_center(layer, heading, panel.width / 2, y + heading.height / 2)
    y += heading.height + 8
    for sprite in sprites:
        paste_center(layer, sprite, panel.width / 2, y + sprite.height / 2)
        y += sprite.height + gap
    if y > panel.height - 4:
        raise RuntimeError('handbook list overflow')
    panel.paste(layer, mask=layer)
    dim.paste(panel, ((GRID - panel.width) // 2, GRID - panel.height - 6))
    return dim


def journey_caption(image):
    frame = image.copy()
    draw = ImageDraw.Draw(frame)
    draw.rectangle([0, 184, GRID - 1, GRID - 1], fill=INK)
    sprite = text_sprite(NEXT, 72, CREAM, 200)
    layer = Image.new('RGBA', frame.size, (0, 0, 0, 0))
    paste_center(layer, sprite, GRID / 2, 200)
    frame.paste(layer, mask=layer)
    return frame


def assemble():
    require_copy()
    if not SRC.exists():
        raise SystemExit('missing cinematic recording ' + str(SRC))
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    print('score', flush=True)
    peak = synthesize()
    print(f'score peak before normalize {peak:.2f}', flush=True)

    print('cuts', flush=True)
    walk = fit_count(grab(10.20, 5.05), 150)
    linux_lead = fit_count(grab(18.48, 0.90), 24)
    jquery_lead = fit_count(grab(23.40, 0.90), 24)
    java_lead = fit_count(grab(33.20, 0.90), 24)
    sql_lead = fit_count(grab(36.88, 0.90), 24)
    shelf = fit_count(grab(62.05, 0.90), 24)
    journey = fit_count(grab(50.58, 2.30), 66)
    awards = {
        'linux': name_plate(still_at(21.70), SKILLS[0][1]),
        'jquery': name_plate(still_at(29.30), SKILLS[1][1]),
        'java': name_plate(still_at(35.70), SKILLS[2][1]),
        'sql': name_plate(still_at(43.50), SKILLS[3][1]),
    }
    book = handbook_card(still_at(62.55))
    title = title_card()
    journey = [journey_caption(frame) for frame in journey]
    held = journey[-1]

    frames = []
    frames += [title] * 90
    frames += walk
    frames += linux_lead + [awards['linux']] * 66
    frames += jquery_lead + [awards['jquery']] * 66
    frames += java_lead + [awards['java']] * 66
    frames += sql_lead + [awards['sql']] * 66
    frames += shelf + [book] * 48
    frames += journey + [held] * 12
    if len(frames) != FRAMES:
        raise SystemExit(f'frame count {len(frames)} != {FRAMES}')

    folder = Path('/tmp/hefei-promo-out')
    if folder.exists():
        for old in folder.glob('*.png'):
            old.unlink()
    folder.mkdir(exist_ok=True)
    print('scale', flush=True)
    for index, frame in enumerate(frames):
        upscale(frame).save(folder / f'{index:04d}.png')
        if index % 150 == 0:
            print(f'  {index}/{FRAMES}', flush=True)

    print('encode', flush=True)
    subprocess.check_call([
        'ffmpeg', '-y', '-v', 'error',
        '-framerate', str(FPS), '-i', str(folder / '%04d.png'),
        '-i', str(WAV),
        '-t', f'{DURATION:.3f}',
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-tune', 'animation',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-b:a', '192k', '-ar', str(SR), '-ac', '2',
        '-movflags', '+faststart',
        '-metadata', 'title=像素前端 · 合肥',
        '-metadata', 'comment=Original 8-bit score synthesized for this promo.',
        str(VIDEO),
    ])

    STILL_DIR.mkdir(parents=True, exist_ok=True)
    stills = {
        '01-title.png': 1.50,
        '02-walk.png': 4.40,
        '02-desk.png': 7.05,
        '03-skill-linux.png': 9.70,
        '04-skill-jquery.png': 12.70,
        '05-skill-java.png': 15.70,
        '06-skill-sql.png': 18.70,
        '07-handbook.png': 21.60,
        '08-journey-nanjing.png': 24.20,
    }
    for name, at in stills.items():
        subprocess.check_call([
            'ffmpeg', '-y', '-v', 'error', '-ss', f'{at:.3f}', '-i', str(VIDEO),
            '-frames:v', '1', str(STILL_DIR / name),
        ])
    print('wrote', VIDEO)


if __name__ == '__main__':
    assemble()

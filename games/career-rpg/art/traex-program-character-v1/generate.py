#!/usr/bin/env python3
"""One hand-authored raster experiment. References are embedded, never decoded/drawn from."""
import base64
import hashlib
import json
import platform
import struct
import sys
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent
GAME = ROOT.parent.parent
W, H, SCALE = 48, 64, 6
P = {
    'ink': '#26211f', 'hair': '#272423', 'hair_dark': '#211f20',
    'hair_light': '#2d2926', 'skin': '#f1c5a1', 'skin_light': '#ffdbb6',
    'skin_shadow': '#d59b79', 'shirt': '#a14a39', 'shirt_light': '#b75942',
    'shirt_shadow': '#81382e', 'shirt_dark': '#593027', 'collar': '#f0e0c3',
    'collar_shadow': '#c4aa8b', 'trousers': '#434b55',
    'trousers_light': '#545c65', 'trousers_shadow': '#333a43',
    'boot': '#302b28', 'boot_light': '#4a3e36', 'sole': '#211e1d',
}


class Raster:
    def __init__(self, right=False):
        self.pixels = bytearray(W * H * 4)
        self.right = right

    def pixel(self, x, y, color):
        if self.right:
            x = W - 1 - x
        if 0 <= x < W and 0 <= y < H:
            i = (y * W + x) * 4
            self.pixels[i:i + 4] = bytes.fromhex(P.get(color, color).lstrip('#')) + b'\xff'

    def rect(self, x, y, w, h, color):
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                self.pixel(xx, yy, color)

    def poly(self, points, color):
        # Pixel-center scan conversion; integer grid, no antialiasing or source sampling.
        for y in range(min(p[1] for p in points), max(p[1] for p in points)):
            scan = y + .5
            intersections = []
            for a, b in zip(points, points[1:] + points[:1]):
                if min(a[1], b[1]) <= scan < max(a[1], b[1]):
                    intersections.append(a[0] + (scan - a[1]) * (b[0] - a[0]) / (b[1] - a[1]))
            intersections.sort()
            for left, right in zip(intersections[::2], intersections[1::2]):
                for x in range(int(left) - 1, int(right) + 1):
                    if left <= x + .5 < right:
                        self.pixel(x, y, color)


def front_body(r, back=False):
    # Legs, soles and independent feet share a y=61 baseline in every frame.
    r.poly([(16, 43), (32, 43), (32, 57), (34, 58), (34, 62),
            (25, 62), (25, 52), (23, 52), (23, 62), (14, 62), (14, 58), (16, 57)], 'ink')
    r.rect(17, 45, 14, 5, 'trousers')
    r.rect(17, 49, 6, 9, 'trousers')
    r.rect(25, 49, 6, 9, 'trousers')
    r.rect(18, 49, 2, 8, 'trousers_light')
    r.rect(26, 49, 2, 8, 'trousers_light')
    r.rect(22, 49, 1, 8, 'trousers_shadow')
    r.rect(30, 49, 1, 8, 'trousers_shadow')
    for x in (14, 25):
        r.rect(x, 58, 9, 4, 'sole')
        r.rect(x + 1, 58, 7, 3, 'boot')
        r.rect(x + 2, 59, 5, 1, 'boot_light')
    # Arms sit behind the torso. Cuffs remain red; hands are unobstructed.
    for mirrored in (False, True):
        arm = [(16, 30), (13, 32), (11, 37), (11, 44), (12, 45),
               (12, 49), (17, 49), (18, 45), (19, 33)]
        if mirrored:
            arm = [(48 - x, y) for x, y in arm][::-1]
        r.poly(arm, 'ink')
        x = 12 if not mirrored else 31
        r.rect(x, 37, 5, 7, 'shirt_shadow')
        r.rect(x + 1, 34, 4, 7, 'shirt')
        r.rect(x, 42, 5, 2, 'shirt_dark')
        r.rect(x + 1, 44, 4, 4, 'skin')
        r.rect(x + 1, 44, 1, 3, 'skin_light')
    r.poly([(18, 29), (30, 29), (33, 33), (33, 43),
            (31, 46), (17, 46), (15, 43), (15, 33)], 'shirt_dark')
    r.poly([(18, 31), (30, 31), (31, 34), (31, 42),
            (29, 44), (18, 44), (17, 41), (17, 34)], 'shirt')
    r.poly([(18, 32), (21, 32), (20, 36), (18, 39), (18, 42), (17, 40)], 'shirt_light')
    r.rect(29, 35, 2, 7, 'shirt_shadow')
    r.rect(19, 43, 10, 1, 'shirt_shadow')
    if back:
        r.rect(21, 29, 6, 2, 'shirt_dark')
        r.rect(22, 29, 4, 1, 'collar_shadow')
    else:
        r.rect(20, 27, 8, 4, 'skin_shadow')
        r.poly([(18, 30), (21, 30), (22, 31), (27, 31),
                (28, 30), (30, 30), (28, 33), (21, 33)], 'collar_shadow')
        r.poly([(20, 30), (23, 31), (27, 31), (29, 30), (27, 32), (22, 32)], 'collar')


def front_hair(r, back=False):
    silhouette = [(21, 5), (28, 5), (28, 6), (32, 6), (32, 8), (35, 8),
                  (35, 10), (38, 10), (38, 13), (40, 13), (40, 18),
                  (39, 18), (39, 22), (36, 22), (36, 25), (33, 25),
                  (33, 28), (29, 29), (18, 29), (15, 27), (13, 27),
                  (13, 24), (10, 24), (10, 20), (8, 20), (8, 16),
                  (9, 16), (9, 12), (12, 12), (12, 9), (16, 9), (16, 7), (21, 7)]
    r.poly(silhouette, 'hair_dark')
    r.poly([(21, 6), (27, 6), (27, 7), (31, 7), (31, 9), (34, 9),
            (34, 11), (37, 11), (37, 15), (39, 15), (38, 21), (35, 21),
            (35, 24), (32, 25), (31, 27), (20, 28), (16, 26), (14, 23),
            (11, 22), (10, 17), (12, 13), (15, 10), (19, 9)], 'hair')
    r.poly([(15, 11), (19, 9), (24, 9), (25, 10), (22, 11), (20, 14),
            (16, 15), (14, 17), (12, 17), (13, 14)], 'hair_light')
    if back:
        r.poly([(19, 24), (22, 25), (26, 24), (30, 25), (29, 27), (21, 28)], 'hair_dark')
        return
    r.poly([(17, 17), (30, 17), (33, 21), (33, 25), (30, 28),
            (27, 29), (20, 29), (17, 28), (14, 25), (14, 21)], 'ink')
    r.poly([(17, 18), (30, 18), (32, 21), (32, 25), (29, 27),
            (27, 28), (20, 28), (17, 26), (15, 24), (15, 21)], 'skin')
    r.rect(16, 23, 2, 3, 'skin_shadow')
    r.rect(29, 23, 2, 3, 'skin_shadow')
    r.rect(22, 26, 4, 1, 'skin_light')
    r.poly([(13, 15), (17, 14), (20, 15), (23, 14), (29, 15), (33, 17),
            (34, 22), (31, 21), (29, 18), (27, 19), (26, 23), (24, 23),
            (23, 21), (21, 21), (20, 18), (18, 19), (17, 22), (14, 23)], 'hair')
    r.rect(19, 22, 2, 4, 'ink')
    r.rect(27, 22, 2, 4, 'ink')


def side_body(r):
    r.poly([(20, 43), (30, 43), (30, 56), (31, 58), (32, 62),
            (15, 62), (15, 59), (19, 57)], 'ink')
    r.rect(21, 45, 8, 12, 'trousers')
    r.rect(21, 46, 2, 9, 'trousers_light')
    r.rect(27, 49, 2, 7, 'trousers_shadow')
    r.poly([(20, 57), (29, 57), (30, 59), (31, 61), (16, 61),
            (16, 60), (19, 59)], 'boot')
    r.rect(20, 59, 8, 1, 'boot_light')
    r.rect(15, 61, 17, 1, 'sole')
    r.poly([(21, 29), (28, 29), (31, 32), (32, 42), (31, 46),
            (19, 46), (18, 42), (19, 34)], 'shirt_dark')
    r.poly([(22, 31), (27, 31), (29, 34), (29, 43), (21, 44),
            (20, 42), (20, 35)], 'shirt')
    r.rect(20, 34, 2, 7, 'shirt_light')
    r.rect(19, 41, 3, 3, 'shirt_shadow')
    r.poly([(26, 32), (30, 32), (33, 36), (33, 43), (32, 45),
            (32, 49), (26, 49), (25, 46), (25, 38)], 'ink')
    r.poly([(27, 33), (30, 34), (32, 37), (32, 44), (26, 44), (26, 37)], 'shirt')
    r.rect(30, 37, 2, 6, 'shirt_shadow')
    r.rect(26, 42, 6, 2, 'shirt_dark')
    r.rect(27, 44, 4, 4, 'skin')
    r.rect(27, 44, 1, 3, 'skin_light')
    r.rect(21, 27, 5, 4, 'skin_shadow')
    r.poly([(20, 29), (23, 30), (27, 29), (28, 31), (23, 32), (20, 31)], 'collar_shadow')
    r.poly([(20, 29), (23, 30), (26, 29), (27, 30), (23, 31), (20, 30)], 'collar')


def side_hair(r):
    r.poly([(21, 5), (28, 5), (28, 6), (32, 6), (32, 8), (35, 8),
            (35, 11), (38, 11), (38, 16), (40, 16), (39, 21), (37, 21),
            (37, 25), (34, 25), (33, 28), (28, 30), (23, 29), (18, 28),
            (15, 27), (13, 24), (11, 24), (11, 20), (9, 20), (9, 15),
            (11, 15), (11, 12), (13, 12), (13, 9), (17, 9), (17, 7), (21, 7)], 'hair_dark')
    r.poly([(21, 6), (27, 6), (27, 7), (31, 7), (34, 10), (36, 12),
            (37, 17), (38, 19), (35, 23), (33, 26), (29, 28), (23, 28),
            (18, 25), (13, 23), (11, 19), (12, 15), (15, 10)], 'hair')
    r.poly([(17, 10), (21, 9), (25, 9), (26, 10), (22, 11),
            (19, 14), (14, 15), (13, 18), (12, 16)], 'hair_light')
    r.poly([(16, 17), (25, 18), (28, 22), (28, 26), (25, 28),
            (23, 29), (17, 29), (14, 27), (11, 25), (11, 23), (13, 22), (13, 19)], 'ink')
    r.poly([(16, 18), (24, 19), (27, 22), (27, 26), (24, 28),
            (18, 28), (15, 26), (12, 24), (14, 23), (14, 20)], 'skin')
    r.rect(18, 26, 3, 1, 'skin_light')
    r.rect(24, 24, 3, 2, 'skin_shadow')
    r.poly([(13, 15), (18, 14), (22, 16), (25, 16), (29, 18),
            (30, 24), (27, 24), (26, 22), (23, 23), (21, 22), (20, 19),
            (18, 18), (17, 21), (15, 21), (15, 19), (13, 20)], 'hair')
    r.rect(16, 22, 2, 4, 'ink')
    r.rect(25, 23, 2, 2, 'skin')


def render(direction):
    # Right recomputes reflected authored geometry; no existing raster is mirrored/copied.
    r = Raster(right=direction == 'right')
    if direction in ('down', 'up'):
        front_body(r, back=direction == 'up')
        front_hair(r, back=direction == 'up')
    else:
        side_body(r)
        side_hair(r)
    return r.pixels


def png(pixels, width, height):
    def chunk(kind, data):
        return struct.pack('!I', len(data)) + kind + data + struct.pack('!I', zlib.crc32(kind + data) & 0xffffffff)
    scan = b''.join(b'\x00' + pixels[y * width * 4:(y + 1) * width * 4] for y in range(height))
    return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('!2I5B', width, height, 8, 6, 0, 0, 0))
            + chunk(b'sRGB', b'\x00') + chunk(b'IDAT', zlib.compress(scan, 9)) + chunk(b'IEND', b''))


def data_uri(data):
    return 'data:image/png;base64,' + base64.b64encode(data).decode('ascii')


def main():
    frames = [render(d) for d in ('down', 'up', 'left', 'right')]
    width = W * 4
    strip = bytearray(width * H * 4)
    for n, frame in enumerate(frames):
        for y in range(H):
            a = (y * width + n * W) * 4
            strip[a:a + W * 4] = frame[y * W * 4:(y + 1) * W * 4]
    character = png(strip, width, H)
    (ROOT / 'character.png').write_bytes(character)
    # Only our own drawing is enlarged. The preview uses a neutral checkerboard for readability.
    pw, ph = width * SCALE, H * SCALE
    preview = bytearray(pw * ph * 4)
    for y in range(ph):
        for x in range(pw):
            src = ((y // SCALE) * width + x // SCALE) * 4
            value = strip[src:src + 4]
            if not value[3]:
                grey = 238 if (x // 24 + y // 24) % 2 else 219
                value = bytes((grey, grey, grey, 255))
            dest = (y * pw + x) * 4
            preview[dest:dest + 4] = value
    enlarged = png(preview, pw, ph)
    (ROOT / 'preview.png').write_bytes(enlarged)
    references = []
    for name in ('art/character-four-directions-v1.png',):
        original_bytes = (GAME / name).read_bytes()  # For comparison HTML only. No PNG decoding.
        references.append({'file': name, 'sha256': hashlib.sha256(original_bytes).hexdigest(), 'uri': data_uri(original_bytes)})
    tiles = ''.join(f'<figure><img width="192" height="256" alt="{name}站姿实验" src="{data_uri(png(frame, W, H))}"><figcaption>{name} · 48×64 · 脚底 y=61</figcaption></figure>'
                    for name, frame in zip(('向下', '向上', '向左', '向右'), frames))
    refs = ''.join(f'<figure><img alt="现有南京参考：{r["file"]}" src="{r["uri"]}"><figcaption>{r["file"]}</figcaption></figure>' for r in references)
    html = f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>南京主角 · 程序绘图实验</title>
<style>body{{margin:0;padding:24px;font:16px/1.7 system-ui,sans-serif;color:#282624;background:#f7f3ea}}main{{max-width:1200px;margin:auto}}h1{{font-size:26px}}h2{{font-size:20px}}.tiles,.references{{display:flex;flex-wrap:wrap;gap:16px}}figure{{margin:0;padding:12px;border:1px solid #d7d0c3;border-radius:8px;background:#fff}}.tiles img{{display:block;image-rendering:pixelated;background:repeating-conic-gradient(#eee 0% 25%,#dbdbdb 0% 50%) 0 0/16px 16px}}.references figure{{flex:1;min-width:260px}}.references img{{display:block;max-width:100%;max-height:700px;object-fit:contain;image-rendering:pixelated}}figcaption{{font-size:13px;color:#60584f;overflow-wrap:anywhere}}.sheet{{max-width:100%;image-rendering:pixelated}}code{{background:#eae4d9;padding:2px 5px}}</style></head><body><main>
<h1>南京主角 · 一次程序栅格绘图实验</h1><p>能力实验，未获作者/监督者美术认可，未替换游戏素材。四向轮廓由代码自行设计；参考仅用于视觉阅读和本页对照，没有取色、描摹、解码或抽取参考像素。</p>
<h2>实验输出：四向站姿</h2><div class="tiles">{tiles}</div><p>透明RGBA横向图集，顺序为下、上、左、右；各帧48×64，脚底统一在第61行。右向由同一套自绘几何反向计算。上方为4倍近邻显示，下方为6倍近邻预览。</p><img class="sheet" alt="自产四向图集6倍近邻棋盘预览" src="{data_uri(enlarged)}">
<h2>已存在的南京参考</h2><div class="references">{refs}</div>
<p>差距：手写几何的发束、衣褶与侧脸细节更少；原素材的头身、动作和风格一致性未经独立验收。本实验只有站姿，没有行走帧、NPC、表情、坐姿或游戏接入。</p><p>复现：<code>python3 generate.py</code>；仅需Python标准库，页面为内嵌图片，无脚本或外部网络依赖。</p></main></body></html>'''
    (ROOT / 'index.html').write_text(html, encoding='utf-8')
    entries = []
    for name, pixels, iw, ih in [('character.png', strip, width, H), ('preview.png', preview, pw, ph)]:
        content = (ROOT / name).read_bytes()
        entries.append({'file': name, 'width': iw, 'height': ih, 'bytes': len(content),
                        'rgba_colors': len({bytes(pixels[i:i + 4]) for i in range(0, len(pixels), 4)}),
                        'alpha_values': sorted({pixels[i + 3] for i in range(0, len(pixels), 4)}),
                        'sha256': hashlib.sha256(content).hexdigest(), 'decoded_rgba_sha256': hashlib.sha256(pixels).hexdigest()})
    frame_info = []
    for n, (name, frame) in enumerate(zip(('down', 'up', 'left', 'right'), frames)):
        occupied = [(i // 4 % W, i // 4 // W) for i in range(0, len(frame), 4) if frame[i + 3]]
        frame_info.append({'direction': name, 'rect': [n * W, 0, W, H], 'foot_baseline_y': max(y for _, y in occupied),
                           'bounding_box': [min(x for x, _ in occupied), min(y for _, y in occupied), max(x for x, _ in occupied), max(y for _, y in occupied)]})
    summary = {'status': 'independent_capability_experiment_not_approved_art', 'method': 'Hand-authored integer raster polygons; standard-library PNG RGBA writer; no antialiasing',
               'tool': 'Python standard library', 'runtime': {'python': sys.version.split()[0], 'implementation': platform.python_implementation(), 'zlib': zlib.ZLIB_RUNTIME_VERSION},
               'frame_dimensions': [W, H], 'directions': frame_info, 'assets': entries,
               'preview': {'nearest_neighbor_scale': SCALE, 'checkerboard_only_in_preview': True},
               'color_space': '8-bit RGBA, sRGB rendering intent0;19 authored opaque colors maximum plus transparent',
               'references': [{k: v for k, v in r.items() if k != 'uri'} for r in references],
               'references_used_in_drawing': False, 'source_pixels_decoded_copied_traced_or_resized_for_drawing': False,
               'production_replaced': False, 'network_or_dependencies_installed': False,
               'initial_drawings': 1, 'visual_corrections': 1, 'visual_self_review': {'status': 'pending_final_image_view', 'correction': 'Reduce hard hair highlight and chin stripe after initial image review.'},
               'limits': ['Four standing directions only; no walk/emotion/typing states.', 'Right profile uses reflected authored geometry, not independently asymmetric clothing/hair.', 'Reduced facial/hair/clothing detail and proportional fidelity need independent visual review.', 'No animation, scene integration, hardware, startup or game acceptance.'],
               'automation': 'paused', 'old_full_journey_goal': 'paused'}
    for name in ('generate.py', 'index.html'):
        data = (ROOT / name).read_bytes()
        summary.setdefault('other_files', []).append({'file': name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
    (ROOT / 'summary.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'status': summary['status'], 'files': [a['file'] for a in entries], 'dimensions': [width, H], 'colors': entries[0]['rgba_colors']}, ensure_ascii=False))


if __name__ == '__main__':
    main()

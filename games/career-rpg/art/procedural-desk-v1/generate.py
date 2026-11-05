"""Standard-library pixel drawing. No source-image pixels are used in the output."""
import hashlib
import json
import struct
import time
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent
W, H = 160, 128
INK = '#292b29'


def render(wood='#bc7948', screen='#354a54'):
    pixels = bytearray(W * H * 4)

    def rect(x, y, w, h, color):
        rgb = bytes.fromhex(color.lstrip('#')) + b'\xff'
        for yy in range(max(0, y), min(H, y + h)):
            for xx in range(max(0, x), min(W, x + w)):
                i = (yy * W + xx) * 4
                pixels[i:i + 4] = rgb

    def box(x, y, w, h, color, border=2):
        rect(x, y, w, h, INK)
        rect(x + border, y + border, w - border * 2, h - border * 2, color)

    # Rear supports, stepped desktop silhouette and front apron.
    for x in (14, 126):
        box(x, 68, 19, 37, '#825336', 3)
        rect(x + 4, 71, 4, 29, '#9d653e')
    box(27, 82, 105, 7, '#734a33')
    box(7, 31, 146, 45, wood, 3)
    rect(11, 35, 138, 3, '#d79a61')
    rect(11, 39, 138, 26, '#c68650')
    rect(11, 65, 138, 5, '#ac6a3e')
    rect(11, 70, 138, 2, '#704a33')
    # Sparse wood grain, kept away from object silhouettes.
    for x, y, n in [(15, 46, 12), (43, 66, 15), (113, 61, 26), (94, 42, 15), (17, 61, 8)]:
        rect(x, y, n, 1, '#b87846')
    # Monitor and stand.
    box(55, 5, 56, 37, '#3e515a', 3)
    rect(59, 9, 48, 4, '#607a86')
    rect(60, 15, 46, 22, screen)
    rect(61, 15, 2, 20, '#405762')
    rect(78, 42, 9, 8, INK)
    rect(80, 43, 5, 5, '#48616b')
    box(70, 48, 26, 4, '#516b76', 1)
    # Keyboard with individually placed key clusters.
    box(58, 53, 49, 11, '#405963')
    for row in range(2):
        for col in range(9):
            rect(62 + col * 4, 56 + row * 3, 3, 2, '#68828d' if (col + row) % 3 else '#536e79')
    rect(73, 61, 17, 1, '#81939a')
    # Books, staggered heights and cream page edges.
    for x, y, h, color in [(18, 19, 25, '#476574'), (26, 16, 28, '#ece0bf'), (34, 22, 22, '#c3bda8'), (42, 24, 20, '#ad583d')]:
        box(x, y, 9, h, color, 2)
        rect(x + 2, y + 2, 4, 2, '#f2e7ce')
    # Pen cup, three different pens, sticky-note pad.
    for x, y in [(122, 21), (129, 17), (135, 23)]:
        box(x, y, 3, 16, '#d19856', 1)
    box(119, 33, 24, 18, '#466b7b')
    rect(122, 36, 3, 11, '#5a8190')
    box(120, 56, 22, 12, '#e8bc63')
    rect(123, 59, 16, 5, '#f5d584')
    # Cup: handle behind body, stepped porcelain silhouette and coffee.
    box(37, 52, 6, 9, '#e4d7b7', 1)
    rect(39, 54, 2, 4, '#a36b41')
    box(21, 49, 17, 16, '#e9ddbf')
    rect(24, 48, 11, 2, INK)
    rect(24, 51, 10, 3, '#654d36')
    rect(24, 55, 3, 7, '#fff0d2')
    rect(25, 65, 9, 2, INK)
    # Chair: arms behind cushion, stepped back, upholstery and five-star base.
    box(60, 88, 7, 14, '#3c4b50')
    box(105, 88, 7, 14, '#3c4b50')
    box(65, 99, 43, 12, '#3e535d')
    rect(69, 102, 35, 4, '#607984')
    box(68, 71, 36, 33, '#3d535e', 3)
    rect(72, 75, 28, 4, '#5c7784')
    rect(72, 79, 3, 20, '#486470')
    rect(76, 99, 21, 2, '#66818a')
    box(82, 109, 9, 7, '#3c4748')
    rect(70, 117, 31, 4, INK)
    rect(66, 119, 8, 5, INK)
    rect(98, 119, 8, 5, INK)
    rect(83, 114, 6, 12, INK)
    rect(68, 121, 4, 2, '#47504b')
    rect(100, 121, 4, 2, '#47504b')
    return pixels


def png(pixels):
    def chunk(kind, data):
        return struct.pack('!I', len(data)) + kind + data + struct.pack('!I', zlib.crc32(kind + data) & 0xffffffff)
    scan = b''.join(b'\x00' + pixels[y * W * 4:(y + 1) * W * 4] for y in range(H))
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('!2I5B', W, H, 8, 6, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(scan, 9)) + chunk(b'IEND', b'')


if __name__ == '__main__':
    start = time.perf_counter()
    assets = []
    for name, wood, screen in [('desk-warm.png', '#bc7948', '#354a54'), ('desk-dark.png', '#986542', '#354a54'), ('desk-active.png', '#bc7948', '#466d7b')]:
        pixels = render(wood, screen)
        data = png(pixels)
        (ROOT / name).write_bytes(data)
        colors = len({bytes(pixels[i:i + 4]) for i in range(0, len(pixels), 4)})
        assets.append({'file': name, 'width': W, 'height': H, 'bytes': len(data), 'rgba_colors': colors, 'sha256': hashlib.sha256(data).hexdigest()})
    report = {'method': 'Hand-authored raster drawing functions; Python standard library only', 'reference': '../../web/art/office-room-v2.png', 'source_pixels_copied': False, 'production_replaced': False, 'assets': assets, 'generation_seconds': round(time.perf_counter() - start, 4), 'limits': ['Not a pixel-identical recreation of the reference.', 'Build time excludes design, coding and visual iteration.', 'No proven labor-cost reduction; no characters or whole scene generated.']}
    (ROOT / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))

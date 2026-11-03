"""Image delivery metadata and markup; originals remain unchanged."""
import html
import json
import struct
from pathlib import Path

from site_paths import ROOT, SITE_ROOT, site_root
ARTICLE_SIZES = '(max-width:560px) calc(100vw - 44px), (max-width:1599px) 704px, 960px'
TRANSLATION_SIZES = '(max-width:700px) calc(100vw - 48px), 704px'


def dimensions(data):
    if data.startswith(b'\x89PNG\r\n\x1a\n'):
        return struct.unpack('>II', data[16:24])
    if data.startswith((b'GIF87a', b'GIF89a')):
        return struct.unpack('<HH', data[6:10])
    if data.startswith(b'RIFF') and data[8:12] == b'WEBP':
        if data[12:16] == b'VP8X':
            return int.from_bytes(data[24:27], 'little') + 1, int.from_bytes(data[27:30], 'little') + 1
        if data[12:16] == b'VP8 ' and data[23:26] == b'\x9d\x01\x2a':
            width, height = struct.unpack('<HH', data[26:30])
            return width & 0x3fff, height & 0x3fff
        if data[12:16] == b'VP8L' and data[20] == 0x2f:
            bits = int.from_bytes(data[21:25], 'little')
            return (bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1
    if data.startswith(b'\xff\xd8'):
        offset = 2
        while offset < len(data):
            if data[offset] != 255:
                offset += 1
                continue
            while data[offset] == 255:
                offset += 1
            marker = data[offset]
            offset += 1
            if marker in (0xD8, 0xD9) or 0xD0 <= marker <= 0xD7:
                continue
            length = int.from_bytes(data[offset:offset + 2], 'big')
            if marker in (0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF):
                height, width = struct.unpack('>HH', data[offset + 3:offset + 7])
                return width, height
            if length < 2:
                break
            offset += length
    raise ValueError('Unsupported or invalid image header')


def load_assets(root=ROOT):
    path = root / 'content/image-assets.json'
    return json.loads(path.read_text())['images'] if path.exists() else {}


def image_html(attrs, assets, sizes=ARTICLE_SIZES):
    attrs = dict(attrs)
    image = assets.get(attrs.get('src', '').removeprefix('./'))
    if image:
        attrs.update(width=str(image['width']), height=str(image['height']), decoding='async')
        attrs.setdefault('loading', 'lazy')
    tag = '<img' + ''.join(f' {key}="{html.escape(str(value), quote=True)}"' for key, value in attrs.items() if value is not None) + '>'
    if not image or not image['variants']:
        return tag
    srcset = ', '.join(f'./{variant["path"]} {variant["width"]}w' for variant in image['variants'])
    original = html.escape(attrs['src'].removeprefix('./'), quote=True)
    return f'<picture data-image-asset="{original}"><source type="image/webp" srcset="{srcset}" sizes="{html.escape(sizes, quote=True)}">{tag}</picture>'

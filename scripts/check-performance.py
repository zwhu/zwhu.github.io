#!/usr/bin/env python3
"""Enforce measured loading budgets without needing a browser or image encoder."""
import gzip
import hashlib
import sys
from html.parser import HTMLParser
from pathlib import Path

from image_assets import ROOT, dimensions, load_assets
from site_paths import site_root


class Page(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.images, self.analytics, self.pictures = [], [], []
        self.nested_picture = False
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'picture':
            self.nested_picture |= bool(self.pictures)
            self.pictures.append([])
        if tag == 'source' and self.pictures:
            self.pictures[-1].append(attrs)
        if tag == 'img':
            self.images.append((attrs, list(self.pictures[-1]) if self.pictures else []))
        if tag == 'script' and 'cloudflareinsights.com/beacon.min.js' in attrs.get('src', ''):
            self.analytics.append(attrs)

    def handle_endtag(self, tag):
        if tag == 'picture' and self.pictures:
            self.pictures.pop()


def check(root=ROOT):
    errors, assets = [], load_assets(root)
    root = site_root(root)
    if not assets:
        errors.append('Image manifest is missing or empty; run scripts/optimize-images.py')
    for path in sorted(root.glob('*.html')):
        data = path.read_bytes()
        # Preserve the full long-form translation; the measured text-only floor is ~25 KiB gzip.
        if len(data) > 96 * 1024 or len(gzip.compress(data)) > 32 * 1024:
            errors.append(f'{path.name}: HTML exceeds 96 KiB raw / 32 KiB gzip budget')
        page = Page(data.decode())
        if page.nested_picture:
            errors.append(f'{path.name}: nested picture markup')
        if len(page.analytics) != 1 or 'async' not in page.analytics[0]:
            errors.append(f'{path.name}: one asynchronous analytics beacon required')
        for image, sources in page.images:
            src = image.get('src', '')
            if src.startswith('data:image/'):
                errors.append(f'{path.name}: inline image delays the entire HTML response')
            if not all(str(image.get(key, '')).isdigit() and int(image[key]) > 0 for key in ('width', 'height')):
                errors.append(f'{path.name}: image needs intrinsic dimensions: {src[:100]}')
            asset = assets.get(src.removeprefix('./'))
            if src.startswith('./') and Path(src).suffix.lower() in ('.png', '.jpg', '.jpeg', '.gif') and not asset:
                errors.append(f'{path.name}: raster image is not registered: {src}')
            if asset:
                if image.get('loading') != 'lazy' or image.get('decoding') != 'async':
                    errors.append(f'{path.name}: content raster image must load lazily and decode asynchronously')
                expected = ', '.join(f'./{v["path"]} {v["width"]}w' for v in asset['variants'])
                if expected and not any(s.get('type') == 'image/webp' and s.get('srcset') == expected and s.get('sizes') for s in sources):
                    errors.append(f'{path.name}: responsive sources missing or stale: {src}')
    for relative, asset in assets.items():
        path = root / relative
        if not path.exists():
            errors.append(f'Missing original: {relative}')
            continue
        data = path.read_bytes()
        if hashlib.sha256(data).hexdigest() != asset['sha256'] or dimensions(data) != (asset['width'], asset['height']):
            errors.append(f'Original image changed: {relative}')
        for variant in asset['variants']:
            path = root / variant['path']
            if not path.exists():
                errors.append(f'Missing derivative: {variant["path"]}')
                continue
            data = path.read_bytes()
            width, height = dimensions(data)
            if len(data) != variant['bytes'] or len(data) > 192 * 1024 or width != variant['width'] or width > asset['width']:
                errors.append(f'Image derivative exceeds budget or has wrong dimensions: {variant["path"]}')
            if abs(height - asset['height'] * width / asset['width']) > 1:
                errors.append(f'Image aspect ratio changed: {variant["path"]}')
    return errors


if __name__ == '__main__':
    errors = check()
    if errors:
        print('\n'.join(errors), file=sys.stderr)
        sys.exit(1)
    print('Loading budgets passed: HTML, responsive images, preserved originals, dimensions and asynchronous analytics.')

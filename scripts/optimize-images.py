#!/usr/bin/env python3
"""Archive inline originals and generate responsive WebP assets with cwebp.

Uses Python 3.9+ standard library and the cwebp command for maintenance only.
Serving the site and running CI do not require the encoder.
"""
import base64
import hashlib
import json
import shutil
import subprocess
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit

from image_assets import ROOT, TRANSLATION_SIZES, dimensions, image_html
from site_paths import SITE_ROOT


class Images(HTMLParser):
    def __init__(self, source):
        super().__init__()
        self.images, self.anchor, self.pictures = [], 0, []
        self.lines = [0]
        for line in source.splitlines(keepends=True):
            self.lines.append(self.lines[-1] + len(line))
        self.feed(source)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        line, column = self.getpos()
        start = self.lines[line - 1] + column
        if tag == 'a':
            self.anchor += 1
        if tag == 'picture':
            self.pictures.append(dict(start=start, webp='data-image-asset' in attrs))
        if tag == 'source' and self.pictures and attrs.get('type') == 'image/webp':
            self.pictures[-1]['webp'] = True
        if tag == 'img':
            self.images.append((start, self.get_starttag_text(), attrs, self.anchor > 0, self.pictures[-1] if self.pictures else None))

    def handle_endtag(self, tag):
        if tag == 'a':
            self.anchor = max(0, self.anchor - 1)
        if tag == 'picture' and self.pictures:
            line, column = self.getpos()
            self.pictures.pop()['end'] = self.lines[line - 1] + column + len('</picture>')


def main():
    encoder = shutil.which('cwebp')
    if not encoder:
        raise SystemExit('cwebp is required to regenerate images; existing assets and CI need no encoder.')
    candidates, pages = set(), {}
    for path in sorted(SITE_ROOT.glob('*.html')):
        source = path.read_text()
        images = Images(source)
        for _, _, attrs, _, _ in images.images:
            src = attrs.get('src', '')
            if src.startswith('data:image/'):
                header, encoded = src.split(',', 1)
                extension = {'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif'}[header[5:].split(';')[0]]
                data = base64.b64decode(encoded, validate=True)
                digest = hashlib.sha256(data).hexdigest()
                relative = f'assets/translations/original/{digest[:16]}.{extension}'
                target = SITE_ROOT / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                if target.exists() and target.read_bytes() != data:
                    raise ValueError(f'Original asset hash collision: {relative}')
                target.write_bytes(data)
                attrs['src'] = './' + relative
                candidates.add(relative)
            elif src.startswith('./') and Path(urlsplit(src).path).suffix.lower() in ('.png', '.jpg', '.jpeg', '.gif'):
                candidates.add(urlsplit(src).path.removeprefix('./'))
        pages[path] = (source, images)

    assets = {}
    output = SITE_ROOT / 'assets/optimized'
    output.mkdir(parents=True, exist_ok=True)
    for relative in sorted(candidates):
        original = SITE_ROOT / relative
        data = original.read_bytes()
        width, height = dimensions(data)
        digest = hashlib.sha256(data).hexdigest()
        image = dict(width=width, height=height, sha256=digest, bytes=len(data), variants=[])
        if original.suffix.lower() != '.gif':
            for size in sorted({min(width, value) for value in (640, 1024, 1600)}):
                target = output / f'{digest[:16]}-{size}-q88.webp'
                if not target.exists():
                    subprocess.run([encoder, '-quiet', '-q', '88', '-m', '6', '-sharp_yuv', '-metadata', 'none',
                                    '-resize', str(size), '0', str(original), '-o', str(target)], check=True)
                image['variants'].append(dict(path=target.relative_to(SITE_ROOT).as_posix(), width=size, bytes=target.stat().st_size))
        assets[relative] = image
    manifest = {'encoder': 'cwebp -q 88 -m 6 -sharp_yuv; no upscaling; originals retained', 'images': assets}
    (ROOT / 'content/image-assets.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')

    updated = 0
    for path, (source, images) in pages.items():
        translation = path.name in ('claude-code-review.html', 'engineers-new-problems.html', 'agent-design-system.html')
        for start, original, attrs, anchored, pictured in reversed(images.images):
            if attrs.get('src', '').removeprefix('./') not in assets:
                continue
            # Update the whole managed picture so new derivatives replace stale srcsets.
            if pictured:
                if not pictured['webp']:
                    continue
                start = pictured['start']
                original = source[start:pictured['end']]
            replacement = image_html(attrs, assets, TRANSLATION_SIZES) if translation else image_html(attrs, assets)
            if translation and not anchored:
                replacement = f'<a href="{attrs["src"]}" aria-label="查看原尺寸插图">{replacement}</a>'
            source = source[:start] + replacement + source[start + len(original):]
        if source != path.read_text():
            path.write_text(source)
            updated += 1
    print(f'Prepared {len(assets)} original images and responsive variants; updated {updated} pages. GIF animations retained.')


if __name__ == '__main__':
    main()

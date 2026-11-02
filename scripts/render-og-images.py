#!/usr/bin/env python3
"""Render 1200×630 share cards from content/og-images.json with headless Chrome.

Authoring dependency: Google Chrome (or CHROME=/path/to/chrome). The deployed blog
and CI only read the committed PNG files; --check verifies they exist and match size.
"""
import argparse
import html
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

from image_assets import ROOT, dimensions

WIDTH, HEIGHT = 1200, 630
CHROME = os.environ.get('CHROME', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
E = html.escape

# Colours mirror the style.css variables; fonts stay on the system stack.
PAGE = '''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><style>
*{{box-sizing:border-box}}html,body{{margin:0;width:{w}px;height:{h}px;overflow:hidden}}
body{{background:#faf8f3;color:#292825;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;
padding:72px 88px 64px;display:flex;flex-direction:column;-webkit-font-smoothing:antialiased}}
.brand{{font-size:30px;font-weight:600}}.brand span{{color:#a64335;font-weight:400;margin-left:5px}}
.kicker{{margin-top:auto;font-family:ui-monospace,Menlo,monospace;font-size:20px;letter-spacing:3px;color:#a64335}}
h1{{margin:22px 0 0;font-size:64px;line-height:1.3;font-weight:600;letter-spacing:-1px;max-width:980px}}
p{{margin:20px 0 0;font-size:30px;line-height:1.6;color:#77746e;max-width:980px}}
footer{{margin-top:auto;padding-top:24px;border-top:1px solid #e6e2da;display:flex;justify-content:space-between;
font-family:ui-monospace,Menlo,monospace;font-size:20px;color:#77746e}}
</style></head><body><div class="brand">zwhu<span>.</span></div><div class="kicker">{kicker}</div>
<h1>{title}</h1><p>{subtitle}</p><footer><span>{footer}</span><span>zwhu.github.io</span></footer></body></html>'''


def cards(root=ROOT):
    return json.loads((root / 'content/og-images.json').read_text())['cards']


def render(card, output):
    with tempfile.TemporaryDirectory(prefix='zwhu-og-') as directory:
        page = Path(directory) / 'card.html'
        page.write_text(PAGE.format(w=WIDTH, h=HEIGHT, **{key: E(card[key]) for key in ('kicker', 'title', 'subtitle', 'footer')}))
        subprocess.run([CHROME, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
                        f'--user-data-dir={directory}/profile', f'--window-size={WIDTH},{HEIGHT}',
                        f'--screenshot={output}', page.as_uri()], check=True, capture_output=True)


def check(root=ROOT):
    errors = []
    for card in cards(root):
        path = root / card['image']
        if not path.exists():
            errors.append(f'Missing share image: {card["image"]}')
        elif dimensions(path.read_bytes()) != (WIDTH, HEIGHT):
            errors.append(f'Share image must be {WIDTH}×{HEIGHT}: {card["image"]}')
        elif path.stat().st_size > 192 * 1024:
            errors.append(f'Share image exceeds 192 KiB: {card["image"]}')
    return errors


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Verify committed images without launching Chrome')
    args = parser.parse_args()
    if not args.check:
        for card in cards():
            output = ROOT / card['image']
            output.parent.mkdir(parents=True, exist_ok=True)
            render(card, output)
    errors = check()
    if errors:
        print('\n'.join(errors), file=sys.stderr)
        return 1
    print(f'{"Checked" if args.check else "Rendered"} {len(cards())} share images ({WIDTH}×{HEIGHT}).')
    return 0


if __name__ == '__main__':
    sys.exit(main())

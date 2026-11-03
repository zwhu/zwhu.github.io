#!/usr/bin/env python3
"""Synchronize shared HTML and catalogs in place; leave authored article bodies intact."""
import argparse
import subprocess
import sys

from site_templates import ROOT, Site
from site_paths import SITE_ROOT, public_content


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Fail if generated regions are stale; do not write files')
    args = parser.parse_args()
    try:
        outputs = Site().outputs()
    except (ValueError, KeyError) as error:
        print(f'Site generation failed: {error}', file=sys.stderr)
        return 1
    content = public_content()
    stale_content = [path for path, data in content.items() if not path.exists() or path.read_bytes() != data]
    retired_content = [path for path in (SITE_ROOT / 'content').rglob('*') if path.is_file() and path not in content]
    changed = [path for path, source in outputs.items() if path.read_text() != source]
    if args.check and (changed or stale_content or retired_content):
        print('Stale generated regions: ' + ', '.join(str(path.relative_to(ROOT)) for path in changed + stale_content + retired_content), file=sys.stderr)
        return 1
    for path in changed:
        path.write_text(outputs[path])
    if not args.check:
        for path in retired_content:
            path.unlink()
        for path in stale_content:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(content[path])
        subprocess.run([sys.executable, str(ROOT / 'scripts/update-seo.py')], check=True)
    print(f'{"Checked" if args.check else "Rendered"} shared HTML and catalogs for {len(outputs)} pages ({len(changed)} changed).')
    return 0


if __name__ == '__main__':
    sys.exit(main())

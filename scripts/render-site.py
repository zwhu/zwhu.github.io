#!/usr/bin/env python3
"""Synchronize shared HTML and catalogs in place; leave authored article bodies intact."""
import argparse
import subprocess
import sys

from site_templates import ROOT, Site


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Fail if generated regions are stale; do not write files')
    args = parser.parse_args()
    try:
        outputs = Site().outputs()
    except (ValueError, KeyError) as error:
        print(f'Site generation failed: {error}', file=sys.stderr)
        return 1
    changed = [path for path, source in outputs.items() if path.read_text() != source]
    if args.check and changed:
        print('Stale generated regions: ' + ', '.join(path.name for path in changed), file=sys.stderr)
        return 1
    for path in changed:
        path.write_text(outputs[path])
    if not args.check:
        subprocess.run([sys.executable, str(ROOT / 'scripts/update-seo.py')], check=True)
    print(f'{"Checked" if args.check else "Rendered"} shared HTML and catalogs for {len(outputs)} pages ({len(changed)} changed).')
    return 0


if __name__ == '__main__':
    sys.exit(main())

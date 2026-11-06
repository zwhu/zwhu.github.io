#!/usr/bin/env python3
"""Copy the playable Career RPG into docs/games/career-rpg for GitHub Pages.

Pages serves docs/ as the site root. The game is authored at
games/career-rpg/web and fetches chapter JSON from ../design/, which is
outside that folder. This copies the runtime (modules, style, atlases,
chapter scenes, and the three chapter JSON files) and rewrites only the
publish paths:

- ../design/ becomes ./design/ next to the page
- 「回到博客」 points at https://zwhu.github.io/

Tests, review evidence, design notes, and the unused Three.js vendor stay
out of the site. The blog homepage, nav, and article list are not touched.
The published index keeps its existing noindex meta. docs/.nojekyll is
already present, so this does not add another one.
"""
import argparse
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'games/career-rpg'
WEB = SOURCE / 'web'
DEST = ROOT / 'docs/games/career-rpg'
BLOG = 'https://zwhu.github.io/'

FILES = (
    'index.html', 'style.css', 'main.mjs', 'actors.mjs', 'story.mjs',
    'title.mjs', 'narrow-wrap.mjs',
)
DIRS = ('chapters', 'engine', 'cinematic', 'art')
CHAPTERS = ('chapter-01.json', 'chapter-hefei.json', 'chapter-hangzhou.json')


def rewrite(rel, data):
    if rel.suffix not in {'.html', '.mjs'}:
        return data
    text = data.decode('utf-8')
    if rel.as_posix() == 'index.html':
        old = 'href="../../../docs/index.html"'
        text = text.replace(old, f'href="{BLOG}"')
        if old in text or text.count(f'href="{BLOG}"') != 2:
            raise ValueError('blog links were not rewritten exactly twice')
        if 'name="robots" content="noindex"' not in text:
            raise ValueError('published index lost noindex')
    if rel.suffix == '.mjs':
        text = text.replace("'../design/", "'./design/")
        if "'../design/" in text:
            raise ValueError(f'{rel.as_posix()} still fetches chapter JSON outside the page')
    return text.encode('utf-8')


def tree():
    files = {}
    for name in FILES:
        rel = Path(name)
        files[rel] = rewrite(rel, (WEB / name).read_bytes())
    for folder in DIRS:
        for path in sorted((WEB / folder).rglob('*')):
            if not path.is_file():
                continue
            rel = path.relative_to(WEB)
            files[rel] = rewrite(rel, path.read_bytes())
    for name in CHAPTERS:
        rel = Path('design') / name
        files[rel] = (SOURCE / 'design' / name).read_bytes()
    return files


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Fail if docs/games/career-rpg does not match the source runtime')
    args = parser.parse_args()
    expected = tree()
    if args.check:
        actual = {}
        if DEST.exists():
            actual = {path.relative_to(DEST): path.read_bytes() for path in DEST.rglob('*') if path.is_file()}
        stale = [rel.as_posix() for rel, data in expected.items() if actual.get(rel) != data]
        stale.extend(f'extra:{rel.as_posix()}' for rel in sorted(set(actual) - set(expected)))
        if stale:
            print('Career RPG publish tree is stale: ' + ', '.join(stale), file=sys.stderr)
            return 1
        print(f'Checked Career RPG publish tree ({len(expected)} files).')
        return 0
    if DEST.exists():
        shutil.rmtree(DEST)
    for rel, data in expected.items():
        path = DEST / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
    print(f'Published Career RPG to docs/games/career-rpg ({len(expected)} files).')
    return 0


if __name__ == '__main__':
    sys.exit(main())

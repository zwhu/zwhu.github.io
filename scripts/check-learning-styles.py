#!/usr/bin/env python3
"""Check learning-page style ownership; rendering is verified in a browser."""
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LESSONS = tuple(sorted(path.stem.removeprefix('learn-') for path in ROOT.glob('learn-*.html')))
LEGACY = re.compile(
    r'--(?:paper|ink|card|border|foreground|muted-foreground|background|'
    r'green2?|orange2?|blue2?|soft|sat-color|result-color|shadow|radius|viz-series-[123])(?![\w-])'
)


class Page(HTMLParser):
    def __init__(self, source):
        super().__init__()
        self.styles, self.roots = [], []
        self.feed(source)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'link' and attrs.get('rel') == 'stylesheet':
            self.styles.append(attrs.get('href'))
        classes = attrs.get('class', '').split()
        if 'learning-content' in classes:
            self.roots.append(classes)


def selectors(source):
    """Read selectors in these plain stylesheets, including nested media rules."""
    source = re.sub(r'/\*.*?\*/', '', source, flags=re.S)
    for match in re.finditer(r'([^{}]+)\{', source):
        selector = match[1].strip()
        if not selector.startswith('@'):
            start, depth = 0, 0
            for index, char in enumerate(selector):
                if char in '([':
                    depth += 1
                elif char in ')]':
                    depth -= 1
                elif char == ',' and depth == 0:
                    yield selector[start:index].strip()
                    start = index + 1
            yield selector[start:].strip()


def main():
    errors = []
    shared = (ROOT / 'learning.css').read_text()
    for path in (ROOT / 'learning.css', *(ROOT / 'assets/learning').glob('*.css')):
        source = re.sub(r'/\*.*?\*/', '', path.read_text(), flags=re.S)
        if re.search(r':\s*(?:!important\s*)?;', source):
            errors.append(f'{path.name} contains an empty declaration')
    for selector in selectors(shared):
        if any('.lesson-' + name in selector for name in LESSONS):
            errors.append(f'learning.css contains course-specific selector: {selector}')
        if '#' in selector:
            errors.append(f'learning.css contains a course element ID: {selector}')

    for name in LESSONS:
        css_path = ROOT / 'assets/learning' / f'{name}.css'
        if not css_path.is_file():
            errors.append(f'learn-{name}.html needs {css_path.relative_to(ROOT)}')
            continue
        source = css_path.read_text()
        for selector in selectors(source):
            # AIME's native disclosure sits in the title area outside the content root.
            allowed = re.match(r'^\.(?:learning-content\.)?lesson-' + re.escape(name) + r'(?=$|[\s.:#\[])', selector) or (
                name == 'aime-paper' and re.match(r'^(?:\.learning-page\s+)?\.aime-critique(?=$|[\s.:#\[])', selector)
            )
            if not allowed:
                errors.append(f'{css_path.name} has an unscoped selector: {selector}')
        for path, text in ((css_path, source), (ROOT / f'learn-{name}.html', (ROOT / f'learn-{name}.html').read_text())):
            if LEGACY.search(re.sub(r'/\*.*?\*/', '', text, flags=re.S)):
                errors.append(f'{path.name} still uses an imported theme variable')
        page = Page((ROOT / f'learn-{name}.html').read_text())
        expected = ['./style.css', './archive.css', f'./assets/learning/{name}.css', './learning.css']
        if page.styles != expected:
            errors.append(f'learn-{name}.html stylesheet order: {page.styles}')
        if len(page.roots) != 1 or 'lesson-' + name not in page.roots[0]:
            errors.append(f'learn-{name}.html needs one scoped learning-content root')

    if LEGACY.search(re.sub(r'/\*.*?\*/', '', shared, flags=re.S)):
        errors.append('learning.css still maps imported theme variables')
    if errors:
        print('\n'.join(errors), file=sys.stderr)
        return 1
    print(f'Checked {len(LESSONS)} lessons: style ownership, scopes, semantic variables and stylesheet order.')
    return 0


if __name__ == '__main__':
    sys.exit(main())

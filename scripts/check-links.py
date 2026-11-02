#!/usr/bin/env python3
"""Check relative page/resource links and HTML anchors without network access."""
import json
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]


class Page(HTMLParser):
    def __init__(self, source):
        super().__init__()
        self.anchors, self.references = set(), []
        self.feed(source)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if 'id' in attrs:
            self.anchors.add(attrs['id'])
        if tag == 'a' and 'name' in attrs:
            self.anchors.add(attrs['name'])
        # Search metadata deliberately uses the formal absolute HTTPS URL.
        if tag == 'link' and 'canonical' in attrs.get('rel', '').split():
            return
        for key in ('href', 'src', 'poster', 'xlink:href'):
            if attrs.get(key):
                self.references.append((self.getpos()[0], attrs[key]))
        srcset = attrs.get('srcset', '')
        if srcset and not srcset.lstrip().startswith('data:'):
            for candidate in srcset.split(','):
                if candidate.strip():
                    self.references.append((self.getpos()[0], candidate.split()[0]))

    handle_startendtag = handle_starttag


def check(root=ROOT):
    root = Path(root).resolve()
    site = json.loads((root / 'content/seo.json').read_text())['site']
    host = urlsplit(site['url']).hostname
    pending = sorted(root.glob('*.html'))
    parsed, visited, errors = {}, set(), []

    def page(path):
        if path not in parsed:
            parsed[path] = Page(path.read_text())
        return parsed[path]

    while pending:
        path = pending.pop()
        if path in visited:
            continue
        visited.add(path)
        for line, reference in page(path).references:
            label = f'{path.relative_to(root)}:{line}: {reference}'
            try:
                url = urlsplit(reference)
            except ValueError as error:
                errors.append(f'{label}: invalid URL ({error})')
                continue
            if url.scheme or url.netloc:
                if url.hostname == host:
                    errors.append(f'{label}: internal navigation/resources must use relative URLs')
                continue
            if url.path.startswith('/'):
                errors.append(f'{label}: use a relative URL instead of a root-relative URL')
                continue
            target = (path.parent / unquote(url.path)).resolve() if url.path else path
            if not target.is_relative_to(root):
                errors.append(f'{label}: path leaves the site directory')
                continue
            if target.is_dir():
                target = target / 'index.html'
            if not target.is_file():
                errors.append(f'{label}: target does not exist')
                continue
            if target.suffix.lower() == '.html':
                if target not in visited:
                    pending.append(target)
                fragment = unquote(url.fragment).split(':~:text=', 1)[0]
                if fragment and fragment not in page(target).anchors:
                    errors.append(f'{label}: HTML anchor does not exist')
    return errors


if __name__ == '__main__':
    errors = check()
    if errors:
        print('\n'.join(errors), file=sys.stderr)
        sys.exit(1)
    print('Checked relative page/resource URLs, local targets, srcset and HTML anchors.')

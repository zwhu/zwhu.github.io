#!/usr/bin/env python3
"""Update static search metadata and sitemap; Python standard library only."""
import argparse
import html
import json
import re
from datetime import datetime
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlsplit
from xml.etree import ElementTree as ET

SEO_BLOCK = re.compile(r'\n?<!-- SEO:start -->.*?<!-- SEO:end -->\n?', re.S)
META_TAG = re.compile(r'<meta\b[^>]*>', re.I)
HEAD = re.compile(r'(<head\b[^>]*>)(.*?)(</head\s*>)', re.I | re.S)


class PageInfo(HTMLParser):
    def __init__(self, source):
        super().__init__(convert_charrefs=True)
        self.title, self.headline, self.description = '', '', ''
        self.has_description = False
        self.published, self.meta_text = '', ''
        self.article = False
        self.capture = None
        self.feed(source)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        classes = attrs.get('class', '').split()
        if tag == 'title' or tag == 'h1' and not self.headline:
            self.capture = tag
        if 'meta' in classes:
            self.capture = 'meta'
        if tag == 'article' and set(classes) & {'article', 'learning-article'}:
            self.article = True
        if tag == 'body' and 'translation-page' in classes:
            self.article = True
        if tag == 'meta' and attrs.get('name', '').lower() == 'description':
            self.has_description = True
            self.description = attrs.get('content', '')
        if tag == 'time' and not self.published:
            self.published = attrs.get('datetime', '')

    def handle_endtag(self, tag):
        if tag == self.capture or self.capture == 'meta' and tag in {'p', 'div'}:
            self.capture = None

    def handle_data(self, data):
        if self.capture == 'title':
            self.title += data
        elif self.capture == 'h1':
            self.headline += data
        elif self.capture == 'meta':
            self.meta_text += data


def meta(name, value, attribute='name'):
    return f'<meta {attribute}="{html.escape(name, quote=True)}" content="{html.escape(value, quote=True)}">'


def remove_description(match):
    parser = PageInfo(match[0])
    return '' if parser.has_description else match[0]


def metadata(root, config):
    records = {}
    issues = json.loads((root / 'content/blog-issues.json').read_text())['issues']
    for issue in issues:
        records[f'blog-issue-{issue["number"]}.html'] = {
            'datePublished': issue['created_at'], 'isBasedOn': issue['html_url']
        }
    for article in json.loads((root / 'content/original-articles.json').read_text()):
        records[article['path']] = {'datePublished': article['date']}
    for path, values in config['pages'].items():
        records.setdefault(path, {}).update(values)
    # Share cards are rendered by scripts/render-og-images.py; only listed pages get one.
    for card in json.loads((root / 'content/og-images.json').read_text())['cards']:
        records.setdefault(card['page'], {})['image'] = {'url': urljoin(config['site']['url'], card['image']), 'alt': card['alt']}
    return records


def schema(site, info, record, canonical, description):
    language = site['language']
    website = {
        '@type': 'WebSite', '@id': site['url'] + '#website',
        'url': site['url'], 'name': site['name'], 'inLanguage': language,
        'publisher': {'@id': site['url'] + '#author'}
    }
    author = {'@type': 'Person', '@id': site['url'] + '#author', **site['author']}
    page = {
        '@type': 'WebPage' if info.article or canonical == site['url'] else 'CollectionPage',
        '@id': canonical + '#webpage', 'url': canonical,
        'name': info.title.strip(), 'description': description,
        'inLanguage': language, 'isPartOf': {'@id': website['@id']}
    }
    if canonical == site['author']['url']:
        # The author's own page describes that person rather than listing articles.
        page.update({'@type': 'ProfilePage', 'mainEntity': {'@id': author['@id']}})
    graph = [website, author, page]
    if info.article:
        article = {
            '@type': 'BlogPosting', '@id': canonical + '#article',
            'url': canonical, 'headline': info.headline.strip(),
            'description': description, 'inLanguage': language,
            'mainEntityOfPage': {'@id': page['@id']},
            'author': {'@type': 'Person', **record['author']} if 'author' in record else {'@id': author['@id']},
            'publisher': {'@id': author['@id']}
        }
        # Preserve original publication dates; migrations and comment edits are not updates.
        prepared = re.search(r'整理于\s*(\d{4}-\d{2}-\d{2})', info.meta_text)
        published = record.get('datePublished') or info.published or (prepared[1] if prepared else '')
        if published:
            datetime.fromisoformat(published.replace('Z', '+00:00'))
            article['datePublished'] = published
        if record.get('image'):
            article['image'] = record['image']['url']
        for key in ['dateModified', 'isBasedOn', 'translationOfWork']:
            if record.get(key):
                article[key] = record[key]
        if 'translationOfWork' in record:
            article['inLanguage'] = [language, 'en']
        page['mainEntity'] = {'@id': article['@id']}
        graph.append(article)
    return {'@context': 'https://schema.org', '@graph': graph}


def update_page(source, site, record, canonical):
    info = PageInfo(source)
    description = record.get('description') or info.description
    if not info.title.strip() or not description or description == '代码笔记。':
        raise ValueError(f'{canonical}: missing descriptive title or summary')
    content_type = 'article' if info.article else 'website'
    tags = [
        meta('description', description),
        f'<link rel="canonical" href="{html.escape(canonical, quote=True)}">',
        meta('author', record.get('author', site['author'])['name']),
        meta('og:type', content_type, 'property'),
        meta('og:site_name', site['name'], 'property'),
        meta('og:locale', 'zh_CN', 'property'),
        meta('og:title', info.title.strip(), 'property'),
        meta('og:description', description, 'property'),
        meta('og:url', canonical, 'property'),
        meta('twitter:card', 'summary_large_image' if record.get('image') else 'summary'),
        meta('twitter:title', info.title.strip()),
        meta('twitter:description', description)
    ]
    if site.get('twitter'):
        tags.append(meta('twitter:site', site['twitter']))
    if record.get('image'):
        image = record['image']
        tags.extend([
            meta('og:image', image['url'], 'property'),
            meta('og:image:width', '1200', 'property'),
            meta('og:image:height', '630', 'property'),
            meta('og:image:alt', image['alt'], 'property'),
            meta('twitter:image', image['url']),
            meta('twitter:image:alt', image['alt'])
        ])
    if canonical == site['url']:
        tags.extend(meta(name, value) for name, value in site.get('verification', {}).items())
    structured = json.dumps(schema(site, info, record, canonical, description), ensure_ascii=False, separators=(',', ':'))
    # JSON inside a script element must never terminate the HTML script early.
    structured = structured.replace('<', '\\u003c').replace('>', '\\u003e').replace('&', '\\u0026')
    tags.append('<script type="application/ld+json">' + structured + '</script>')
    block = '\n<!-- SEO:start -->\n' + '\n'.join(tags) + '\n<!-- SEO:end -->\n'
    match = HEAD.search(source)
    if not match:
        raise ValueError(f'{canonical}: missing head')
    head = META_TAG.sub(remove_description, SEO_BLOCK.sub('', match[2]))
    head = re.sub(r'(?m)^[ \t]+$', '', head)
    return source[:match.start(2)] + head + block + source[match.end(2):]


def noindex_page(source):
    match = HEAD.search(source)
    if not match:
        raise ValueError('Snapshot is missing head')
    head = SEO_BLOCK.sub('', match[2])
    block = '\n<!-- SEO:start -->\n<meta name="robots" content="noindex, follow">\n<!-- SEO:end -->\n'
    return source[:match.start(2)] + head + block + source[match.end(2):]


def outputs(root):
    config = json.loads((root / 'content/seo.json').read_text())
    site = config['site']
    if urlsplit(site['url']).scheme != 'https' or not site['url'].endswith('/'):
        raise ValueError('Site URL must be an absolute HTTPS URL with a trailing slash')
    records = metadata(root, config)
    pages = sorted(root.glob('*.html'))
    changes = {}
    urls = []
    for path in pages:
        canonical = urljoin(site['url'], '' if path.name == 'index.html' else path.name)
        changes[path] = update_page(path.read_text(), site, records.get(path.name, {}), canonical)
        urls.append(canonical)
    for folder in config['noindexDirectories']:
        for path in sorted((root / folder).rglob('*.html')):
            changes[path] = noindex_page(path.read_text())
    # lastmod is omitted until a reliable editorial update date is maintained.
    namespace = 'http://www.sitemaps.org/schemas/sitemap/0.9'
    ET.register_namespace('', namespace)
    sitemap = ET.Element(f'{{{namespace}}}urlset')
    for url in urls:
        entry = ET.SubElement(sitemap, f'{{{namespace}}}url')
        ET.SubElement(entry, f'{{{namespace}}}loc').text = url
    ET.indent(sitemap, space='  ')
    changes[root / 'sitemap.xml'] = '<?xml version="1.0" encoding="UTF-8"?>\n' + ET.tostring(sitemap, encoding='unicode') + '\n'
    # Snapshots remain crawlable so crawlers can see their noindex directive.
    changes[root / 'robots.txt'] = 'User-agent: *\nAllow: /\n\nSitemap: ' + urljoin(site['url'], 'sitemap.xml') + '\n'
    return changes


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Report stale SEO outputs without writing')
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    stale = []
    for path, content in outputs(root).items():
        if not path.exists() or path.read_text() != content:
            stale.append(str(path.relative_to(root)))
            if not args.check:
                path.write_text(content)
    if args.check and stale:
        parser.exit(1, 'SEO outputs need updating: ' + ', '.join(stale) + '\n')
    print(('Checked' if args.check else 'Updated') + f' SEO metadata, snapshots and sitemap ({len(stale)} changed files).')


if __name__ == '__main__':
    main()

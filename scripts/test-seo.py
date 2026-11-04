#!/usr/bin/env python3
"""Check search metadata, publication attribution and safe repeat generation."""
import json
import runpy
import unittest
from html.parser import HTMLParser
from pathlib import Path
from xml.etree import ElementTree as ET

from site_paths import ROOT, SITE_ROOT
SEO = runpy.run_path(str(ROOT / 'scripts/update-seo.py'))


class Metadata(HTMLParser):
    def __init__(self, source):
        super().__init__()
        self.tags, self.canonicals, self.graphs = [], [], []
        self.json_text = None
        self.feed(source)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'meta':
            self.tags.append(attrs)
        if tag == 'link' and attrs.get('rel') == 'canonical':
            self.canonicals.append(attrs['href'])
        if tag == 'script' and attrs.get('type') == 'application/ld+json':
            self.json_text = ''

    def handle_data(self, value):
        if self.json_text is not None:
            self.json_text += value

    def handle_endtag(self, tag):
        if tag == 'script' and self.json_text is not None:
            self.graphs.append(json.loads(self.json_text))
            self.json_text = None


class SearchMetadataTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.expected = SEO['outputs'](ROOT)

    def test_every_public_page_has_one_summary_and_matching_urls(self):
        for path in SITE_ROOT.glob('*.html'):
            with self.subTest(page=path.name):
                parsed = Metadata(path.read_text())
                canonical = 'https://zwhu.github.io/' + ('' if path.name == 'index.html' else path.name)
                self.assertEqual(parsed.canonicals, [canonical])
                summaries = [a['content'] for a in parsed.tags if a.get('name') == 'description']
                self.assertEqual(len(summaries), 1)
                self.assertGreater(len(summaries[0]), 12)
                self.assertEqual([a['content'] for a in parsed.tags if a.get('property') == 'og:url'], [canonical])
                self.assertEqual(len(parsed.graphs), 1)
                self.assertNotIn('noindex', ' '.join(a.get('content', '') for a in parsed.tags if a.get('name') == 'robots'))

    def test_sitemap_uses_only_formal_canonical_pages(self):
        tree = ET.parse(SITE_ROOT / 'sitemap.xml')
        urls = [e.text for e in tree.findall('.//{*}loc')]
        expected = {'https://zwhu.github.io/' + ('' if p.name == 'index.html' else p.name) for p in SITE_ROOT.glob('*.html')}
        self.assertEqual(set(urls), expected)
        self.assertEqual(len(urls), len(expected))
        self.assertFalse(tree.findall('.//{*}lastmod'))
        for p in (SITE_ROOT / 'content/doc-lint-comparison').glob('*.html'):
            self.assertTrue(any('noindex' in a.get('content', '') for a in Metadata(p.read_text()).tags if a.get('name') == 'robots'))

    def test_text_sitemap_matches_xml_urls(self):
        xml_urls = [e.text for e in ET.parse(SITE_ROOT / 'sitemap.xml').findall('.//{*}loc')]
        text = (SITE_ROOT / 'sitemap.txt').read_text(encoding='utf-8')
        self.assertEqual(text, '\n'.join(xml_urls) + '\n')
        self.assertEqual(len(text.splitlines()), len(set(xml_urls)))
        self.assertTrue(all(url.startswith('https://zwhu.github.io/') for url in text.splitlines()))

    def test_original_publication_and_translation_attribution(self):
        issues = json.loads((ROOT / 'content/blog-issues.json').read_text())['issues']
        for issue in issues:
            parsed = Metadata((SITE_ROOT / f'blog-issue-{issue["number"]}.html').read_text())
            article = next(n for n in parsed.graphs[0]['@graph'] if n['@type'] == 'BlogPosting')
            self.assertEqual(article['datePublished'], issue['created_at'])
            self.assertNotIn('dateModified', article)
        for name, author in [('claude-code-review.html', 'Addy Osmani'), ('engineers-new-problems.html', 'Katelyn Lesse'), ('agent-design-system.html', 'rico')]:
            parsed = Metadata((SITE_ROOT / name).read_text())
            article = next(n for n in parsed.graphs[0]['@graph'] if n['@type'] == 'BlogPosting')
            self.assertEqual(article['author']['name'], author)
            self.assertEqual(article['translationOfWork']['inLanguage'], 'en')

    def test_author_page_is_profile_of_site_author(self):
        site = json.loads((ROOT / 'content/seo.json').read_text())['site']
        path = SITE_ROOT / site['author']['url'].removeprefix(site['url'])
        page = next(n for n in Metadata(path.read_text()).graphs[0]['@graph'] if n['@id'].endswith('#webpage'))
        self.assertEqual(page['@type'], 'ProfilePage')
        self.assertEqual(page['mainEntity'], {'@id': site['url'] + '#author'})

    def test_generated_outputs_are_current_and_repeatable(self):
        for path, expected in self.expected.items():
            with self.subTest(path=path.name):
                self.assertEqual(path.read_text(), expected)

    def test_empty_old_description_and_script_text_are_handled(self):
        source = '<html><head><title>测试</title><meta name="description" content=""></head><body><article class="article"><h1>&lt;/script&gt; &amp; 引用</h1></article></body></html>'
        site = json.loads((ROOT / 'content/seo.json').read_text())['site']
        record = {'description': '用于验证摘要替换与 JSON-LD 文本转义。'}
        result = SEO['update_page'](source, site, record, site['url'] + 'test.html')
        parsed = Metadata(result)
        self.assertEqual(sum(a.get('name') == 'description' for a in parsed.tags), 1)
        article = next(n for n in parsed.graphs[0]['@graph'] if n['@type'] == 'BlogPosting')
        self.assertEqual(article['headline'], '</script> & 引用')
        self.assertEqual(result, SEO['update_page'](result, site, record, site['url'] + 'test.html'))

    def test_share_images_are_large_cards_only_where_rendered(self):
        cards = {c['page']: c for c in json.loads((ROOT / 'content/og-images.json').read_text())['cards']}
        for path in SITE_ROOT.glob('*.html'):
            with self.subTest(page=path.name):
                parsed = Metadata(path.read_text())
                images = [a['content'] for a in parsed.tags if a.get('property') == 'og:image']
                card = [a['content'] for a in parsed.tags if a.get('name') == 'twitter:card']
                if path.name in cards:
                    url = 'https://zwhu.github.io/' + cards[path.name]['image']
                    self.assertEqual(images, [url])
                    self.assertEqual(card, ['summary_large_image'])
                    self.assertTrue((SITE_ROOT / cards[path.name]['image']).exists())
                else:
                    self.assertEqual(images, [])
                    self.assertEqual(card, ['summary'])

    def test_site_verification_is_published_once_on_homepage(self):
        config = json.loads((ROOT / 'content/seo.json').read_text())['site']
        for path in SITE_ROOT.glob('*.html'):
            parsed = Metadata(path.read_text())
            for name, value in config.get('verification', {}).items():
                found = [a['content'] for a in parsed.tags if a.get('name') == name]
                self.assertEqual(found, [value] if path.name == 'index.html' else [])


if __name__ == '__main__':
    unittest.main()

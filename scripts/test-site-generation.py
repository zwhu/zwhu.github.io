#!/usr/bin/env python3
"""Verify shared generation through its public file-in/file-out interface."""
import html
import json
import re
import shutil
import tempfile
import unittest
from html.parser import HTMLParser
from pathlib import Path

from site_templates import ROOT, Site


class Header(HTMLParser):
    def __init__(self, source):
        super().__init__()
        self.in_header = False
        self.links = []
        self.analytics = []
        self.feed(source)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'header' and attrs.get('class') == 'site-header':
            self.in_header = True
        if self.in_header and tag == 'a':
            self.links.append(attrs)
        if tag == 'script' and 'cloudflareinsights.com/beacon.min.js' in attrs.get('src', ''):
            self.analytics.append(json.loads(attrs['data-cf-beacon']))

    def handle_endtag(self, tag):
        if tag == 'header':
            self.in_header = False


def authored(source):
    return re.sub(r'<!-- site:([\w-]+):start -->.*?<!-- site:\1:end -->', '', source, flags=re.S)


class SiteGenerationTests(unittest.TestCase):
    def fixture(self):
        directory = tempfile.TemporaryDirectory(prefix='zwhu-generation-')
        self.addCleanup(directory.cleanup)
        root = Path(directory.name)
        shutil.copytree(ROOT / 'templates', root / 'templates')
        (root / 'content').mkdir()
        for path in (ROOT / 'content').glob('*.json'):
            shutil.copy2(path, root / 'content' / path.name)
        for path in ROOT.glob('*.html'):
            shutil.copy2(path, root / path.name)
        return root

    def test_committed_regions_are_current_and_repeatable(self):
        site = Site()
        for path, source in site.outputs().items():
            with self.subTest(page=path.name):
                self.assertEqual(path.read_text(), source)
                self.assertEqual(site.render(source, path.name), source)

    def test_navigation_context_and_single_analytics_beacon(self):
        site = Site()
        for path, source in site.outputs().items():
            with self.subTest(page=path.name):
                parsed = Header(source)
                self.assertEqual(len(parsed.links), 5)
                self.assertTrue(all(link['href'].startswith('./') for link in parsed.links))
                active = [link for link in parsed.links if 'aria-current' in link]
                self.assertEqual(len(active), 0 if path.name == 'index.html' else 1)
                if active:
                    self.assertEqual(active[0]['aria-current'], 'page' if active[0]['href'] == './' + path.name else 'location')
                self.assertEqual(parsed.analytics, [{'token': 'c6667d9ae98e4234bba57cd49d2353f9'}])

    def test_one_navigation_edit_reaches_all_pages_without_changing_authored_content(self):
        root = self.fixture()
        config = root / 'content/site-navigation.json'
        data = json.loads(config.read_text())
        data['links'][0]['label'] = '思考与实践'
        config.write_text(json.dumps(data))
        for path, generated in Site(root).outputs().items():
            with self.subTest(page=path.name):
                self.assertIn('>思考与实践</a>', generated)
                self.assertEqual(authored(generated), authored(path.read_text()))

    def test_lesson_metadata_updates_both_catalogs_and_related_links_with_escaping(self):
        root = self.fixture()
        manifest = root / 'content/interactive-learning.json'
        data = json.loads(manifest.read_text())
        title = '新标题 <script>alert("x")</script> & 测试'
        data[0]['title'] = title
        data[0]['description'] = '新目录摘要，验证两处同步。'
        manifest.write_text(json.dumps(data))
        output = {path.name: source for path, source in Site(root).outputs().items()}
        for filename in ['index.html', 'learning.html', 'learn-aime-paper.html']:
            self.assertIn(html.escape(title), output[filename])
            self.assertNotIn(title, output[filename])
        for filename in ['index.html', 'learning.html']:
            self.assertIn('新目录摘要，验证两处同步。', output[filename])
        for path in root.glob('learn-*.html'):
            self.assertEqual(authored(output[path.name]), authored(path.read_text()))

    def test_new_lesson_is_added_to_catalogs_and_counts(self):
        root = self.fixture()
        manifest = root / 'content/interactive-learning.json'
        data = json.loads(manifest.read_text())
        data.append(dict(slug='new-course', file='learn-new-course.html', title='新增课程',
                         description='从实际课程验证自动接入。', tags='测试', related=['llm-study']))
        manifest.write_text(json.dumps(data))
        source = (root / 'learn-agent-memory.html').read_text()
        (root / 'learn-new-course.html').write_text(source)
        output = {path.name: text for path, text in Site(root).outputs().items()}
        for filename in ['index.html', 'learning.html']:
            self.assertIn('href="./learn-new-course.html"', output[filename])
        self.assertIn('全部 7 篇 →', output['index.html'])
        self.assertIn('07 篇', output['learning.html'])

    def test_ambiguous_regions_and_unregistered_pages_are_rejected(self):
        site = Site()
        source = (ROOT / 'learn-agent-memory.html').read_text()
        with self.assertRaisesRegex(ValueError, 'header'):
            site.render(source + '<!-- site:header:start -->', 'learn-agent-memory.html')
        root = self.fixture()
        (root / 'orphan.html').write_text(source)
        with self.assertRaisesRegex(ValueError, 'unregistered'):
            Site(root).outputs()


if __name__ == '__main__':
    unittest.main()

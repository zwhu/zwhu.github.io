#!/usr/bin/env python3
"""Exercise link validation against small sites with real files."""
import json
import runpy
import tempfile
import unittest
from pathlib import Path

CHECK = runpy.run_path(str(Path(__file__).with_name('check-links.py')))['check']


class LinkTests(unittest.TestCase):
    def fixture(self, source):
        directory = tempfile.TemporaryDirectory(prefix='zwhu-links-')
        self.addCleanup(directory.cleanup)
        root = Path(directory.name)
        (root / 'content').mkdir()
        (root / 'content/seo.json').write_text(json.dumps({'site': {'url': 'https://example.com/'}}))
        (root / 'docs').mkdir()
        (root / 'docs/index.html').write_text(source)
        return root

    def test_nested_pages_encoded_anchors_and_responsive_resources(self):
        root = self.fixture('''<link rel="canonical" href="https://example.com/">
<a href="./nested/?mode=read#%E7%AB%A0%E8%8A%82">章节</a>
<a href="mailto:reader@example.com">邮箱</a><a href="https://elsewhere.test/">来源</a>
<a href="#top:~:text=hello">定位</a><a name="top"></a>
<source srcset="./small.webp 640w, ./large.webp 1024w"/>
<svg><path id="shape"/><use href="#shape"/></svg>''')
        (root / 'docs/nested').mkdir()
        (root / 'docs/nested/index.html').write_text('<h1 id="章节">章节</h1><a href="../index.html#top">返回</a>')
        for name in ('small.webp', 'large.webp'):
            (root / 'docs' / name).write_bytes(b'fixture')
        self.assertEqual(CHECK(root), [])

    def test_reports_missing_targets_anchors_and_srcset_variants(self):
        root = self.fixture('''<a href="./missing.html">缺页</a>
<a href="#missing">缺锚点</a><img srcset="./missing.webp 2x">''')
        errors = CHECK(root)
        self.assertEqual(len(errors), 3)
        self.assertTrue(any('missing.html' in e and 'target does not exist' in e for e in errors))
        self.assertTrue(any('#missing' in e and 'anchor does not exist' in e for e in errors))
        self.assertTrue(any('missing.webp' in e and 'target does not exist' in e for e in errors))

    def test_checks_links_inside_reachable_nested_html(self):
        root = self.fixture('<a href="./nested/page.html">打开</a>')
        (root / 'docs/nested').mkdir()
        (root / 'docs/nested/page.html').write_text('<script src="./missing.js"></script>')
        self.assertTrue(any('nested/page.html:1' in e and 'missing.js' in e for e in CHECK(root)))

    def test_rejects_site_absolute_urls_and_paths_outside_site(self):
        root = self.fixture('''<link rel="canonical" href="https://example.com/">
<a href="https://example.com/index.html">绝对</a>
<script src="//example.com/app.js"></script><a href="/index.html">根路径</a>
<a href="../outside.html">越界</a>''')
        errors = CHECK(root)
        self.assertEqual(len(errors), 4)
        self.assertEqual(sum('must use relative URLs' in e for e in errors), 2)
        self.assertTrue(any('root-relative URL' in e for e in errors))
        self.assertTrue(any('path leaves the site directory' in e for e in errors))


if __name__ == '__main__':
    unittest.main()

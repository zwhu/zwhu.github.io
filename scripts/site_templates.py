"""Shared static HTML and catalog rendering; no browser or build dependency."""
import html
import json
import math
import re
from datetime import datetime
from html.parser import HTMLParser
from pathlib import Path
from string import Template
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
E = html.escape
COMMENT_SCRIPTS = '<script src="./comments-config.js?v=2"></script><script src="./comments.js?v=6" defer></script>'
# Common Chinese reading estimates: about 400 CJK characters or 200 Latin words per minute.
CJK_PER_MINUTE, WORDS_PER_MINUTE = 400, 200


def issue_date(value):
    return datetime.fromisoformat(value.replace('Z', '+00:00')).astimezone(ZoneInfo('Asia/Shanghai')).date().isoformat()


def issue_excerpt(issue):
    class Paragraphs(HTMLParser):
        def __init__(self):
            super().__init__()
            self.current, self.paragraphs = None, []

        def handle_starttag(self, tag, attrs):
            if tag == 'p':
                self.current = []

        def handle_endtag(self, tag):
            if tag == 'p' and self.current is not None:
                self.paragraphs.append(''.join(self.current).strip())
                self.current = None

        def handle_data(self, text):
            if self.current is not None:
                self.current.append(text)

    parser = Paragraphs()
    parser.feed(issue['body_html'])
    text = next((p for p in parser.paragraphs if len(p) > 25 and not p.startswith(('作者', '原文章'))), '代码笔记。')
    text = ' '.join(text.split())
    return text[:105] + ('…' if len(text) > 105 else '')


def reading_minutes(source):
    """Estimate from the article body; figures, navigation and scripts are not counted."""
    start, end = source.find('<div class="prose">'), source.find('</article>')
    if start < 0 or end < start:
        raise ValueError('reading time needs a .prose body inside the article')
    body = re.sub(r'<(script|style|svg|figure|nav)\b.*?</\1>', ' ', source[start:end], flags=re.S | re.I)
    text = html.unescape(re.sub(r'<[^>]+>', ' ', body))
    cjk = len(re.findall(r'[\u3400-\u9fff]', text))
    words = len(re.findall(r'[A-Za-z0-9][\w.+-]*', text))
    return max(1, math.ceil(cjk / CJK_PER_MINUTE + words / WORDS_PER_MINUTE))


def marked(name, content):
    return f'<!-- site:{name}:start -->{content}<!-- site:{name}:end -->'


def replace_block(source, name, content, legacy_pattern):
    """Update one owned region; never guess when markers or legacy HTML are ambiguous."""
    start, end = f'<!-- site:{name}:start -->', f'<!-- site:{name}:end -->'
    if start in source or end in source:
        if source.count(start) != 1 or source.count(end) != 1 or source.index(start) >= source.index(end):
            raise ValueError(f'{name}: expected one complete generated region')
        pattern = re.escape(start) + r'.*?' + re.escape(end)
    else:
        pattern = legacy_pattern
    matches = list(re.finditer(pattern, source, re.S))
    if len(matches) != 1:
        raise ValueError(f'{name}: expected one region, found {len(matches)}')
    match = matches[0]
    return source[:match.start()] + marked(name, content) + source[match.end():]


class Site:
    def __init__(self, root=ROOT):
        self.root = Path(root)
        self.navigation = self.read('site-navigation.json')
        self.seo = self.read('seo.json')
        issues = self.read('blog-issues.json')['issues']
        self.articles = sorted([
            dict(path=f'blog-issue-{i["number"]}.html', title=i['title'].strip(), date=issue_date(i['created_at']),
                 excerpt=issue_excerpt(i), labels=i['labels'] or ['技术笔记'])
            for i in sorted(issues, key=lambda i: i['created_at'], reverse=True)
        ] + self.read('original-articles.json'), key=lambda i: i['date'], reverse=True)
        self.lessons = self.read('interactive-learning.json')
        self.lesson_by_slug = {item['slug']: item for item in self.lessons}
        self.translations = [dict(item, date=self.seo['pages'][item['path']]['datePublished'])
                             for item in self.read('translations.json')]
        self.sections = {item['path']: 'writing' for item in self.articles}
        self.sections.update({item['path']: 'translations' for item in self.translations})
        self.sections.update({item['file']: 'learning' for item in self.lessons})
        self.sections.update({'writing.html': 'writing', 'translations.html': 'translations', 'learning.html': 'learning'})
        self.templates = {path.stem: Template(path.read_text().strip()) for path in (self.root / 'templates').glob('*.html')}
        paths = [item['path'] for item in self.articles + self.translations] + [item['file'] for item in self.lessons]
        if len(paths) != len(set(paths)) or len(self.lesson_by_slug) != len(self.lessons):
            raise ValueError('Catalog paths and lesson slugs must be unique')
        for path in paths:
            if Path(path).name != path or not path.endswith('.html'):
                raise ValueError(f'Catalog path must be a root HTML file: {path}')

    def reading_time(self, path):
        return f'阅读约 {reading_minutes((self.root / path).read_text())} 分钟'

    def read(self, name):
        return json.loads((self.root / 'content' / name).read_text())

    def template(self, name, **values):
        return self.templates[name].substitute(values)

    def header(self, filename):
        links = []
        for item in self.navigation['links']:
            current = ''
            if item['section'] == self.sections.get(filename):
                current = ' aria-current="page"' if item['href'] == './' + filename else ' aria-current="location"'
            links.append(f'<a href="{E(item["href"], quote=True)}"{current}>{E(item["label"])}</a>')
        return self.template('site-header', brand=E(self.navigation['brand']), links=''.join(links))

    def footer(self, filename):
        section = self.sections.get(filename)
        if section == 'learning':
            href, link, attributes = './learning.html', '交互式学习 →', ' class="site-footer"'
        elif filename == 'translations.html':
            href, link, attributes = './index.html', '返回首页', ''
        else:
            href, link, attributes = '#main', '回到顶部 ↑', ''
        return self.template('site-footer', attributes=attributes, label=E(self.navigation['footerLabel']), href=href, link=link)

    def comments(self, filename):
        status = '评论加载中；也可通过上方原 issue 链接查看讨论。' if filename.startswith('blog-issue-') else '评论由 GitHub Discussions 提供。'
        return self.template('comments', status=status)

    def analytics(self):
        return self.template('analytics')

    def post(self, item, arrow=True):
        date = f'<time datetime="{E(item["date"], quote=True)}">{E(item["date"])}</time>' if item.get('date') else ''
        reading = f'<span class="post-reading">{self.reading_time(item["path"])}</span>' if item.get('readingTime') else ''
        return self.template('post', path=E(item['path'], quote=True), title=E(item['title']), date=date,
                             excerpt=E(item['excerpt']), tags=E(' · '.join(item['labels'])), reading=reading,
                             arrow=' <span class="post-arrow" aria-hidden="true">↗</span>' if arrow else '') + '\n'

    def lesson_posts(self):
        return ''.join(self.post(dict(path=i['file'], title=i['title'], excerpt=i['description'], labels=[i['tags']])) for i in self.lessons)

    def home_sections(self):
        home_articles = [item for item in self.articles if item.get('home', True)]
        common = [
            ('writing', 'id="writing"', '01', '思考与实践', 'writing.html', f'全部 {len(self.articles)} 篇 →', ''.join(self.post(i) for i in home_articles[:6])),
            ('translations', 'class="home-translations"', '02', '翻译留档', 'translations.html', '全部翻译 →', ''.join(self.post(i) for i in self.translations)),
            ('learning', 'class="home-learning"', '03', '交互式学习', 'learning.html', f'全部 {len(self.lessons)} 篇 →', self.lesson_posts()),
        ]
        return {name: self.template('home-section', attributes=attrs, id=name, number=number, title=title, path=path, link=link, items=items)
                for name, attrs, number, title, path, link, items in common}

    def collection(self, filename):
        if filename == 'writing.html':
            years = ''
            for year in sorted({i['date'][:4] for i in self.articles}, reverse=True):
                years += f'<section aria-labelledby="year-{year}"><div class="section-heading"><h2 id="year-{year}">{year}</h2></div>'
                years += ''.join(self.post(i) for i in self.articles if i['date'].startswith(year)) + '</section>'
            return self.template('writing-main', count=len(self.articles), years=years)
        if filename == 'learning.html':
            return self.template('learning-main', count=f'{len(self.lessons):02}', items=self.lesson_posts())
        return self.template('translations-main', count=f'{len(self.translations):02}', items=''.join(self.post(i, arrow=False) for i in self.translations))

    def related(self, lesson):
        links = []
        slugs = lesson['related']
        if len(slugs) != len(set(slugs)) or lesson['slug'] in slugs:
            raise ValueError(f'{lesson["file"]}: related lessons must be distinct and exclude itself')
        for slug in slugs:
            item = self.lesson_by_slug[slug]
            links.append(f'<a href="./{E(item["file"], quote=True)}">{E(item["title"])} →</a>')
        return self.template('lesson-related', links=''.join(links))

    def render(self, source, filename):
        source = replace_block(source, 'header', self.header(filename), r'<header class="site-header">.*?</header>')
        if filename != 'index.html' and filename not in {i['path'] for i in self.translations}:
            # Courses also contain authored footers; the site footer is always the last footer.
            footers = list(re.finditer(r'<footer(?:\s[^>]*)?>.*?</footer>', source, re.S))
            if not footers:
                raise ValueError(f'{filename}: site footer missing')
            source = replace_block(source, 'footer', self.footer(filename), re.escape(footers[-1][0]))
        source = replace_block(source, 'analytics', self.analytics(), r'<!-- Cloudflare Web Analytics -->.*?<!-- End Cloudflare Web Analytics -->')
        if filename in self.sections and filename not in ('writing.html', 'translations.html', 'learning.html'):
            source = replace_block(source, 'comments', self.comments(filename), r'<section id="comments".*?</section>')
            source = replace_block(source, 'comment-scripts', COMMENT_SCRIPTS, r'<script src="\./comments-config\.js[^\"]*"[^>]*>\s*</script>\s*<script src="\./comments\.js[^\"]*"[^>]*>\s*</script>')
        if filename == 'index.html':
            patterns = {'writing': r'<section id="writing".*?</section>',
                        'translations': r'<section class="home-translations".*?</section>',
                        'learning': r'<section class="home-learning".*?</section>'}
            for name, content in self.home_sections().items():
                source = replace_block(source, 'home-' + name, content, patterns[name])
        if filename in ('writing.html', 'translations.html', 'learning.html'):
            source = replace_block(source, 'collection', self.collection(filename), r'<main(?:\s[^>]*)?>.*?</main>')
        article = next((i for i in self.articles if i['path'] == filename), None)
        if article and article.get('readingTime'):
            # Only articles opted in through original-articles.json carry the marker.
            source = replace_block(source, 'reading-time', ' · ' + self.reading_time(filename), r'(?!)')
        lesson = next((i for i in self.lessons if i['file'] == filename), None)
        if lesson:
            source = replace_block(source, 'related', self.related(lesson), r'<section class="lesson-related".*?</section>')
        return source

    def outputs(self):
        expected = set(self.sections) | {'index.html'}
        actual = {p.name for p in self.root.glob('*.html')}
        if expected != actual:
            raise ValueError(f'Catalog/page mismatch: missing pages {sorted(expected - actual)}, unregistered pages {sorted(actual - expected)}')
        result = {}
        for path in sorted(self.root.glob('*.html')):
            try:
                result[path] = self.render(path.read_text(), path.name)
            except (ValueError, KeyError) as error:
                raise ValueError(f'{path.name}: {error}') from error
        return result

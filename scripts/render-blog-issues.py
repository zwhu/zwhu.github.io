#!/usr/bin/env python3
"""Render the saved GitHub issue snapshot; Python standard library only.

Run from any directory: python3 scripts/render-blog-issues.py
No generator or GitHub access is required to serve the resulting HTML files.
"""
import html
import json
import re
from datetime import datetime
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlsplit
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
DATA = json.loads((ROOT / 'content/blog-issues.json').read_text())
ISSUES = sorted(DATA['issues'], key=lambda i: i['created_at'], reverse=True)
NUMBERS = {i['number'] for i in ISSUES}
E = html.escape


def date(value):
    return datetime.fromisoformat(value.replace('Z', '+00:00')).astimezone(ZoneInfo('Asia/Shanghai')).date().isoformat()


def filename(issue):
    return f"blog-issue-{issue['number']}.html"


def local_url(value, source):
    value = urljoin(source, value)
    match = re.fullmatch(r'https?://github\.com/zwhu/blog/issues/(\d+)(#[^?]*)?/?', value)
    if match and int(match[1]) in NUMBERS:
        return f'./blog-issue-{match[1]}.html' + (match[2] or '')
    return value


class ArticleHTML(HTMLParser):
    """Keep article markup, discard GitHub UI attributes and active content."""
    tags = set('p div span a img h1 h2 h3 h4 h5 h6 pre code strong em b i del s blockquote ul ol li table thead tbody tfoot tr th td hr br details summary sup sub input kbd dl dt dd'.split())
    void = {'img', 'hr', 'br', 'input'}
    blocked = {'script', 'style', 'iframe', 'object', 'svg'}

    def __init__(self, source):
        super().__init__(convert_charrefs=True)
        self.source, self.out, self.stack = source, [], []
        self.suppressed = 0

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag in self.blocked:
            self.suppressed += 1
        if self.suppressed:
            return
        output = tag if tag in self.tags else None
        values = {}
        if tag == 'markdown-accessiblity-table':
            output, values = 'div', {'class': 'table-scroll', 'tabindex': '0', 'role': 'region', 'aria-label': '正文表格（可横向滚动）'}
        if output:
            for key in ('id', 'title', 'colspan', 'rowspan', 'start'):
                if key in attrs:
                    values[key] = attrs[key]
            if tag == 'a' and 'href' in attrs:
                target = local_url(attrs['href'], self.source)
                if urlsplit(target).scheme in ('', 'https', 'http', 'mailto'):
                    values['href'] = target
            if tag == 'img':
                src = attrs.get('src', '')
                asset = DATA['assets'].get(src, {})
                if 'error' in asset:
                    original = E(asset['original'], quote=True)
                    label = E(attrs.get('alt', '') or '插图')
                    link = '查看原图' if any(t == 'a' for t, _ in self.stack) else f'<a href="{original}">查看原图</a>'
                    self.out.append(f'<span class="missing-image">原图暂不可用：{label}（{link}）</span>')
                    return
                values.update(src='./' + asset['path'] if 'path' in asset else src,
                              alt=attrs.get('alt', ''), loading='lazy')
            if tag == 'input':
                values.update(type='checkbox', disabled='disabled')
                if 'checked' in attrs:
                    values['checked'] = 'checked'
            self.out.append('<' + output + ''.join(f' {k}="{E(v, quote=True)}"' for k, v in values.items()) + '>')
        if tag not in self.void:
            self.stack.append((tag, output))

    def handle_endtag(self, tag):
        if self.suppressed:
            if tag in self.blocked:
                self.suppressed -= 1
            return
        if self.stack and self.stack[-1][0] == tag:
            _, output = self.stack.pop()
            if output:
                self.out.append(f'</{output}>')

    def handle_data(self, data):
        if not self.suppressed:
            self.out.append(E(data, quote=False))


def body(content, source):
    parser = ArticleHTML(source)
    parser.feed(content)
    return ''.join(parser.out)


def excerpt(issue):
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


HEADER = '<a class="skip-link" href="#main">跳到正文</a><header class="site-header"><a class="brand" href="./index.html">zwhu<span>.</span></a><nav aria-label="主导航"><a href="./index.html#writing">思考</a><a href="./translations.html">翻译留档</a><a href="./learning.html">交互式学习</a><a href="./index.html#about">关于</a></nav></header>'
FOOTER = '<footer><span>zwhu / Tech &amp; Notes</span><a href="#main">回到顶部 ↑</a></footer></body></html>\n'


def page_head(title, description):
    return f'<!doctype html>\n<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="description" content="{E(description, quote=True)}"><title>{E(title)} · zwhu</title><link rel="stylesheet" href="./style.css"><link rel="stylesheet" href="./archive.css"><link rel="icon" href="./favicon.ico" sizes="16x16 32x32 48x48"><link rel="icon" href="./favicon.svg" type="image/svg+xml" sizes="any"><link rel="apple-touch-icon" href="./apple-touch-icon.png"></head><body class="issue-page">\n' + HEADER


def listing(issue):
    return f'''<article class="post"><div class="post-top"><h3><a href="./{filename(issue)}">{E(issue['title'].strip())} <span class="post-arrow" aria-hidden="true">↗</span></a></h3><time datetime="{date(issue['created_at'])}">{date(issue['created_at'])}</time></div><p>{E(excerpt(issue))}</p><span class="tags">{E(' · '.join(issue['labels']) or '技术笔记')}</span></article>\n'''


for index, issue in enumerate(ISSUES):
    title = issue['title'].strip()
    created = date(issue['created_at'])
    content = page_head(title, excerpt(issue))
    content += f'<main id="main"><article class="article"><a class="back" href="./writing.html">← 所有文章</a><h1>{E(title)}</h1><div class="meta"><time datetime="{created}">{created}</time> · {E(" · ".join(issue["labels"]))} · <a href="{E(issue["html_url"])}">原 issue #{issue["number"]} ↗</a></div>'
    content += '<div class="prose">' + body(issue['body_html'], issue['html_url']) + '</div>'
    content += '<nav class="article-bottom" aria-label="文章导航"><a href="./writing.html">← 返回文章列表</a>'
    neighbors = ISSUES[max(0, index-1):index] + ISSUES[index+1:index+2]
    for neighbor in neighbors:
        label = '较新一篇' if neighbor['created_at'] > issue['created_at'] else '较早一篇'
        content += f'<a href="./{filename(neighbor)}">{label}：{E(neighbor["title"].strip())}</a>'
    content += '</nav></article>'
    if issue['comments']:
        content += '<section class="historical-comments" aria-labelledby="history-title"><h2 id="history-title">历史评论</h2><p class="comments-status">以下为原 issue 的评论存档；新评论可在下方发表。</p>'
        for comment in issue['comments']:
            content += f'<article class="historical-comment" id="issuecomment-{comment["id"]}"><div class="meta">{E(comment["author"])} · <time datetime="{comment["created_at"]}">{date(comment["created_at"])}</time> · <a href="{E(comment["html_url"])}">原评论 ↗</a></div><div class="prose">{body(comment["body_html"], issue["html_url"])}</div></article>'
        content += '</section>'
    content += '<section id="comments" class="comments" aria-label="文章评论"><h2>评论</h2><div class="giscus"></div><p class="comments-status">评论加载中；也可通过上方原 issue 链接查看讨论。</p></section><script src="./comments-config.js?v=2"></script><script src="./comments.js?v=3" defer></script></main>' + FOOTER
    (ROOT / filename(issue)).write_text(content)

archive = page_head('文章归档', '技术文章、实践与随笔。')
archive += '<main id="main"><section class="intro"><h1>文章归档</h1><p>开发实践、学习笔记与随笔。保留写下这些文字时的思考。</p></section>'
archive += f'<p class="archive-note">共 {len(ISSUES)} 篇，按发表时间倒序排列。</p>'
for year in sorted({date(i['created_at'])[:4] for i in ISSUES}, reverse=True):
    archive += f'<section aria-labelledby="year-{year}"><div class="section-heading"><h2 id="year-{year}">{year}</h2></div>'
    archive += ''.join(listing(i) for i in ISSUES if date(i['created_at']).startswith(year)) + '</section>'
archive += '<p class="archive-note"><a href="./index.html#writing">← 返回首页</a></p></main>' + FOOTER
(ROOT / 'writing.html').write_text(archive)

index_path = ROOT / 'index.html'
index_html = index_path.read_text()
start = index_html.index('<section id="writing"')
end = index_html.index('<section class="home-translations"', start)
writing = f'<section id="writing" aria-labelledby="writing-title"><div class="section-heading"><h2 id="writing-title"><span class="section-index" aria-hidden="true">01</span>思考与实践</h2><a href="./writing.html">全部 {len(ISSUES)} 篇 →</a></div>\n'
writing += ''.join(listing(i) for i in ISSUES[:6]) + '</section>'
index_path.write_text(index_html[:start] + writing + index_html[end:])
print(f'Rendered {len(ISSUES)} articles, archive and home index.')

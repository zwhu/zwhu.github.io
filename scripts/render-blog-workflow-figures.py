#!/usr/bin/env python3
"""Regenerate the blog-workflow figures (mobile shows the same SVGs).

Figure 1 follows content/blog-publishing-workflow.md; figure 2 follows the checks in scripts/verify.py. No dependencies.
"""
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/blog-workflow'
BG, TEXT, MUTED, RED, LINE = '#faf8f3', '#292825', '#77746e', '#a64335', '#e6e2da'
MONO = 'ui-monospace,SFMono-Regular,Menlo,monospace'
FONT = '-apple-system,BlinkMacSystemFont,Segoe UI,PingFang SC,Hiragino Sans GB,Microsoft YaHei,sans-serif'
TITLE = '一篇文章的九步'


class Svg:
    def __init__(self, w, h):
        self.w, self.h, self.parts = w, h, []

    def text(self, x, y, s, size=13, weight=400, fill=MUTED, anchor='start', family=None):
        font = f' style="font-family:{family}"' if family else ''
        self.parts.append(f'<text x="{x}" y="{y}" font-size="{size}" font-weight="{weight}" text-anchor="{anchor}" fill="{fill}"{font}>{escape(s)}</text>')

    def line(self, x1, y1, x2, y2, stroke=LINE, dash=None):
        extra = f' stroke-dasharray="{dash}"' if dash else ''
        self.parts.append(f'<path d="M{x1} {y1}V{y2}" stroke="{stroke}"{extra}/>' if x1 == x2 else f'<path d="M{x1} {y1}H{x2}" stroke="{stroke}"{extra}/>')

    def node(self, nid, x, y, w, h, title, sub, review=False, title_size=15, sub_size=12):
        stroke = RED if review else LINE
        width = ' stroke-width="1.6"' if review else ''
        self.parts.append(f'<rect id="{nid}" data-node-id="{nid}" data-graph-role="node" data-graph-bounds="{x},{y},{x + w},{y + h}" x="{x}" y="{y}" width="{w}" height="{h}" rx="4" fill="{BG}" stroke="{stroke}"{width}/>')
        cx = x + w / 2
        self.text(cx, y + h / 2 - 3, title, title_size, 500, TEXT, 'middle')
        self.text(cx, y + h / 2 + 14, sub, sub_size, 400, MUTED, 'middle')

    def edge(self, eid, points, back=False):
        d = 'M' + ' L'.join(f'{x} {y}' for x, y in points)
        dash = ' stroke-dasharray="4 3"' if back else ''
        self.parts.append(f'<path id="{eid}" data-edge-id="{eid}" data-graph-role="edge" d="{d}" fill="none" stroke="{MUTED}" stroke-width="1.3"{dash} marker-end="url(#arrow)"/>')

    def write(self, name, desc, title=TITLE):
        head = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.w}" height="{self.h}" viewBox="0 0 {self.w} {self.h}" role="img" aria-labelledby="title desc" data-graph-type="flowchart">\n'
                f'<title id="title">{title}</title>\n<desc id="desc">{escape(desc)}</desc>\n'
                f'<style>text{{font-family:{FONT}}}</style>\n'
                f'<defs><marker id="arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0L7 3.5L0 7" fill="{MUTED}"/></marker></defs>\n'
                f'<rect width="{self.w}" height="{self.h}" fill="{BG}" data-graph-role="background"/>\n')
        (OUT / name).write_text(head + '\n'.join(self.parts) + '\n</svg>\n')


def legend(s, x, y, size):
    s.parts.append(f'<rect x="{x}" y="{y - 9}" width="18" height="11" rx="2" fill="{BG}" stroke="{RED}" stroke-width="1.6"/>')
    s.text(x + 26, y, '我审阅', size)
    s.line(x + 90, y - 4, x + 112, y - 4, MUTED)
    s.text(x + 120, y, '往下走', size)
    s.line(x + 184, y - 4, x + 206, y - 4, MUTED, '4 3')
    s.text(x + 214, y, '回头改', size)


def desktop():
    s = Svg(704, 744)
    s.text(24, 32, TITLE, 19, 500, TEXT)
    s.text(24, 57, '我审两次稿、点一次合并；其余由 Agent 执行，GitHub 把关和发布', 13)
    lanes = {'me': 120, 'agent': 352, 'gh': 584}
    for x in (236, 468):
        s.line(x, 82, x, 700)
    s.line(24, 112, 680, 112)
    s.text(lanes['me'], 102, '我', 14, 500, RED, 'middle')
    s.text(lanes['agent'], 102, 'Agent', 14, 500, TEXT, 'middle')
    s.text(lanes['gh'], 102, 'GitHub', 14, 500, TEXT, 'middle')

    w, h = 168, 44
    row = {i: 146 + (i - 1) * 66 for i in range(1, 10)}

    def box(nid, lane, r, title, sub, review=False):
        s.node(nid, lanes[lane] - w // 2, row[r] - h // 2, w, h, title, sub, review)

    s.node('n01', 36, row[1] - h // 2, 400, h, '01 定题、找资料', '我定问题和例子，Agent 找资料、核对出处')
    box('n02', 'agent', 2, '02 建独立工作区', '读规范、偏好和原稿')
    box('n03', 'agent', 3, '03 写正文', '当轮改稿，记下意见')
    box('n03r', 'me', 3, '通读正文', '提修改意见', True)
    box('n04', 'agent', 4, '04 排版与配图', '沿用视觉规范')
    box('n05', 'agent', 5, '05 生成与检查', 'verify.py 与预览')
    box('n05r', 'me', 5, '看整页效果', '桌面和手机', True)
    box('n06', 'agent', 6, '06 提交本篇，开 PR', '只提交本篇，附截图')
    box('n07', 'gh', 7, '07 CI 检查', 'check 通过，分支最新')
    box('n08m', 'me', 8, '点合并', '或开启自动合并')
    box('n08', 'gh', 8, '08 合并 main', 'Pages 自动发布')
    box('n09', 'agent', 9, '09 在线确认', '交付正式链接')

    a, top, bot = lanes['agent'], lambda r: row[r] - h // 2, lambda r: row[r] + h // 2
    me_r, ag_l, ag_r, gh_l = 204, 268, 436, 500
    s.edge('e01', [(a, bot(1)), (a, top(2))])
    s.edge('e02', [(a, bot(2)), (a, top(3))])
    s.edge('e03a', [(ag_l, row[3] - 7), (me_r, row[3] - 7)])
    s.text(236, row[3] - 13, '初稿', 12, anchor='middle')
    s.edge('e03b', [(me_r, row[3] + 7), (ag_l, row[3] + 7)], back=True)
    s.text(236, row[3] + 23, '意见', 12, anchor='middle')
    s.edge('e04', [(a, bot(3)), (a, top(4))])
    s.text(a + 8, bot(3) + 15, '定稿', 12)
    s.edge('e05', [(a, bot(4)), (a, top(5))])
    s.edge('e06a', [(ag_l, row[5]), (me_r, row[5])])
    s.text(236, row[5] - 6, '预览', 12, anchor='middle')
    s.edge('e06b', [(80, top(5)), (80, bot(3))], back=True)
    s.text(88, row[4] + 4, '正文要改', 12)
    s.edge('e06c', [(176, top(5)), (176, row[4]), (ag_l, row[4])], back=True)
    s.text(184, row[4] - 7, '图要改', 12)
    s.edge('e07', [(a, bot(5)), (a, top(6))])
    s.text(a + 8, bot(5) + 15, '通过', 12)
    s.edge('e08', [(a, bot(6)), (a, row[7]), (gh_l, row[7])])
    s.edge('e09', [(lanes['gh'], top(7)), (lanes['gh'], row[5]), (ag_r, row[5])], back=True)
    s.text(lanes['gh'] + 8, row[6] - 4, '失败或冲突', 12)
    s.text(lanes['gh'] + 8, row[6] + 13, '修好回 05', 12)
    s.edge('e10', [(lanes['gh'], bot(7)), (lanes['gh'], top(8))])
    s.text(lanes['gh'] + 8, bot(7) + 15, '通过', 12)
    s.edge('e11', [(me_r, row[8]), (gh_l, row[8])])
    s.edge('e12', [(lanes['gh'], bot(8)), (lanes['gh'], row[9]), (ag_r, row[9])])
    legend(s, 24, 728, 12)
    s.write('flow.svg', '三条泳道的流程图：我、Agent、GitHub。九步从定题到在线确认；我在第 03 步通读正文、第 05 步看整页，最后点合并。虚线是回头路：正文要改回 03，图要改回 04，CI 失败或冲突修好后回 05。')


# Groups and counts mirror checks() in scripts/verify.py; update both together.
CHECK_GROUPS = [
    ('生成区块', '导航、页脚、目录与源文件同步，不覆盖手写正文', 2),
    ('站内链接', '链接、锚点和图片路径都能找到', 2),
    ('学习页样式', '样式归属、主题作用域与加载顺序', 1),
    ('加载预算', 'HTML 与图片体积、响应式图片、统计脚本', 1),
    ('分享与 SEO', '分享图、canonical、sitemap 与发表日期', 3),
    ('评论', 'giscus 按需加载，只初始化一次', 1),
    ('verify 自测', '失败或缺依赖时返回非零，后续照跑', 1),
]
VERIFY_TITLE = '一条命令，两处运行'


def verify():
    total = sum(n for *_, n in CHECK_GROUPS)
    s = Svg(704, 640)
    s.text(24, 32, VERIFY_TITLE, 19, 500, TEXT)
    s.text(24, 57, '本地和 CI 跑同一个 verify.py；任何一项失败，PR 都合不进 main', 13)
    left, right, w, h = 186, 518, 260, 52
    s.node('run-local', left - w // 2, 86, w, h, 'Agent 本地运行', '第 05 步，改完就跑')
    s.node('run-ci', right - w // 2, 86, w, h, 'GitHub Actions', '每个 PR、每次推到 main')
    panel_top, header, row_h = 170, 42, 40
    s.edge('e-local', [(left, 86 + h), (left, panel_top)])
    s.edge('e-ci', [(right, 86 + h), (right, panel_top)])
    bottom = panel_top + header + row_h * len(CHECK_GROUPS)
    s.parts.append(f'<rect x="24" y="{panel_top}" width="656" height="{bottom - panel_top}" rx="4" fill="{BG}" stroke="{LINE}"/>')
    s.text(44, panel_top + 27, 'python3 scripts/verify.py', 14, 500, TEXT, family=MONO)
    s.text(660, panel_top + 27, f'{total} 项 · 只读 · 不联网', 13, 400, RED, 'end')
    for i, (name, what, n) in enumerate(CHECK_GROUPS):
        y = panel_top + header + i * row_h
        s.line(24, y, 680, y)
        s.text(44, y + 25, name, 14, 500, TEXT)
        s.text(164, y + 25, what, 13)
        s.text(660, y + 25, f'{n} 项', 13, 400, MUTED, 'end')
    out = bottom + 40
    s.edge('e-pass', [(left, bottom), (left, out)])
    s.edge('e-fail', [(right, bottom), (right, out)])
    s.node('pass', left - w // 2, out, w, h, '全部通过', 'CI 的 check 变绿，可以合并', True)
    s.node('fail', right - w // 2, out, w, h, '任一失败', '列出失败项，修好后重跑')
    s.text(24, out + h + 36, 'main 设了分支保护：check 不通过或分支落后于 main，都合不进去，管理员也不例外。', 13)
    s.write('verify.svg', f'verify.py 示意图：Agent 在本地第 05 步、GitHub Actions 在每个 PR 上运行同一条命令 python3 scripts/verify.py，共 {total} 项只读检查，分为生成区块、站内链接、学习页样式、加载预算、分享与 SEO、评论和 verify 自测七组。全部通过时 CI 的 check 变绿，可以合并；任一失败则列出失败项，修好后重跑。main 设了分支保护，管理员也不例外。', VERIFY_TITLE)


if __name__ == '__main__':
    desktop()
    verify()

#!/usr/bin/env python3
"""Regenerate offline SVG figures from published benchmark rows.

Authoring dependency: matplotlib. The deployed blog needs no Python runtime.
Set MPLCONFIGDIR to a writable cache directory when running in a sandbox.
"""
import html
import json
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
from statistics import mean

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib import font_manager

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/ub-mode-bench'
DATA = json.loads((ROOT / 'content/ub-mode-bench-data.json').read_text())
BG, TEXT, MUTED, RED, LINE, CODE = '#faf8f3', '#292825', '#77746e', '#a64335', '#e6e2da', '#f0ede6'
MODELS = ['GPT-6.1-Sol', 'GPT-5.6-Luna', 'DeepSeek-V4.1-Flash']
NAMES = ['Sol', 'Luna', 'DeepSeek']
FONT = '-apple-system,BlinkMacSystemFont,Segoe UI,PingFang SC,Hiragino Sans GB,Microsoft YaHei,sans-serif'
for candidate in ['/System/Library/Fonts/Hiragino Sans GB.ttc', '/System/Library/Fonts/STHeiti Light.ttc']:
    if Path(candidate).exists():
        font_manager.fontManager.addfont(candidate)
        plt.rcParams['font.family'] = font_manager.FontProperties(fname=candidate).get_name()
        break
plt.rcParams.update({'svg.fonttype': 'none', 'svg.hashsalt': DATA['source_commit'], 'axes.unicode_minus': False,
                     'figure.facecolor': BG, 'axes.facecolor': BG,
                     'text.color': TEXT, 'axes.labelcolor': MUTED,
                     'xtick.color': MUTED, 'ytick.color': TEXT,
                     'font.size': 10})


def save(fig, name):
    path = OUT / (name + '.svg')
    fig.savefig(path, format='svg', facecolor=BG, metadata={'Date': None, 'Creator': 'matplotlib; published ub-mode-bench report rows'})
    path.write_text('\n'.join(line.rstrip() for line in path.read_text().splitlines()) + '\n')
    plt.close(fig)


def legend(fig, scatter=False):
    size = 10
    fig.text(.06, .894, '● 普通方式', color=MUTED, fontsize=size)
    fig.text(.30, .894, '● ub-mode', color=RED, fontsize=size)
    if scatter:
        fig.text(.55, .894,
                 '大点：均值　空心小点：单次', color=MUTED, fontsize=size - .5)


def pair_panel(ax, rows, key, limit, scatter=False, missing_note=False):
    ax.set_xlim(0, limit)
    ax.set_ylim(-.58, 2.65)
    ax.set_yticks([2, 1, 0], NAMES)
    ax.tick_params(axis='y', length=0, labelsize=10.5, pad=10)
    ax.tick_params(axis='x', length=0, labelsize=9, pad=6)
    ax.xaxis.set_major_locator(plt.MaxNLocator(6, integer=True))
    ax.grid(axis='x', color=LINE, linewidth=.7)
    ax.set_axisbelow(True)
    for spine in ax.spines.values():
        spine.set_visible(False)
    for model, y in zip(MODELS, [2, 1, 0]):
        samples = [[r[key] for r in rows if r['model'] == model and r['variant'] == v and r[key] is not None] for v in ['A', 'C']]
        means = [mean(values) for values in samples]
        ax.plot(means, [y, y], color=LINE, linewidth=2.8, zorder=1)
        for i, (value, values, color) in enumerate(zip(means, samples, [MUTED, RED])):
            if scatter:
                offsets = [-.08, 0, .08]
                ax.scatter(values, [y + offsets[k] for k in range(len(values))], s=24,
                           facecolors=BG, edgecolors=color, linewidths=.8, alpha=.85, zorder=2)
            ax.scatter([value], [y], s=44, color=color, zorder=3)
            decimal_mean = sum(Decimal(str(v)) for v in values) / Decimal(len(values))
            label = str(decimal_mean.quantize(Decimal('.01'), rounding=ROUND_HALF_UP))
            if missing_note and model == MODELS[2] and i == 1:
                label += ' *'
            ax.annotate(label, (value, y), xytext=(0, 9 if i == 0 else -17), textcoords='offset points',
                        ha='center', color=color, fontsize=10)


def paired_chart(name, title, panels, scatter=False, footer=''):
    fig = plt.figure(figsize=(7.04, 5.9), dpi=100)
    fig.text(.06, .95, title, fontsize=14, fontweight='medium')
    legend(fig, scatter)
    for idx, (label, rows, key, limit, missing) in enumerate(panels):
        top = .76 if idx == 0 else .365
        fig.text(.06, top + .045, label, fontsize=11)
        ax = fig.add_axes([.19, top - .21, .73, .25])
        pair_panel(ax, rows, key, limit, scatter, missing)
    fig.text(.06, .035, footer, color=MUTED, fontsize=9, linespacing=1.6)
    save(fig, name)


class Diagram:
    def __init__(self, width, height, title, subtitle=''):
        self.w, self.h = width, height
        self.parts = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img" aria-labelledby="title" data-graph-type="flowchart">',
                      f'<title id="title">{html.escape(title)}</title>',
                      f'<style>text{{font-family:{FONT}}}</style>',
                      f'<defs><marker id="arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0L7 3.5L0 7" fill="{MUTED}"/></marker></defs>',
                      f'<rect width="{width}" height="{height}" fill="{BG}" data-graph-role="background"/>']
        self.text(24, 32, title, 19, weight=500)
        if subtitle:
            self.text(24, 57, subtitle, 13, MUTED)

    def text(self, x, y, value, size=14, color=TEXT, anchor='start', weight=400, owner=None):
        # Text inside its own node is node content, not an external edge label.
        self.parts.append(f'<text x="{x}" y="{y}" font-size="{size}" font-weight="{weight}" text-anchor="{anchor}" fill="{color}">{html.escape(value)}</text>')

    def node(self, ident, x, y, w, h, title, detail='', accent=False):
        stroke = RED if accent else LINE
        self.parts.append(f'<rect id="{ident}" data-node-id="{ident}" data-graph-role="node" data-graph-bounds="{x},{y},{x+w},{y+h}" x="{x}" y="{y}" width="{w}" height="{h}" rx="4" fill="{BG}" stroke="{stroke}"/>')
        lines = detail.split('\n') if detail else []
        total = (len(lines) + 1) * 22
        baseline = y + (h - total) / 2 + 18
        self.text(x+w/2, baseline, title, 16, RED if accent else TEXT, 'middle', 500, ident)
        for i, line in enumerate(lines):
            self.text(x+w/2, baseline + (i+1)*22, line, 13, MUTED, 'middle', owner=ident)

    def edge(self, ident, source, target, points):
        path = 'M' + ' L'.join(f'{x} {y}' for x, y in points)
        self.parts.append(f'<path id="{ident}" data-edge-id="{ident}" data-source="{source}" data-target="{target}" data-graph-role="edge" d="{path}" fill="none" stroke="{MUTED}" stroke-width="1.25" marker-end="url(#arrow)"/>')

    def save(self, name):
        self.parts.append('</svg>')
        (OUT / (name + '.svg')).write_text('\n'.join(self.parts) + '\n')


def design():
    d = Diagram(704, 476, '同一个任务，加不加 ub-mode', '同模型比较 · 独立运行 · 共同验收')
    d.node('start', 200, 88, 304, 64, '同一份修复起点', '源码＋问题描述＋测试命令')
    d.node('a', 30, 214, 278, 80, '普通组 A', '无额外 Skill')
    d.node('c', 396, 214, 278, 80, 'ub-mode C', '规范＋配套质量工具', True)
    d.node('eval', 200, 350, 304, 64, '共同的外部验收', '行为测试＋质量指标')
    d.edge('sa', 'start', 'a', [(250,152),(250,182),(169,182),(169,214)])
    d.edge('sc', 'start', 'c', [(454,152),(454,182),(535,182),(535,214)])
    d.edge('ae', 'a', 'eval', [(169,294),(169,322),(250,322),(250,350)])
    d.edge('ce', 'c', 'eval', [(535,294),(535,322),(454,322),(454,350)])
    d.text(24, 454, '第一轮：3 任务 × 3 模型 × 2 组 × 3 次 = 54　　第二轮：1 任务 × 3 模型 × 2 组 × 3 次 = 18', 12, MUTED)
    d.save('01-design')


def vue_bug():
    d = Diagram(704, 614, 'Vue：重复编译怎样丢失导入', '简化的触发链；关注最终编译行为')
    steps = [('首次分析模板', '识别只在模板中使用的导入'), ('模板被转换', '模板 AST 的状态发生变化'),
             ('分析缓存失效', '先前的分析结果不再可用'), ('再次分析已转换模板', '可能漏掉模板使用的导入'),
             ('修复应保持的行为', '重复编译后，导入与输出仍正确')]
    x, w, h, gap = 130, 444, 64, 40
    for i, (title, detail) in enumerate(steps):
        y = 90 + i*(h+gap)
        d.node(f'n{i}', x,y,w,h,title,detail,i==4)
        if i:
            d.edge(f'e{i}',f'n{i-1}',f'n{i}',[(x+w/2,y-gap),(x+w/2,y)])
    d.save('03-vue-bug')


def audit():
    d = Diagram(704, 742, '评测本身，也需要被检验')
    x,w,h = 130,444,66
    flows = [
        [('依赖包带着现成修复', '断网环境仍存在参考实现'), ('排除受影响结果', '36 次正式结果＋6 次试跑作废'), ('锁定修复前依赖，重跑', '最终只统计干净的正式结果')],
        [('隐藏断言限定内部实现', '复制 AST 的合法修复被判失败'), ('保留原始记录，统一复核', '对全部 18 份修复重新检查行为'), ('只导入生产源码核验', '恢复原版测试，并加入新输入')]
    ]
    for f, steps in enumerate(flows):
        start = [85,440][f]
        for i,(title,detail) in enumerate(steps):
            y=start+i*100
            d.node(f'f{f}n{i}',x,y,w,h,title,detail,i==2)
            if i:
                d.edge(f'f{f}e{i}',f'f{f}n{i-1}',f'f{f}n{i}',[(x+w/2,y-100+h),(x+w/2,y)])
        if f == 0:
            divider = 396
            d.parts.append(f'<path d="M24 {divider} H{d.w-24}" stroke="{LINE}" data-graph-role="decoration"/>')
    d.save('07-audit')


def gates():
    d = Diagram(704, 590, '我更重视的工程反馈闭环', '作者的工作流选择；未作为实验第三组')
    x,w,h,pitch = 142,420,70,116
    steps=[('LLM 修改代码','实现需求或修复问题'),('独立门禁执行检查','lint / 类型检查 / 测试 / CI'),('读取实际检查结果','退出状态＋报告＋行为证据'),('进入审查与交付','检查通过，保留必要的人工判断')]
    for i,(title,detail) in enumerate(steps):
        y=90+i*pitch
        d.node(f'n{i}',x,y,w,h,title,detail,i==1)
        if i:
            d.edge(f'e{i}',f'n{i-1}',f'n{i}',[(x+w/2,y-pitch+h),(x+w/2,y)])
    side=50
    d.edge('feedback','n1','n0',[(x,90+pitch+h/2),(side,90+pitch+h/2),(side,90+h/2),(x,90+h/2)])
    d.text(side+10, 186, '未通过', 12, MUTED)
    d.text(24, 558, '返回具体诊断继续修复；交付依据来自实际执行。', 13, MUTED)
    d.save('08-gates')


OUT.mkdir(exist_ok=True)
design()
vue_bug()
audit()
gates()
paired_chart('02-small-cost', '小任务：通过率相同，成本不同', [
    ('平均耗时／分钟', DATA['small'], 'minutes',12,False),
    ('业务源码改动／新增＋删除行', DATA['small'],'code_lines',36,False)],
    footer='每组每模型 n=9；均值来自公开逐次记录。\n时间不含外部评分；源码行数不含测试与日志。')
paired_chart('04-vue-cost', 'Vue：耗时与源码改动的变化', [
    ('平均耗时／分钟', DATA['vue'],'minutes',32,False),
    ('业务源码改动／新增＋删除行', DATA['vue'],'code_lines',300,False)],scatter=True,
    footer='每组每模型 n=3；散点展示独立运行的波动。\n时间不含外部评分；源码行数不含测试与日志。')
paired_chart('05-crap', 'CRAP 风险分：越低通常越好', [
    ('第一轮：小任务；每组每模型 n=9',DATA['small'],'crap_mean',8,False),
    ('第二轮：Vue；每组每模型 n=3 *',DATA['vue'],'crap_mean',28,True)],
    footer='* Vue DeepSeek 的 ub-mode 组仅 n=2。\n扫描各自改动文件，范围可能不同；两面板刻度不同。')
print('Generated 7 figures.')

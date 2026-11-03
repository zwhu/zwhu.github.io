#!/usr/bin/env python3
"""Render the about-page ability map from content/about-map.json into about.html.

Cells come from a power (weighted Voronoi) diagram whose areas follow `area`;
each convex cell is inset and drawn with rounded corners. On wide screens the
top-left `hole` is left for the whoami terminal, and cells wrap around it;
the terminal also prints the selected cell (about-map.js).
Standard library only.
--check fails when the generated block in about.html is out of date.
"""
import argparse
import html
import json
import math
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / 'about.html'
BLOCK = re.compile(r'<!-- about-map:start -->.*?<!-- about-map:end -->', re.S)
NAME = re.compile(r'(<span class="map-name">).*?(</span>)')
READOUT = re.compile(r'(<span class="line map-readout"[^>]*>).*?(</span>)')
E = html.escape
SYMBOL = {'dark': '●', 'mid': '◑', 'light': '○', 'contour': '◎'}
# Wide wraps the terminal on the 864px about-page column; medium stacks the terminal above a
# landscape map for tablets; narrow is portrait for phones. Wide gaps and corner radii keep cells soft.
LAYOUTS = {'wide': dict(w=864, h=560, gap=8, radius=42, swap=False, hole=(330, 360)),
           'medium': dict(w=704, h=420, gap=7, radius=34, swap=False),
           'narrow': dict(w=331, h=560, gap=5, radius=24, swap=True)}
RINGS = 18


def area(poly):
    return abs(sum(x0 * y1 - x1 * y0 for (x0, y0), (x1, y1) in zip(poly, poly[1:] + poly[:1]))) / 2


def centroid(poly):
    a = cx = cy = 0
    for (x0, y0), (x1, y1) in zip(poly, poly[1:] + poly[:1]):
        cross = x0 * y1 - x1 * y0
        a, cx, cy = a + cross, cx + (x0 + x1) * cross, cy + (y0 + y1) * cross
    if abs(a) < 1e-9:
        return sum(p[0] for p in poly) / len(poly), sum(p[1] for p in poly) / len(poly)
    return cx / (3 * a), cy / (3 * a)


def clip(poly, a, b):
    """Keep the part of a convex polygon where a·p <= b."""
    out = []
    for p, q in zip(poly, poly[1:] + poly[:1]):
        fp, fq = a[0] * p[0] + a[1] * p[1] - b, a[0] * q[0] + a[1] * q[1] - b
        if fp <= 0:
            out.append(p)
        if fp * fq < 0:
            t = fp / (fp - fq)
            out.append((p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])))
    return out


def cells(sites, weights, w, h, shift=0):
    polys = []
    for i, (si, wi) in enumerate(zip(sites, weights)):
        poly = [(shift, shift), (w - shift, shift), (w - shift, h - shift), (shift, h - shift)]
        for j, (sj, wj) in enumerate(zip(sites, weights)):
            if i == j or not poly:
                continue
            a = (2 * (sj[0] - si[0]), 2 * (sj[1] - si[1]))
            b = sj[0] ** 2 + sj[1] ** 2 - si[0] ** 2 - si[1] ** 2 - wj + wi
            poly = clip(poly, a, b - shift * math.hypot(*a))
        polys.append(poly)
    return polys


def notch(poly, hole):
    """Remove the top-left rectangle from a convex cell; the rest stays one simple polygon."""
    hw, hh = hole
    out_of = lambda p: p[0] >= hw or p[1] >= hh
    start = next((i for i, p in enumerate(poly) if out_of(p)), None)
    if start is None:
        return []
    poly, out, entered = poly[start:] + poly[:start], [], None
    for p, q in zip(poly, poly[1:] + poly[:1]):
        if out_of(p):
            out.append(p)
        # Interval of the segment that lies inside x < hw and y < hh.
        lo, hi, lo_side, hi_side = 0.0, 1.0, None, None
        for axis, limit in ((0, hw), (1, hh)):
            d = q[axis] - p[axis]
            if abs(d) < 1e-12:
                if p[axis] >= limit:
                    lo, hi = 1.0, 0.0
                continue
            t = (limit - p[axis]) / d
            if d < 0 and t > lo:
                lo, lo_side = t, axis
            elif d > 0 and t < hi:
                hi, hi_side = t, axis
        if lo >= hi:
            continue
        at = lambda t: (p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1]))
        if lo_side is not None:
            out.append(at(lo))
            entered = lo_side
        if hi_side is not None:
            if entered is not None and entered != hi_side:
                out.append((hw, hh))
            out.append(at(hi))
    return out


def layout(items, w, h, gap, swap, hole=None):
    total = sum(item['area'] for item in items)
    targets = [item['area'] / total * (w * h - (hole[0] * hole[1] if hole else 0)) for item in items]
    anchors = [((item['y'], item['x']) if swap else (item['x'], item['y'])) for item in items]
    anchors = [(0.04 * w + 0.92 * x * w, 0.04 * h + 0.92 * y * h) for x, y in anchors]
    sites, weights = list(anchors), [0.0] * len(items)

    def diagram(shift=0):
        polys = cells(sites, weights, w, h, shift)
        return [notch(poly, (hole[0] + shift, hole[1] + shift)) if hole and poly else poly for poly in polys]

    for step in range(500):
        for i, poly in enumerate(diagram()):
            if not poly or area(poly) < 1:
                sites[i], weights[i] = anchors[i], 0.0
                continue
            radius = math.sqrt(max(weights[i], 0)) + 0.5 * (math.sqrt(targets[i] / math.pi) - math.sqrt(area(poly) / math.pi))
            weights[i] = max(radius, 0) ** 2
            cx, cy = centroid(poly)
            pull = 0.08 if step < 350 else 0.0
            x = 0.6 * cx + 0.4 * sites[i][0] + pull * (anchors[i][0] - cx)
            y = 0.6 * cy + 0.4 * sites[i][1] + pull * (anchors[i][1] - cy)
            if hole and x < hole[0] and y < hole[1]:
                x, y = (hole[0], y) if hole[0] - x < hole[1] - y else (x, hole[1])
            sites[i] = (x, y)
        # A site must stay outside every neighbour's power circle, or its cell disappears.
        for i, si in enumerate(sites):
            nearest = min(math.dist(si, sj) for j, sj in enumerate(sites) if j != i)
            weights[i] = min(weights[i], (0.9 * nearest) ** 2)
    return diagram(gap / 2)


def rounded(poly, radius):
    n, parts = len(poly), []
    for i, v in enumerate(poly):
        p, q = poly[i - 1], poly[(i + 1) % n]
        r = min(radius, 0.5 * math.dist(v, p), 0.5 * math.dist(v, q))
        a = (v[0] + (p[0] - v[0]) * r / math.dist(v, p), v[1] + (p[1] - v[1]) * r / math.dist(v, p))
        b = (v[0] + (q[0] - v[0]) * r / math.dist(v, q), v[1] + (q[1] - v[1]) * r / math.dist(v, q))
        parts.append(('M' if not i else 'L') + f'{a[0]:.1f} {a[1]:.1f}Q{v[0]:.1f} {v[1]:.1f} {b[0]:.1f} {b[1]:.1f}')
    return ''.join(parts) + 'Z'


def scaled(poly, centre, k):
    return [(centre[0] + (x - centre[0]) * k, centre[1] + (y - centre[1]) * k) for x, y in poly]


def inside(poly, point):
    x, y, hit = point[0], point[1], False
    for (x0, y0), (x1, y1) in zip(poly, poly[1:] + poly[:1]):
        if (y0 > y) != (y1 > y) and x < x0 + (y - y0) * (x1 - x0) / (y1 - y0):
            hit = not hit
    return hit


def edge_distance(poly, point):
    best = math.inf
    for p, q in zip(poly, poly[1:] + poly[:1]):
        dx, dy = q[0] - p[0], q[1] - p[1]
        t = max(0, min(1, ((point[0] - p[0]) * dx + (point[1] - p[1]) * dy) / (dx * dx + dy * dy or 1)))
        best = min(best, math.dist(point, (p[0] + t * dx, p[1] + t * dy)))
    return best


def anchor(poly):
    """The inner point farthest from the edges, so labels and contours sit in notched cells too."""
    xs, ys = [p[0] for p in poly], [p[1] for p in poly]
    grid = [(x0 + (x1 - x0) * i / 24, y0 + (y1 - y0) * j / 24)
            for x0, x1, y0, y1 in [(min(xs), max(xs), min(ys), max(ys))] for i in range(1, 24) for j in range(1, 24)]
    points = [pt for pt in grid if inside(poly, pt)] or [centroid(poly)]
    # Prefer the centroid when it is nearly as deep, which keeps convex cells balanced.
    best = max(points, key=lambda pt: edge_distance(poly, pt))
    centre = centroid(poly)
    if inside(poly, centre) and edge_distance(poly, centre) > 0.8 * edge_distance(poly, best):
        return centre
    return best


def text_width(text, size):
    return sum(size if ord(ch) > 0x2e80 else 0.6 * size for ch in text)


def fits(poly, centre, width, height):
    x, y = centre
    box = [(x + dx * width / 2, y + dy * height / 2) for dx in (-1, 0, 1) for dy in (-1, 0, 1)]
    return all(inside(poly, pt) and edge_distance(poly, pt) > 5 for pt in box)


def label(item, poly, centre, scale):
    """Pick the richest label that fits: name and sub, name only, or the tone symbol."""
    x, y = centre
    for size in (13 * scale, 12 * scale):
        sub = item.get('sub')
        if sub and fits(poly, (x, y + 4), max(text_width(item['name'], size), text_width(sub, 10)) + 8, size + 22):
            return (f'<text x="{x:.1f}" y="{y - 4:.1f}" font-size="{size:.0f}">{E(item["name"])}</text>'
                    f'<text class="sub" x="{x:.1f}" y="{y + 13:.1f}" font-size="10">{E(sub)}</text>')
        if fits(poly, centre, text_width(item['name'], size) + 8, size + 6):
            return f'<text x="{x:.1f}" y="{y + size * 0.36:.1f}" font-size="{size:.0f}">{E(item["name"])}</text>'
    return f'<text class="mark" x="{x:.1f}" y="{y + 4:.1f}" font-size="12">{SYMBOL[item["tone"]]}</text>'


def svg(items, name, w, h, gap, radius, swap, hole=None):
    out = [f'<svg class="ability-map ability-map-{name}" viewBox="0 0 {w} {h}" width="{w}" height="{h}" '
           f'role="group" aria-label="能力与兴趣圈，面积越大投入越多">']
    for index, (item, poly) in enumerate(zip(items, layout(items, w, h, gap, swap, hole))):
        centre = anchor(poly)
        shapes = [f'<path class="shape" d="{rounded(poly, radius)}"/>']
        if item['tone'] == 'contour':
            # Like the Free area of the Kanso disk map, contour lines shrink toward a point above and left of
            # the label, so they bunch on that side and open up below; the full corner radius rounds inner lines.
            xs, ys = [p[0] for p in poly], [p[1] for p in poly]
            focus = (centre[0] - 0.14 * (max(xs) - min(xs)), centre[1] - 0.2 * (max(ys) - min(ys)))
            shapes += [f'<path class="ring" d="{rounded(scaled(poly, focus, k / RINGS), radius)}"/>'
                       for k in range(RINGS - 1, 1, -1)]
        out.append(f'<g class="cell tone-{item["tone"]}" tabindex="0" role="button" aria-pressed="{str(not index).lower()}" '
                   f'aria-label="{E(item["name"])}" data-name="{E(item["name"])}" data-detail="{E(item["detail"])}">'
                   f'{"".join(shapes)}'
                   f'{label(item, poly, centre, 1 if name == "wide" else 0.95)}</g>')
    return ''.join(out) + '</svg>'


def block(root=ROOT):
    items = json.loads((root / 'content/about-map.json').read_text())['cells']
    maps = '\n'.join(svg(items, name, **options) for name, options in LAYOUTS.items())
    return '<!-- about-map:start -->\n' + maps + '\n<!-- about-map:end -->'


def render(page, root=ROOT):
    """Write the maps and seed the terminal readout with the first cell, so the page reads without JavaScript."""
    first = json.loads((root / 'content/about-map.json').read_text())['cells'][0]
    page = BLOCK.sub(lambda _: block(root), page)
    page = NAME.sub(lambda m: m.group(1) + E(first['name']) + m.group(2), page)
    return READOUT.sub(lambda m: m.group(1) + E(first['detail']) + m.group(2), page)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='only verify about.html is up to date')
    args = parser.parse_args()
    page = PAGE.read_text()
    w, h, (hw, hh), gap = (LAYOUTS['wide'][key] for key in ('w', 'h', 'hole', 'gap'))
    hole_css = f'width:calc({hw} / {w} * 100% - {gap / 2:g}px);height:calc({hh} / {h} * 100% - {gap / 2:g}px)'
    if hole_css not in (ROOT / 'style.css').read_text():
        print(f'style.css .about-board .whoami must use {hole_css}', file=sys.stderr)
        return 1
    if not (BLOCK.search(page) and NAME.search(page) and READOUT.search(page)):
        print('about.html is missing the about-map markers or terminal readout', file=sys.stderr)
        return 1
    updated = render(page)
    if args.check:
        if updated != page:
            print('About map is stale; run scripts/render-about-map.py', file=sys.stderr)
            return 1
        print('About map is up to date.')
        return 0
    PAGE.write_text(updated)
    print('Rendered about map into about.html.')
    return 0


if __name__ == '__main__':
    sys.exit(main())

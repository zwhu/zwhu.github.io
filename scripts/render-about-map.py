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
# landscape map for tablets; narrow is portrait for phones. Narrow gaps and small corner trims keep neighbouring polygon edges aligned.
LAYOUTS = {'wide': dict(w=864, h=560, gap=4, radius=24, swap=False, hole=(340, 360), shore=(340, 720, 360)),
           'medium': dict(w=704, h=420, gap=4, radius=20, swap=False),
           'narrow': dict(w=331, h=560, gap=3, radius=14, swap=True)}
RINGS = 10


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


def shore_polygon(start, right, bottom):
    # The introduction has a flat lower edge, then the contour field sweeps upward.
    return [(0, 0)] + [(start + (right - start) * math.cos(i * math.pi / 64),
                       bottom * math.sin(i * math.pi / 64)) for i in range(33)] + [(0, bottom)]


def subtract(poly, hole):
    """Keep the boundary outside a convex hole, including the reversed shoreline."""
    segments = []

    def boundary(source, cutter, keep_inside):
        for p, q in zip(source, source[1:] + source[:1]):
            ts = [0.0, 1.0]
            dx, dy = q[0] - p[0], q[1] - p[1]
            for u, v in zip(cutter, cutter[1:] + cutter[:1]):
                ex, ey = v[0] - u[0], v[1] - u[1]
                det = dx * ey - dy * ex
                if abs(det) < 1e-9:
                    continue
                ux, uy = u[0] - p[0], u[1] - p[1]
                t, z = (ux * ey - uy * ex) / det, (ux * dy - uy * dx) / det
                if 0 < t < 1 and -1e-8 <= z <= 1 + 1e-8:
                    ts.append(t)
            ts = sorted(set(round(t, 10) for t in ts))
            at = lambda t: (p[0] + t * dx, p[1] + t * dy)
            for lo, hi in zip(ts, ts[1:]):
                if hi - lo < 1e-8:
                    continue
                if inside(cutter, at((lo + hi) / 2)) == keep_inside:
                    segments.append((at(lo), at(hi)) if not keep_inside else (at(hi), at(lo)))

    boundary(poly, hole, False)
    boundary(hole, poly, True)
    loops = []
    while segments:
        first, end = segments.pop(0)
        loop = [first, end]
        while math.dist(end, first) > 1e-5:
            match = next((i for i, (p, q) in enumerate(segments) if math.dist(p, end) < 1e-5), None)
            if match is None:
                break
            _, end = segments.pop(match)
            loop.append(end)
        if len(loop) > 3 and math.dist(end, first) < 1e-5:
            loops.append(loop[:-1])
    return max(loops, key=area) if loops else []


def layout(items, w, h, gap, swap, hole=None, shore=None):
    total = sum(item['area'] for item in items)
    targets = [item['area'] / total * (w * h - (area(shore_polygon(*shore)) if shore else 0)) for item in items]
    anchors = [((item['y'], item['x']) if swap else (item['x'], item['y'])) for item in items]
    anchors = [(0.04 * w + 0.92 * x * w, 0.04 * h + 0.92 * y * h) for x, y in anchors]
    def outside(pt):
        if not shore:
            return pt
        start, right, bottom = shore
        x, y = pt
        distance = math.hypot(max(0, x - start) / (right - start), y / bottom)
        if distance < 1.03:
            return (x if x < start else start + (x - start) * 1.03 / distance, y * 1.03 / distance)
        return pt

    anchors = [outside(pt) for pt in anchors]
    sites, weights = list(anchors), [0.0] * len(items)

    def diagram(shift=0):
        polys = cells(sites, weights, w, h, shift)
        return [subtract(poly, shore_polygon(shore[0] + shift, shore[1] + shift, shore[2] + shift)) if shore and poly else poly for poly in polys]

    for step in range(500):
        for i, poly in enumerate(diagram()):
            if not poly or area(poly) < 1:
                sites[i], weights[i] = anchors[i], 0.0
                continue
            radius = math.sqrt(max(weights[i], 0)) + 0.5 * (math.sqrt(targets[i] / math.pi) - math.sqrt(area(poly) / math.pi))
            weights[i] = max(radius, 0) ** 2
            cx, cy = centroid(poly)
            pull = 0.28 if shore and anchors[i][0] < hole[0] + 40 else (0.08 if step < 350 else 0.0)
            x = 0.6 * cx + 0.4 * sites[i][0] + pull * (anchors[i][0] - cx)
            y = 0.6 * cy + 0.4 * sites[i][1] + pull * (anchors[i][1] - cy)
            sites[i] = outside((x, y))
        # A site must stay outside every neighbour's power circle, or its cell disappears.
        for i, si in enumerate(sites):
            nearest = min(math.dist(si, sj) for j, sj in enumerate(sites) if j != i)
            weights[i] = min(weights[i], (0.9 * nearest) ** 2)
    return diagram(gap / 2)


def rounded(poly, radius):
    poly = list(poly)
    changed = True
    while changed and len(poly) > 3:
        changed = False
        for i, v in enumerate(poly):
            p, q = poly[i - 1], poly[(i + 1) % len(poly)]
            u, t = (v[0] - p[0], v[1] - p[1]), (q[0] - v[0], q[1] - v[1])
            cosine = (u[0] * t[0] + u[1] * t[1]) / (math.hypot(*u) * math.hypot(*t) or 1)
            if cosine > math.cos(math.radians(10)):
                poly.pop(i)
                changed = True
                break
    n, parts = len(poly), []
    for i, v in enumerate(poly):
        p, q = poly[i - 1], poly[(i + 1) % n]
        ra, rb = min(radius, 0.4 * math.dist(v, p)), min(radius, 0.4 * math.dist(v, q))
        a = (v[0] + (p[0] - v[0]) * ra / math.dist(v, p), v[1] + (p[1] - v[1]) * ra / math.dist(v, p))
        b = (v[0] + (q[0] - v[0]) * rb / math.dist(v, q), v[1] + (q[1] - v[1]) * rb / math.dist(v, q))
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


def svg(items, name, w, h, gap, radius, swap, hole=None, shore=None):
    out = [f'<svg class="ability-map ability-map-{name}" viewBox="0 0 {w} {h}" width="{w}" height="{h}" '
           f'role="group" aria-label="能力与兴趣圈，面积越大投入越多">']
    drawing_items = [item for item in items if not shore or item['tone'] != 'contour']
    if shore:
        item = next(item for item in items if item['tone'] == 'contour')
        field = [(shore[0] + gap / 2, 0)] + shore_polygon(shore[0] + gap / 2, shore[1] - gap / 2, shore[2] - gap / 2)[1:-1]
        outline = lambda points: rounded(points, 18)
        cx, cy = centroid(field)
        focus = (cx, cy)
        # Leave a quiet central area for the two-line label; seven widely spaced contours surround it.
        rings = ''.join(f'<path class="ring" d="{outline(scaled(field, focus, 0.94 - i * 0.06))}"/>' for i in range(7))
        out.append(f'<g class="cell tone-contour contour-field" tabindex="0" role="button" aria-pressed="true" '
                   f'aria-label="{E(item["name"])}" data-name="{E(item["name"])}" data-detail="{E(item["detail"])}">'
                   f'<path class="shape" d="{outline(field)}"/>{rings}'
                   f'<text x="{cx:.1f}" y="{cy - 2:.1f}" font-size="17">{E(item["name"])}</text>'
                   f'<text class="sub" x="{cx:.1f}" y="{cy + 18:.1f}" font-size="11">{E(item["sub"])}</text></g>')
    for index, (item, poly) in enumerate(zip(drawing_items, layout(drawing_items, w, h, gap, swap, hole, shore))):
        if not poly or area(poly) < 1:
            raise ValueError(f"Empty ability cell: {name} / {item['name']}")
        centre = anchor(poly)
        shapes = [f'<path class="shape" d="{rounded(poly, radius)}"/>']
        if item['tone'] == 'contour':
            # Keep contours concentric with the label, with fewer lines and an open centre.
            focus = centre
            shapes += [f'<path class="ring" d="{rounded(scaled(poly, focus, k / RINGS), radius)}"/>'
                       for k in range(RINGS - 1, 3, -1)]
        out.append(f'<g class="cell tone-{item["tone"]}" tabindex="0" role="button" aria-pressed="{str(not shore and not index).lower()}" '
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

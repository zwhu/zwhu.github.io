#!/usr/bin/env python3
"""Render the about-page ability map from content/about-map.json into about.html.

Cells come from a power (weighted Voronoi) diagram whose areas follow `area`;
each cell is inset by half the
gap and drawn with rounded corners, so neighbours keep parallel edges and even
paths between them. On wide screens the top-left `hole` is left for the whoami
terminal and the contour cell is a lawn beside it, bounded below by one arc
(`lawn`); the other cells fill the space under the arc, so their tops follow
it. The terminal also prints the selected cell (about-map.js). The lawn's
contours come from a height field that peaks under its label.
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

from site_paths import ROOT, SITE_ROOT
PAGE = SITE_ROOT / 'about.html'
BLOCK = re.compile(r'<!-- about-map:start -->.*?<!-- about-map:end -->', re.S)
NAME = re.compile(r'(<span class="map-name">).*?(</span>)')
READOUT = re.compile(r'(<span class="line map-readout"[^>]*>).*?(</span>)')
E = html.escape
SYMBOL = {'dark': '●', 'mid': '◑', 'light': '○', 'contour': '◎'}
# Wide wraps the terminal on the 864px about-page column; medium stacks the terminal above a
# landscape map for tablets; narrow is portrait for phones. Narrow gaps and small corner trims keep neighbouring polygon edges aligned.
# On wide, `lawn` is the Bézier under the lawn, traced from the user's sketch: it leaves the terminal's lower right corner,
# so the stones' tops run on from the terminal's bottom, then climbs to the top edge.
LAYOUTS = {'wide': dict(w=864, h=560, gap=7, radius=20, swap=False, hole=(340, 360), lawn=((340, 360), (580, 280), (775, 200), (785, 0)), rings=11),
           'medium': dict(w=704, h=420, gap=6, radius=16, swap=False, rings=6),
           'narrow': dict(w=331, h=560, gap=5, radius=12, swap=True, rings=5)}


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


def subtract(poly, hole):
    """Keep the boundary of a convex cell outside a convex hole."""
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


def arc(hole, lawn, offset=0.0, step=10):
    """The lawn's lower edge: a cubic Bézier through `lawn`, from the terminal's right side to the top edge.
    `offset` moves it along the normal, positive towards the stones."""
    (x0, y0), (x1, y1), (x2, y2), (x3, y3) = lawn
    bezier = lambda t, a, b, c, d: (1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b + 3 * (1 - t) * t * t * c + t ** 3 * d
    fine = [(bezier(t, x0, x1, x2, x3), bezier(t, y0, y1, y2, y3)) for t in (k / 600 for k in range(601))]
    points, walked = [fine[0]], 0.0
    for p, q in zip(fine, fine[1:]):
        walked += math.dist(p, q)
        if walked >= step:
            points.append(q)
            walked = 0.0
    points[-1] = fine[-1]
    out = []
    for i, (x, y) in enumerate(points):
        (px, py), (qx, qy) = points[max(i - 1, 0)], points[min(i + 1, len(points) - 1)]
        length = math.hypot(qx - px, qy - py)
        out.append((x - offset * (qy - py) / length, y + offset * (qx - px) / length))
    return out


def lawn_shapes(w, gap, hole, lawn):
    """The lawn cell, and the region the stones must keep out of: terminal and lawn together, half a gap wider."""
    half = gap / 2
    cell = [(hole[0], -gap), (lawn[-1][0] + gap, -gap)] + arc(hole, lawn, -half)[::-1]
    for normal, bound in (((-1, 0), -hole[0] - half), ((0, -1), -half), ((1, 0), w - half)):
        cell = clip(cell, normal, bound)
    edge = [pt for pt in arc(hole, lawn, half)[::-1] if pt[0] > hole[0] + half]
    keep_out = [(-gap, -gap), (edge[0][0], -gap)] + edge + [(hole[0] + half, hole[1] + half), (-gap, hole[1] + half)]
    region = area([(lawn[0][0], 0)] + arc(hole, lawn)[::-1]) + hole[0] * hole[1]
    return cell, keep_out, region


def layout(items, w, h, gap, swap, keep_out=None, reserved=0, pinned_left=None):
    """Power-diagram cells whose areas follow `area`; with `keep_out`, cells fill only the space outside it."""
    total = sum(item['area'] for item in items)
    targets = [item['area'] / total * (w * h - reserved) for item in items]
    anchors = [((item['y'], item['x']) if swap else (item['x'], item['y'])) for item in items]
    anchors = [(0.04 * w + 0.92 * x * w, 0.04 * h + 0.92 * y * h) for x, y in anchors]

    def outside(pt):
        # Sites inside the terminal or the lawn move just past its nearest inner edge, or their cells vanish.
        if not keep_out or not inside(keep_out, pt):
            return pt
        inner = [(p, r) for p, r in zip(keep_out, keep_out[1:] + keep_out[:1]) if min(p[0], r[0], p[1], r[1]) > -1]
        q = min((nearest(p, r, pt) for p, r in inner), key=lambda c: math.dist(c, pt))
        d = math.dist(q, pt) or 1e-9
        return (q[0] + (q[0] - pt[0]) / d * 12, q[1] + (q[1] - pt[1]) / d * 12)

    anchors = [outside(pt) for pt in anchors]
    sites, weights = list(anchors), [0.0] * len(items)

    def diagram(shift=0):
        polys = cells(sites, weights, w, h, shift)
        return [subtract(poly, keep_out) if keep_out and poly else poly for poly in polys]

    for step in range(500):
        for i, poly in enumerate(diagram()):
            if not poly or area(poly) < 1:
                sites[i], weights[i] = anchors[i], 0.0
                continue
            radius = math.sqrt(max(weights[i], 0)) + 0.5 * (math.sqrt(targets[i] / math.pi) - math.sqrt(area(poly) / math.pi))
            weights[i] = max(radius, 0) ** 2
            cx, cy = centroid(poly)
            pull = 0.28 if pinned_left and anchors[i][0] < pinned_left else (0.08 if step < 350 else 0.0)
            x = 0.6 * cx + 0.4 * sites[i][0] + pull * (anchors[i][0] - cx)
            y = 0.6 * cy + 0.4 * sites[i][1] + pull * (anchors[i][1] - cy)
            sites[i] = outside((x, y))
        # A site must stay outside every neighbour's power circle, or its cell disappears.
        for i, si in enumerate(sites):
            nearest_site = min(math.dist(si, sj) for j, sj in enumerate(sites) if j != i)
            weights[i] = min(weights[i], (0.9 * nearest_site) ** 2)
    return diagram(gap / 2)


def rounded(poly, radius):
    """Round the corners. Vertices that barely turn, like the samples along the lawn's arc, are drawn straight
    through, and each rounding is measured along the outline, so corners on the arc round as fully as elsewhere."""
    poly = [p for p, q in zip(poly, poly[1:] + poly[:1]) if math.dist(p, q) > 1e-6]
    n = len(poly)

    def bend(i):
        p, v, q = poly[i - 1], poly[i], poly[(i + 1) % n]
        u, t = (v[0] - p[0], v[1] - p[1]), (q[0] - v[0], q[1] - v[1])
        return (u[0] * t[0] + u[1] * t[1]) / (math.hypot(*u) * math.hypot(*t) or 1)

    corners = [i for i in range(n) if bend(i) <= math.cos(math.radians(10))]
    fmt = lambda pt: f'{pt[0]:.1f} {pt[1]:.1f}'
    if not corners:
        return 'M' + 'L'.join(map(fmt, poly)) + 'Z'
    walked = [0.0]
    for i in range(n):
        walked.append(walked[-1] + math.dist(poly[i], poly[(i + 1) % n]))
    total = walked[-1]

    def at(d):
        d %= total
        i = next(i for i in range(n) if walked[i + 1] >= d)
        p, q = poly[i], poly[(i + 1) % n]
        t = (d - walked[i]) / (walked[i + 1] - walked[i] or 1)
        return p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])

    m = len(corners)
    span = [((walked[corners[(k + 1) % m]] - walked[corners[k]]) % total) or total for k in range(m)]
    reach = [(min(radius, 0.4 * span[k - 1]), min(radius, 0.4 * span[k])) for k in range(m)]
    parts = []
    for k, i in enumerate(corners):
        start = walked[i]
        parts.append(('M' if not k else 'L') + fmt(at(start - reach[k][0])) + 'Q' + fmt(poly[i]) + ' ' + fmt(at(start + reach[k][1])))
        for j in range(1, n):
            ahead = (walked[(i + j) % n] - start) % total
            if ahead >= span[k] - reach[(k + 1) % m][0]:
                break
            if ahead > reach[k][1]:
                parts.append('L' + fmt(poly[(i + j) % n]))
    return ''.join(parts) + 'Z'


def inside(poly, point):
    x, y, hit = point[0], point[1], False
    for (x0, y0), (x1, y1) in zip(poly, poly[1:] + poly[:1]):
        if (y0 > y) != (y1 > y) and x < x0 + (y - y0) * (x1 - x0) / (y1 - y0):
            hit = not hit
    return hit


def nearest(p, q, point):
    dx, dy = q[0] - p[0], q[1] - p[1]
    t = max(0, min(1, ((point[0] - p[0]) * dx + (point[1] - p[1]) * dy) / (dx * dx + dy * dy or 1)))
    return p[0] + t * dx, p[1] + t * dy


def edge_distance(poly, point):
    return min(math.dist(point, nearest(p, q, point)) for p, q in zip(poly, poly[1:] + poly[:1]))


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


def height(poly, peak, scale, point):
    """0 on the cell edge, 1 at the peak. Near the peak the lines follow the label's ellipse, near the edge the cell's
    outline; a slight ripple keeps them from looking machined."""
    if not inside(poly, point):
        return 0.0
    edge = edge_distance(poly, point)
    x, y = point[0] - peak[0], point[1] - peak[1]
    ripple = 1 + 0.12 * math.sin(x / 47 + 1.3) * math.cos(y / 37 - 0.4) + 0.06 * math.sin((x - 2 * y) / 61)
    return edge / (edge + math.hypot(x / scale[0], y / scale[1]) * ripple + 1e-9)


def isolines(grid, origin, step, level):
    """Marching squares over a sampled height field, chained into closed loops."""
    x0, y0 = origin
    point = lambda i, j: (x0 + i * step, y0 + j * step)
    links = {}
    for j in range(len(grid) - 1):
        for i in range(len(grid[0]) - 1):
            corners = [(i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1)]
            values = [grid[b][a] for a, b in corners]
            hits = []
            for k in range(4):
                a, b = corners[k], corners[(k + 1) % 4]
                ga, gb = values[k], values[(k + 1) % 4]
                if (ga >= level) != (gb >= level):
                    t, pa, pb = (level - ga) / (gb - ga), point(*a), point(*b)
                    hits.append((tuple(sorted((a, b))), (pa[0] + t * (pb[0] - pa[0]), pa[1] + t * (pb[1] - pa[1]))))
            for (ka, pa), (kb, pb) in zip(hits[::2], hits[1::2]):
                links.setdefault(ka, [pa, []])[1].append(kb)
                links.setdefault(kb, [pb, []])[1].append(ka)
    loops, seen = [], set()
    for key in links:
        if key in seen:
            continue
        loop, prev, cur = [], None, key
        while cur not in seen:
            seen.add(cur)
            loop.append(links[cur][0])
            following = [k for k in links[cur][1] if k != prev and k not in seen]
            if not following:
                break
            prev, cur = cur, following[0]
        if len(loop) > 8 and cur in links[key][1] + [key]:
            loops.append(loop)
    return loops


def simplified(points, tolerance):
    """Ramer-Douglas-Peucker: drop points that sit within tolerance of the chord between their neighbours."""
    if len(points) < 3:
        return points
    (ax, ay), (bx, by) = points[0], points[-1]
    length = math.hypot(bx - ax, by - ay) or 1e-9
    offsets = [abs((bx - ax) * (ay - y) - (ax - x) * (by - ay)) / length for x, y in points[1:-1]]
    far = max(range(len(offsets)), key=offsets.__getitem__)
    if offsets[far] <= tolerance:
        return [points[0], points[-1]]
    return simplified(points[:far + 2], tolerance)[:-1] + simplified(points[far + 1:], tolerance)


def smooth(loop, passes=3, tolerance=0.3):
    """Chaikin corner cutting, so the marching-squares steps disappear, then drop the points a curve this smooth
    no longer needs; otherwise the lines alone would blow the page's size budget."""
    for _ in range(passes):
        loop = [pt for p, q in zip(loop, loop[1:] + loop[:1])
                for pt in ((0.75 * p[0] + 0.25 * q[0], 0.75 * p[1] + 0.25 * q[1]), (0.25 * p[0] + 0.75 * q[0], 0.25 * p[1] + 0.75 * q[1]))]
    half = len(loop) // 2
    loop = simplified(loop[:half + 1], tolerance)[:-1] + simplified(loop[half:] + loop[:1], tolerance)[:-1]
    return 'M' + 'L'.join(f'{x:.1f} {y:.1f}' for x, y in loop) + 'Z'


def blurred(grid, radius, passes=3):
    """Repeated box blur, close to a Gaussian; it irons out the creases where the nearest edge switches."""
    for _ in range(passes):
        for _ in range(2):
            grid = [[sum(row[max(0, i - radius):i + radius + 1]) / len(row[max(0, i - radius):i + radius + 1]) for i in range(len(row))]
                    for row in grid]
            grid = [list(column) for column in zip(*grid)]
    return grid


def contours(poly, peak, count, clear, base=0.14, step=2.5):
    """Evenly spaced levels from just inside the edge up to the label box, which stays clear."""
    scale = (clear[0] / clear[1], 1.0)
    xs, ys = [p[0] for p in poly], [p[1] for p in poly]
    # A margin of zeros around the cell keeps every line closed after blurring.
    origin = (min(xs) - 8 * step, min(ys) - 8 * step)
    grid = [[height(poly, peak, scale, (origin[0] + i * step, origin[1] + j * step))
             for i in range(int((max(xs) - origin[0]) / step) + 9)] for j in range(int((max(ys) - origin[1]) / step) + 9)]
    grid = blurred(grid, 2)
    # Sample the label corners on the blurred grid, so the innermost line clears the text.
    at = lambda x, y: grid[round((y - origin[1]) / step)][round((x - origin[0]) / step)]
    top = min(at(peak[0] + dx * clear[0] / 2, peak[1] + dy * clear[1] / 2) for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)))
    levels = [top * (base + (1 - base) * k / (count - 1)) for k in range(count)]
    return ''.join(f'<path class="ring" d="{smooth(loop)}"/>' for level in levels for loop in isolines(grid, origin, step, level))


def svg(items, name, w, h, gap, radius, swap, rings, hole=None, lawn=None):
    out = [f'<svg class="ability-map ability-map-{name}" viewBox="0 0 {w} {h}" width="{w}" height="{h}" '
           f'role="group" aria-label="能力与兴趣圈，面积越大投入越多">']
    if lawn:
        cell, keep_out, region = lawn_shapes(w, gap, hole, lawn)
        stones = [item for item in items if item['tone'] != 'contour']
        placed = iter(layout(stones, w, h, gap, swap, keep_out, region, hole[0] + 40))
        polys = [cell if item['tone'] == 'contour' else next(placed) for item in items]
    else:
        polys = layout(items, w, h, gap, swap)
    for index, (item, poly) in enumerate(zip(items, polys)):
        if not poly or area(poly) < 1:
            raise ValueError(f"Empty ability cell: {name} / {item['name']}")
        centre = anchor(poly)
        shapes = [f'<path class="shape" d="{rounded(poly, radius)}"/>']
        if item['tone'] == 'contour':
            # The lawn's peak sits under its label, so the title reads as the summit.
            # Smaller lawns show only the name, so the summit stays open around it.
            text = label(item if hole else {**item, 'sub': None}, poly, centre, 17 / 13 if hole else 1)
            size = 17 if hole else 13
            clear = (max(text_width(item['name'], size), text_width(item.get('sub', ''), 11)) + 24, size + 34) if hole else \
                    (text_width(item['name'], size) + 28, size + 22)
            # The wide lawn's outer line runs close to the top edge, so the lawn reaches up beside the terminal.
            shapes.append(contours(poly, centre, rings, clear, 0.05 if hole else 0.14))
        else:
            text = label(item, poly, centre, 1 if name == 'wide' else 0.95)
        out.append(f'<g class="cell tone-{item["tone"]}" tabindex="0" role="button" aria-pressed="{str(not index).lower()}" '
                   f'aria-label="{E(item["name"])}" data-name="{E(item["name"])}" data-detail="{E(item["detail"])}">'
                   f'{"".join(shapes)}{text}</g>')
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
    if hole_css not in (SITE_ROOT / 'style.css').read_text():
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

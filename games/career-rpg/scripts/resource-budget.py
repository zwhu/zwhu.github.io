#!/usr/bin/env python3
"""Read-only resource accounting for the current Nanjing development page.

Writes evidence only. Never rewrites production files or encodes images.
This is static accounting, not a network, startup-time or frame-time test.
"""
import gzip
import hashlib
import json
import platform
import re
import struct
import subprocess
import zlib
from collections import deque
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urljoin, urlsplit, urlunsplit

ROOT = Path(__file__).resolve().parents[3]
WEB = ROOT / 'games/career-rpg/web'
OUT = WEB / 'review/resource-budget'
ORIGIN = 'http://resource-budget.invalid'
ENTRY = ORIGIN + '/games/career-rpg/web/'


class Page(HTMLParser):
    def __init__(self, text, strict_srcset=True):
        super().__init__()
        self.resources, self.navigation = [], []
        self.strict_srcset = strict_srcset
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'a' and 'href' in attrs:
            self.navigation.append(attrs['href'])
        if tag == 'script' and attrs.get('src'):
            self.resources.append((attrs['src'], 'html-script'))
        if tag == 'link' and attrs.get('rel') in ('stylesheet', 'preload', 'modulepreload', 'icon'):
            self.resources.append((attrs['href'], 'html-' + attrs['rel']))
        if tag in ('img', 'source', 'audio', 'video'):
            for key in ('src', 'poster'):
                if attrs.get(key):
                    self.resources.append((attrs[key], tag + '-' + key))
            if attrs.get('srcset'):
                if self.strict_srcset:
                    raise ValueError('Responsive candidates require explicit viewport accounting')
                self.resources.extend((part.strip().split()[0], tag + '-srcset-candidate') for part in attrs['srcset'].split(',') if part.strip())
        if tag == 'base':
            raise ValueError('A base element requires document-base re-evaluation')


def tokens(text):
    """Skip comments and preserve literal imports without scanning vendor line dumps."""
    pattern = re.compile(r'''//[^\n]*|/\*[\s\S]*?\*/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|[A-Za-z_$][\w$]*|[^\s]''')
    result = []
    for m in pattern.finditer(text):
        v = m.group()
        if v.startswith(('//', '/*')):
            continue
        kind = 'string' if v[0] in '\"\'' else 'template' if v[0] == '`' else 'token'
        result.append((v[1:-1] if kind == 'string' else v, m.start(), kind))
    return result


def imports(text):
    ts, result = tokens(text), []
    for i, (v, offset, kind) in enumerate(ts):
        if kind != 'token' or v not in ('import', 'export'):
            continue
        tail = ts[i + 1:]
        if not tail:
            continue
        if v == 'import' and tail[0][0] == '.':
            continue
        if v == 'import' and tail[0][0] == '(':
            if len(tail) < 3 or tail[1][2] != 'string' or tail[2][0] != ')':
                raise ValueError(f'Nonliteral dynamic import at offset {offset}')
            result.append((tail[1][0], offset, 'dynamic-import'))
            continue
        if v == 'import' and tail[0][2] == 'string':
            result.append((tail[0][0], offset, 'static-import'))
            continue
        if v == 'export' and tail[0][0] not in ('*', '{'):
            continue
        for n, t in enumerate(tail):
            if t[0] == ';':
                break
            if t[0] == 'from' and t[2] == 'token' and n + 1 < len(tail) and tail[n + 1][2] == 'string':
                result.append((tail[n + 1][0], offset, 'static-import' if v == 'import' else 're-export'))
                break
    return result


def canonical(base, reference):
    parsed = urlsplit(urljoin(base, reference))
    if parsed.scheme not in ('http', 'https') or parsed.netloc != urlsplit(ORIGIN).netloc:
        raise ValueError(f'External or inline URL requires separate accounting: {reference}')
    return urlunsplit((parsed.scheme, parsed.netloc, parsed.path, parsed.query, ''))


def local(url):
    p = urlsplit(url).path
    file = ROOT / unquote(p).lstrip('/')
    if p.endswith('/'):
        file = file / 'index.html'
    file = file.resolve()
    if not file.is_relative_to(ROOT):
        raise ValueError('Resource outside repository')
    return file


def measure(file):
    data = file.read_bytes()
    encoded = gzip.compress(data, compresslevel=9, mtime=0)
    row = {'file':str(file.relative_to(ROOT)), 'raw_bytes':len(data),
           'gzip_bytes':len(encoded), 'gzip_sha256':hashlib.sha256(encoded).hexdigest(),
           'sha256':hashlib.sha256(data).hexdigest()}
    if data.startswith(b'\x89PNG\r\n\x1a\n'):
        width, height, depth, color = struct.unpack('>IIBB', data[16:26])
        row['png'] = {'width':width, 'height':height, 'bit_depth':depth, 'color_type':color}
        chunks, offset = [], 8
        while offset + 12 <= len(data):
            length = struct.unpack('>I', data[offset:offset+4])[0]
            kind = data[offset+4:offset+8].decode('ascii')
            assert offset + 12 + length <= len(data)
            chunks.append({'type':kind, 'payload_bytes':length, 'total_bytes':length+12})
            offset += length+12
            if kind == 'IEND':
                break
        row['png_chunks'] = chunks
        row['ancillary_chunk_bytes'] = sum(c['total_bytes'] for c in chunks if c['type'][0].islower())
        row['trailing_bytes'] = len(data)-offset
    return row


def total(rows):
    return {kind:sum(x[kind] for x in rows) for kind in ('raw_bytes', 'gzip_bytes')}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    original_png_hashes = {f.relative_to(ROOT):hashlib.sha256(f.read_bytes()).hexdigest()
        for f in [*WEB.joinpath('art').glob('*.png'), *ROOT.joinpath('games/career-rpg/art').rglob('*.png')]}
    records, edges, queue = {}, [], deque()
    def add(base, reference, cause, offset=None, resolved_via=None):
        url = canonical(base, reference)
        edge = {'from':urlsplit(base).path, 'reference':reference,
                'to':urlsplit(url).path, 'kind':cause}
        if offset is not None:
            text = local(base).read_text()
            edge.update(offset=offset, line=text.count('\n', 0, offset) + 1)
        if resolved_via:
            edge['resolved_via'] = resolved_via
        edges.append(edge)
        if url not in records:
            file = local(url)
            records[url] = {**measure(file), 'url':urlsplit(url).path + ('?' + urlsplit(url).query if urlsplit(url).query else ''),
                            'first_interactive':True, 'chapter_runtime':True, 'references':[]}
            queue.append(url)
        records[url]['references'].append(edge)
    add(ENTRY, './', 'document')
    while queue:
        url = queue.popleft()
        file = local(url)
        if file.suffix not in ('.html', '.css', '.mjs', '.js'):
            continue
        text = file.read_text()
        if file.suffix == '.html':
            page = Page(text)
            for ref, cause in page.resources:
                add(url, ref, cause)
        elif file.suffix in ('.mjs', '.js'):
            for ref, offset, cause in imports(text):
                add(url, ref, cause, offset)
        else:
            text = re.sub(r'/\*[\s\S]*?\*/', '', text)
            for m in re.finditer(r'url\(\s*[\"\']?([^\s)\"\']+)', text):
                add(url, m.group(1), 'css-url', m.start())
            for m in re.finditer(r'@import\s+[\"\']([^\"\']+)', text):
                add(url, m.group(1), 'css-import', m.start())
    # OFFICE is a reviewed pure module: enumerate actual values, never infer assets from filenames.
    config = subprocess.run(['node', '--input-type=module', '-e',
        "import {OFFICE} from './games/career-rpg/web/scene-config.mjs'; console.log(JSON.stringify({background:OFFICE.background,atlases:OFFICE.atlases}));"],
        cwd=ROOT, check=True, capture_output=True, text=True)
    office = json.loads(config.stdout)
    source = (WEB / 'main.mjs').read_text()
    required = ["await import('./vendor/three.module.min.js')", 'Object.entries(OFFICE.atlases)',
        'await Promise.all([loadImage(OFFICE.background)', "fetch('../design/chapter-01.json')", 'loadImage(atlas.url)']
    if not all(s in source for s in required):
        raise ValueError('Loading phase changed: resolve dynamic paths before measuring')
    # The only project network/image sink is loadImage(url) bound to these startup values.
    project = ['main.mjs', 'world.mjs', 'story.mjs', 'actors.mjs', 'scene-config.mjs']
    sinks = []
    for name in project:
        text = (WEB / name).read_text()
        for m in re.finditer(r'\bfetch\s*\(|\bnew\s+(?:Image|Worker|Audio)\b|\.src\s*=|\bnew\s+URL\s*\(', text):
            sinks.append({'file':str((WEB / name).relative_to(ROOT)), 'line':text.count('\n', 0, m.start()) + 1,
                'snippet':text[m.start():m.start() + 140].split('\n')[0]})
        if name != 'main.mjs' and re.search(r'\bfetch\s*\(|\bnew\s+(?:Image|Worker|Audio)\b|\.src\s*=', text):
            raise ValueError(f'New project network sink needs audit: {name}')
    if len(re.findall(r'\bfetch\s*\(', source)) != 1 or len(re.findall(r'\.src\s*=', source)) != 1:
        raise ValueError('New main resource sink needs explicit path resolution')
    add(ENTRY, office['background'], 'startup-image', source.index('loadImage(OFFICE.background)'), 'OFFICE.background in scene-config.mjs; image.src resolves against document base')
    add(ENTRY, '../design/chapter-01.json', 'startup-json', resolved_via='main.mjs fetch in awaited Promise.all')
    for name, atlas in office['atlases'].items():
        add(ENTRY, atlas['url'], 'startup-atlas', resolved_via=f'OFFICE.atlases.{name}.url in scene-config.mjs; all entries awaited in main.mjs')
    rows = list(records.values())
    # Correct the source provenance of document-relative dynamic sinks without changing resolution.
    for edge in edges:
        if edge['kind'].startswith('startup-'):
            edge['source_code'] = 'games/career-rpg/web/main.mjs'
            if 'offset' in edge:
                edge['line'] = source.count('\n', 0, edge['offset']) + 1
    license_row = measure(WEB / 'vendor/LICENSE')
    license_row.update(network_requested=False, category='required-distribution-license')
    excluded = [{'file':str(f.relative_to(ROOT)), 'reason':'No reference from current runtime closure'}
        for directory in [WEB / 'art', ROOT / 'games/career-rpg/art']
        for f in sorted(directory.rglob('*')) if f.is_file() and f.resolve() not in {local(u) for u in records}]
    counts, sums = {}, {}
    for row in rows:
        kind = Path(row['file']).suffix
        counts[kind] = counts.get(kind, 0) + 1
        sums.setdefault(kind, {'raw_bytes':0, 'gzip_bytes':0})
        for field in sums[kind]:
            sums[kind][field] += row[field]
    runtime = total(rows)
    package = total(rows + [license_row])
    html = next(x for x in rows if x['file'].endswith('/web/index.html'))
    budget = []
    for id, measured, limit in [('FIRST-GZIP', runtime['gzip_bytes'], 512*1024),
                               ('CHAPTER-RAW', runtime['raw_bytes'], 2*1024*1024),
                               ('CHAPTER-WITH-LICENSE-RAW', package['raw_bytes'], 2*1024*1024),
                               ('HTML-RAW', html['raw_bytes'], 96*1024),
                               ('HTML-GZIP', html['gzip_bytes'], 32*1024)]:
        budget.append({'id':id, 'actual_bytes':measured, 'limit_bytes':limit,
            'delta_bytes':measured-limit, 'over_by_bytes':max(0, measured-limit),
            'status':'passed' if measured <= limit else 'failed'})
    blog = []
    for name in ['docs/index.html', 'docs/claude-code-review.html']:
        file = ROOT / name
        if file.exists():
            page = Page(file.read_text(), strict_srcset=False)
            blog.append({'file':name, 'sha256':hashlib.sha256(file.read_bytes()).hexdigest(),
                'direct_resource_references':page.resources,
                'game_resource_references':[ref for ref, cause in page.resources if 'career-rpg' in ref],
                'scope':'Direct static references only; not recursive cold-cache request acceptance'})
    manifest = {'entry':urlsplit(ENTRY).path, 'resources':rows, 'edges':edges,
        'runtime_count':len(rows), 'runtime_totals':runtime, 'first_interactive_totals':runtime,
        'counts_by_extension':counts, 'totals_by_extension':sums,
        'required_non_network_distribution_files':[license_row], 'distribution_totals':package,
        'excluded_unreferenced_art':excluded, 'project_resource_sinks':sinks,
        'dynamic_resolution':office, 'unresolved_dynamic_paths':[],
        'rules':{'dedup':'Normalized request URL, fragment removed, query retained; same body at different URLs is counted twice. Repeated imports/reexports of the same URL count once per document/module registry. Reload/retry is a new navigation and not added to a single-page bundle.',
            'gzip':'Per-file gzip.compress(compresslevel=9, mtime=0), gzip header/trailer included, summed independently; no concatenation or Brotli; no production files compressed or rewritten.',
            'readiness':'All reachable module dependencies and stylesheet plus background, JSON and every OFFICE atlas count before first interactive; main awaits Three then a single Promise.all. Chapter has no later asset loader, so first and entire runtime resource sets are identical.',
            'scope':'HTML-reachable current Nanjing runtime, not source-tree size. Unrequested LICENSE separately counted for minimum distribution; navigation to blog leaves the game and is excluded. Portrait/atlas/GPU textures are generated from already-loaded images with no new URL.',
            'vendor':'The whole local Three module/core byte payload is included; general unused Three loaders do not request assets in the reviewed renderer/Texture/material/geometry call path.',
            'network':'Static payload bytes, not measured transfers. No headers/TLS/cache/CDN or browser implicit favicon/devtools source-map request accounting; no explicit icon or source-map exists. No cold network run performed.'},
        'blog_static_samples':blog,
        'measurement_environment':{'python':platform.python_version(),'zlib':zlib.ZLIB_RUNTIME_VERSION},
        'measurement_script_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest()}
    # Prove that measured production resources were untouched, including unreferenced original PNGs.
    guard = {Path(x['file']):x['sha256'] for x in rows + [license_row]}
    guard.update(original_png_hashes)
    for rel, expected in guard.items():
        assert hashlib.sha256((ROOT / rel).read_bytes()).hexdigest() == expected
    summary = {'status':'ready_for_review', 'scene':'nanjing-office', 'stage':'resource-budget',
        'budget_result':'failed' if any(x['status']=='failed' for x in budget) else 'passed_static_only',
        'scene_accepted':False, 'next_scene_authorized':False, 'method':'Static read-only closure accounting; no network or runtime performance measurement',
        'command':'python3 games/career-rpg/scripts/resource-budget.py', 'manifest':'manifest.json',
        'production_hashes':{Path(x['file']).name:x['sha256'] for x in rows if Path(x['file']).name in ('main.mjs','index.html','style.css')},
        'runtime_count':len(rows), 'first_interactive':runtime, 'chapter_runtime':runtime, 'minimum_distribution':package,
        'budgets':budget, 'totals_by_extension':sums,
        'largest_gzip_resources':[{k:r[k] for k in ('file','raw_bytes','gzip_bytes')} for r in sorted(rows, key=lambda x:x['gzip_bytes'], reverse=True)[:7]],
        'unresolved_dynamic_paths':[], 'production_unchanged':{'status':'passed','hashes_checked':len(guard)},
        'blog_isolation':{'status':'unverified', 'static_samples':[{k:r[k] for k in ('file','sha256','game_resource_references')} for r in blog], 'references_evidence':'manifest.json blog_static_samples', 'gap':'No cold-cache network acceptance or full shared-script recursive audit'},
        'contribution_evidence':{
            'images_raw_bytes':sums['.png']['raw_bytes'], 'images_gzip_bytes':sums['.png']['gzip_bytes'],
            'images_gzip_share':sums['.png']['gzip_bytes']/runtime['gzip_bytes'],
            'png_ancillary_raw_bytes':sum(x.get('ancillary_chunk_bytes',0) for x in rows),
            'three_raw_bytes':sums['.js']['raw_bytes'], 'three_gzip_bytes':sums['.js']['gzip_bytes'],
            'first_reduction_fraction_required':max(0,1-(512*1024)/runtime['gzip_bytes']),
            'runtime_without_any_three':{k:runtime[k]-sums['.js'][k] for k in runtime}},
        'optimization_order':[
            {'order':1,'proposal':'Investigate lossless repacking of approved PNG pixel/alpha data and optional metadata first. Record actual savings before adoption; retain original files.',
             'basis':f"Images cost {sums['.png']['gzip_bytes']} gzip bytes. All ancillary chunks combined are {sum(x.get('ancillary_chunk_bytes',0) for x in rows)} raw bytes; color metadata is not automatically removable. Compare measured candidate savings with both recorded deficits before adoption.",
             'constraint':'No work performed; exact appearance/color/alpha and strict production-grid/atlas gate must survive. No resizing/recoloring/quality reduction; no confirmed lossless route to the full budget yet.'},
            {'order':2,'proposal':'Evaluate a fixed local Three build limited to actually-used WebGL classes, retaining r180 and MIT; measure output and validate the existing game before adoption.',
             'basis':f"Vendor files cost {sums['.js']['gzip_bytes']} gzip bytes. Remaining runtime without any vendor would still cost {runtime['gzip_bytes']-sums['.js']['gzip_bytes']} gzip bytes and {runtime['raw_bytes']-sums['.js']['raw_bytes']} raw bytes; compare to existing limits.",
             'constraint':'No dependency download, replacement or second implementation this task. This proposal alone cannot solve either deficit.'},
            {'order':3,'proposal':'Only if needed, review real loading phases after production-grid/atlas decisions. Every current image and JSON is awaited; a required image cannot simply be excluded from the current first-load total.',
             'basis':'Phase splitting could only change first-load cost after behavior changes are separately accepted; total chapter raw bytes do not fall. HTTP gzip/cache/preload cannot fix an already-gzipped static bundle limit.',
             'constraint':'Any proposal needs independent usability, fallback and art checks and separate authorization; no budget changes or automatic implementation.'}],
        'limitations':['gzip is an independent static encoding size, not observed network compression or timing','Ordinary-blog isolation is static sample evidence only','Strict production grid/atlas, real devices/people/author, other scene gates remain unverified','Walking stutter is unresolved and explicitly paused; no startup/frame/runtime performance measured'],
        'not_rerun':['Supervisor-passed FALLBACK and root verify; production files unchanged','No cold-cache network list needed: all actual startup dynamic resource values resolved statically','No full chapter, startup/frame/interaction performance or scene expansion'],
        'next':'Stop after reporting actual budget gaps; supervisor independent review. No budget changes or automatic optimization.'}
    (OUT / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n')
    (OUT / 'summary.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps({'runtime_count':len(rows), 'first_and_chapter':runtime,
        'minimum_distribution':package, 'budget_result':summary['budget_result'],
        'failed':[x for x in budget if x['status']=='failed'], 'next':summary['next']}))


if __name__ == '__main__':
    main()

"""The map for the slime mould experiment (src/slime/): where the mould may
grow, which cities it feeds on, and the real railway it is compared with.

It reads the toy-netherlands project's data rather than fetching anything:
the PDOK national border and the AHN/OSM water masks it derived, its OSM
place list (with populations) and its OSM railway ways. Run it with that
project's Python, which has numpy, scipy and pyproj:

    ~/Source/toy-netherlands/.venv/bin/python -I scripts/slime-map.py ~/Source/toy-netherlands

and it writes src/slime/nl.json (for the model, in a worker) and
src/slime/places.js (the frame and the cities, for the page). Everything is in RD New (EPSG:28992)
metres, the Dutch national grid, so distances are plain Euclidean.

- The arena is the country's land. Water narrower than about 2 km (rivers,
  canals) stays crossable, as a bridge would; the sea, the Wadden, the
  IJsselmeer, the Markermeer and the Zeeland estuaries do not. Islands are
  left out, as they have no railway to compare with.
- The cities are the twelve provincial capitals and Amsterdam, then the
  largest places with a station, skipping any within 13 km of a larger one
  already chosen, to 40 in all. Tero et al. used 36 around Tokyo.
- The railway is every passenger line in OSM (main and branch, not
  freight-only), drawn onto a 150 m grid so double and quadruple tracks merge
  into one line, then thinned to its centre line and traced into a graph of
  junctions and the lines between them.
"""
import base64, csv, json, math, sys
from pathlib import Path

import numpy as np
from scipy import ndimage
from pyproj import Transformer

TOY = Path(sys.argv[1] if len(sys.argv) > 1 else '~/Source/toy-netherlands').expanduser()
OUT = Path(__file__).resolve().parent.parent / 'src/slime/nl.json'
PLACES = OUT.with_name('places.js')  # just the frame and the cities, for the page (and the build, in Node)
DER, RAW = TOY / 'data/derived', TOY / 'data/raw'

# toy-netherlands' grid: 8192 cells of 38 m over this square, rows north to south.
BBOX = (-11250.0, 306250.0, 301250.0, 618750.0)
N = 8192
TO_RD = Transformer.from_crs('EPSG:4326', 'EPSG:28992', always_xy=True)

CITIES = 40
APART = 13000  # m: a smaller place this close to a chosen one is the same stop
NEAR_RAIL = 2500  # m: a place further than this from a line has no station
CAPITALS = ['Amsterdam', 'Den Haag', 'Groningen', 'Leeuwarden', 'Assen', 'Zwolle', 'Lelystad', 'Arnhem',
            'Utrecht', 'Haarlem', 'Middelburg', "'s-Hertogenbosch", 'Maastricht']


def block_mean(a, f):
    n = a.shape[0] // f
    return a.reshape(n, f, n, f).mean(axis=(1, 3))


def disk(r):
    y, x = np.ogrid[-r:r + 1, -r:r + 1]
    return x * x + y * y <= r * r


def zhang_suen(img):
    """Thin a binary image to 1-pixel lines (Zhang & Suen, 1984)."""
    img = img.astype(np.uint8).copy()
    while True:
        changed = 0
        for step in (0, 1):
            P = np.pad(img, 1)
            p2, p3, p4, p5 = P[:-2, 1:-1], P[:-2, 2:], P[1:-1, 2:], P[2:, 2:]
            p6, p7, p8, p9 = P[2:, 1:-1], P[2:, :-2], P[1:-1, :-2], P[:-2, :-2]
            B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9
            ring = [p2, p3, p4, p5, p6, p7, p8, p9, p2]
            A = sum(((ring[i] == 0) & (ring[i + 1] == 1)).astype(np.uint8) for i in range(8))
            if step == 0:
                c = (p2 * p4 * p6 == 0) & (p4 * p6 * p8 == 0)
            else:
                c = (p2 * p4 * p8 == 0) & (p2 * p6 * p8 == 0)
            m = (img == 1) & (B >= 2) & (B <= 6) & (A == 1) & c
            n = int(m.sum())
            if n:
                img[m] = 0
                changed += n
        if not changed:
            return img.astype(bool)


def simplify(pts, tol):
    """Douglas-Peucker on a list of (x, y)."""
    if len(pts) < 3:
        return pts
    a, b = np.array(pts[0]), np.array(pts[-1])
    ab = b - a
    L = math.hypot(*ab)
    P = np.array(pts)
    if L == 0:
        d = np.hypot(*(P - a).T)
    else:
        d = np.abs(ab[0] * (P[:, 1] - a[1]) - ab[1] * (P[:, 0] - a[0])) / L
    i = int(np.argmax(d))
    if d[i] <= tol:
        return [pts[0], pts[-1]]
    return simplify(pts[:i + 1], tol)[:-1] + simplify(pts[i:], tol)


def rle(classes):
    """Row-major runs as bytes, (class, length <= 255) pairs, base64."""
    out = bytearray()
    for row in classes:
        v, n = int(row[0]), 0
        for c in row:
            c = int(c)
            if c == v and n < 255:
                n += 1
                continue
            out += bytes((v, n))
            v, n = c, 1
        out += bytes((v, n))
    return base64.b64encode(bytes(out)).decode()


# ------------------------------------------------------------------ the arena
t = np.load(DER / 'terrain.npz')
land, lake, sea = t['land'], t['lake'], t['sea']
wet = lake | sea | np.load(DER / 'water.npz')['mask']
F = 4  # 152.6 m cells for the masks
C = (BBOX[2] - BBOX[0]) / (N // F)
inside = block_mean(land.astype(np.float32), F) > 0.5
wetf = block_mean((wet & (land | sea)).astype(np.float32), F)
big = ndimage.binary_opening(wetf > 0.5, structure=disk(int(round(1000 / C))))
arena = inside & ~big
lab, n = ndimage.label(arena)
arena = lab == 1 + int(np.argmax(ndimage.sum(arena, lab, range(1, n + 1))))
print(f'arena {arena.sum() * C * C / 1e6:,.0f} km2 of land, {n - 1} islands left out')

# Classes for drawing at 610 m: 0 outside, 1 arena land, 2 water the mould may
# cross, 3 water it may not, 4 land it can't reach (the islands).
D = 4  # 610 m
G2 = arena.shape[0] // D
fa = block_mean(arena.astype(np.float32), D)
fb = block_mean((big & inside).astype(np.float32), D)
fw = block_mean(((wetf > 0.5) & inside).astype(np.float32), D)
fi = block_mean((inside & ~arena & ~big).astype(np.float32), D)
cls = np.zeros((G2, G2), np.uint8)
cls[fi > 0.5] = 4
cls[fb > 0.5] = 3
cls[fa > 0.5] = 1
cls[(fa > 0.5) & (fw > 0.3)] = 2

# ------------------------------------------------------------------ the railway
G = N // F
grid = np.zeros((G, G), bool)
els = json.load(open(RAW / 'rail.json'))['elements']
ways = 0
for e in els:
    tg = e.get('tags', {})
    if tg.get('railway') != 'rail' or tg.get('usage') not in ('main', 'branch'):
        continue
    if tg.get('railway:traffic_mode') == 'freight':
        continue
    ways += 1
    g = e['geometry']
    x, y = TO_RD.transform(np.array([p['lon'] for p in g]), np.array([p['lat'] for p in g]))
    for i in range(len(x) - 1):
        n = max(2, int(math.hypot(x[i + 1] - x[i], y[i + 1] - y[i]) / 40) + 2)
        s = np.linspace(0, 1, n)
        px = ((x[i] + (x[i + 1] - x[i]) * s - BBOX[0]) / C).astype(int)
        py = ((BBOX[3] - (y[i] + (y[i + 1] - y[i]) * s)) / C).astype(int)
        ok = (px >= 0) & (px < G) & (py >= 0) & (py < G)
        grid[py[ok], px[ok]] = True
grid &= ndimage.binary_dilation(inside, iterations=2)  # stop at the border
fat = ndimage.binary_closing(ndimage.binary_dilation(grid, iterations=1), iterations=2)
sk = zhang_suen(fat)

# Trace the centre lines into a graph. Diagonal steps count only where no
# orthogonal pixel joins the two, so a staircase isn't a run of junctions.
ys, xs = np.nonzero(sk)
idx = -np.ones(sk.shape, np.int64)
idx[ys, xs] = np.arange(len(xs))
nb = [[] for _ in range(len(xs))]
for k in range(len(xs)):
    y, x = ys[k], xs[k]
    for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
        if 0 <= y + dy < G and 0 <= x + dx < G and sk[y + dy, x + dx]:
            nb[k].append(idx[y + dy, x + dx])
    for dy, dx in ((-1, -1), (-1, 1), (1, -1), (1, 1)):
        if 0 <= y + dy < G and 0 <= x + dx < G and sk[y + dy, x + dx] and not (sk[y + dy, x] or sk[y, x + dx]):
            nb[k].append(idx[y + dy, x + dx])
deg = np.array([len(q) for q in nb])
isnode = deg != 2
jmask = np.zeros(sk.shape, bool)
jmask[ys[isnode], xs[isnode]] = True
jl, nn = ndimage.label(jmask, structure=np.ones((3, 3)))  # touching junction pixels are one junction
node_of = jl[ys, xs] - 1
lines, seen = [], set()
for k in np.nonzero(isnode)[0]:
    for m in nb[k]:
        if (k, m) in seen:
            continue
        path, prev, cur = [k], k, m
        while node_of[cur] < 0:
            path.append(cur)
            nxt = [q for q in nb[cur] if q != prev]
            if not nxt:
                break
            prev, cur = cur, nxt[0]
        path.append(cur)
        seen.add((k, m))
        seen.add((path[-1], path[-2]))
        if node_of[cur] >= 0 and (node_of[cur] != node_of[k] or len(path) > 8):
            lines.append((int(node_of[k]), int(node_of[cur]), path))
rx = lambda px: BBOX[0] + (px + 0.5) * C
ry = lambda py: BBOX[3] - (py + 0.5) * C
plen = lambda p: sum(math.hypot(xs[p[i + 1]] - xs[p[i]], ys[p[i + 1]] - ys[p[i]]) for i in range(len(p) - 1)) * C
lines = [(a, b, p, plen(p)) for a, b, p in lines]
while True:  # stubs under 1.5 km are yards and thinning crumbs
    d = np.bincount([e[0] for e in lines] + [e[1] for e in lines], minlength=nn)
    kept = [e for e in lines if not ((d[e[0]] == 1 or d[e[1]] == 1) and e[3] < 1500)]
    if len(kept) == len(lines):
        break
    lines = kept
used = sorted({e[0] for e in lines} | {e[1] for e in lines})
renum = {v: i for i, v in enumerate(used)}
cx = ndimage.mean(xs[isnode], node_of[isnode], np.arange(nn))
cy = ndimage.mean(ys[isnode], node_of[isnode], np.arange(nn))
rail_nodes = [[round(rx(cx[v]), -1), round(ry(cy[v]), -1)] for v in used]
rail_lines = []
for a, b, p, L in lines:
    pts = simplify([(rx(xs[q]), ry(ys[q])) for q in p], 100)
    pts[0], pts[-1] = tuple(rail_nodes[renum[a]]), tuple(rail_nodes[renum[b]])
    rail_lines.append([renum[a], renum[b], [round(v, -1) for xy in pts for v in xy]])
print(f'railway: {ways} OSM ways -> {len(rail_nodes)} junctions, {len(rail_lines)} lines, '
      f'{sum(e[3] for e in lines) / 1000:,.0f} km')

# ------------------------------------------------------------------ the cities
dist = ndimage.distance_transform_edt(~sk) * C
places = []
for r in csv.DictReader(open(RAW / 'cities.csv')):
    x, y = TO_RD.transform(float(r['@lon']), float(r['@lat']))
    px, py = int((x - BBOX[0]) / C), int((BBOX[3] - y) / C)
    if not (0 <= px < G and 0 <= py < G and arena[py, px]):
        continue
    places.append({'name': r['name'], 'x': x, 'y': y, 'pop': int(r['population'] or 0), 'rail': dist[py, px]})
places.sort(key=lambda r: -r['pop'])
by = {r['name']: r for r in places}
chosen = [by[c] for c in CAPITALS]
for r in places:
    if len(chosen) >= CITIES:
        break
    if r in chosen or r['rail'] > NEAR_RAIL:
        continue
    if all(math.hypot(r['x'] - c['x'], r['y'] - c['y']) >= APART for c in chosen):
        chosen.append(r)
print('cities:', ', '.join(r['name'] for r in chosen))

# The map's frame on the page: the arena with 3 km to spare, in km from the
# grid's top-left corner (y south), the same frame src/slime/map.js reads in.
cy_, cx_ = np.nonzero((cls == 1) | (cls == 2))
ck = C * D / 1000
x0, y0 = cx_.min() * ck - 3, cy_.min() * ck - 3
box = [round(x0, 1), round(y0, 1), round((cx_.max() + 1) * ck + 3 - x0, 1), round((cy_.max() + 1) * ck + 3 - y0, 1)]
km = lambda r: [round((r['x'] - BBOX[0]) / 1000, 2), round((BBOX[3] - r['y']) / 1000, 2)]
PLACES.write_text('// Made by scripts/slime-map.py: the map\'s frame [x0, y0, w, h] and the 40 cities\n'
                  '// [name, x, y, population], in km from the grid\'s top-left corner, y south.\n'
                  f"export default {json.dumps({'box': box, 'cities': [[r['name'], *km(r), r['pop']] for r in chosen]}, separators=(',', ':'))};\n")

OUT.write_text(json.dumps({
    'about': 'Made by scripts/slime-map.py. RD New (EPSG:28992) metres. Land and water: PDOK Bestuurlijke '
             'Gebieden (CC BY 4.0 Kadaster), AHN (CC0); places and railways: OpenStreetMap contributors (ODbL).',
    'box': box,
    'grid': {'x0': BBOX[0], 'y0': BBOX[3], 'cell': C * D, 'cols': G2, 'rows': G2,
             'classes': ['outside', 'land', 'crossable water', 'open water', 'island']},
    'map': rle(cls),
    'cities': [[r['name'], round(r['x']), round(r['y']), r['pop']] for r in chosen],
    'rail': {'nodes': rail_nodes, 'lines': rail_lines},
}, separators=(',', ':')))
print(f'wrote {OUT} ({OUT.stat().st_size / 1024:.0f} KB)')

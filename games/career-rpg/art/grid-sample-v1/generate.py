#!/usr/bin/env python3
"""Generate player.png, floor.png, preview.png, verification.json from source.json.

Standard library only. No interpolation, gradients or randomness.
PNG rows use filter 0; output is byte-reproducible.
Run: python3 games/career-rpg/art/grid-sample-v1/generate.py
"""
import hashlib
import json
import struct
import zlib
from pathlib import Path

HERE = Path(__file__).resolve().parent
ORDER = ("down", "up", "left", "right")
SCALE = 8
PREVIEW_COLS, PREVIEW_ROWS = 8, 4
FW, FH = 16, 24          # frame size
TW, TH = 16, 16          # tile size
AX, AY = 8, 23           # foot anchor: sprite [8,23] -> tile cell [8,15]
OPAQUE = {"W", "K", "S", "C", "D", "L", "B", "G", "U", "N", "E", "Y"}


def load():
    with open(HERE / "source.json", encoding="utf-8") as f:
        src = json.load(f)
    raw = src["palette"]
    assert set(raw) == OPAQUE | {"."}, f"palette keys {sorted(raw)}"
    assert raw["."] == [0, 0, 0, 0], "transparent entry"
    for s in OPAQUE:
        c = raw[s]
        assert len(c) == 4 and all(isinstance(v, int) and 0 <= v <= 255 for v in c), s
        assert c[3] == 255, f"{s} alpha must be 255"
    assert len({tuple(raw[s][:3]) for s in OPAQUE}) == 12, "12 distinct RGB"
    expected = {"faf8f3", "292825", "77746e", "a64335", "6b4a32", "a87c55", "8d8a83", "6f8f5a", "5d6e7a", "2f3a45", "e8dfc8", "e9c27a"}
    assert {"".join(f"{v:02x}" for v in raw[k][:3]) for k in OPAQUE} == expected, "palette differs from specification"
    pal = {k: tuple(v) for k, v in raw.items()}
    return src, pal


def matrix(rows, pal):
    return [[pal[s] for s in row] for row in rows]


def png_bytes(pixels):
    h, w = len(pixels), len(pixels[0])
    raw = b"".join(b"\x00" + b"".join(bytes(p) for p in row) for row in pixels)

    def chunk(tag, data):
        return (struct.pack(">I", len(data)) + tag + data
                + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF))

    ihdr = struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr)
            + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))


def write_png(path, pixels, expect):
    data = png_bytes(pixels)
    assert data == expect, f"{path.name} not reproducible"
    path.write_bytes(data)
    return len(pixels[0]), len(pixels)


def blank(w, h, color):
    return [[color] * w for _ in range(h)]


def blit(dst, src, x, y):
    for dy, row in enumerate(src):
        for dx, px in enumerate(row):
            if px[3]:
                dst[y + dy][x + dx] = px


def scaled(src, k):
    return [[px for px in row for _ in range(k)] for row in src for _ in range(k)]


def opaque(p):
    return p[3] == 255


def body_component(f):
    """4-connected opaque body containing the anchor pixel (AX,AY)."""
    assert opaque(f[AY][AX]), "anchor transparent"
    seen, stack = set(), [(AX, AY)]
    while stack:
        x, y = stack.pop()
        if (x, y) in seen or not (0 <= x < FW and 0 <= y < FH):
            continue
        if not opaque(f[y][x]):
            continue
        seen.add((x, y))
        stack.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    return seen


def main():
    src, pal = load()
    assert list(src["frames"]) == list(ORDER), f"frame order {list(src['frames'])}"
    assert list(src["meta"]["grid"]["order"]) == list(ORDER)
    assert src["meta"]["grid"]["anchor"] == [AX, AY]
    frames_raw = src["frames"]
    frames = {name: matrix(rows, pal) for name, rows in frames_raw.items()}
    tile = matrix(src["tile"], pal)

    checks = []

    # --- source checks: size, palette, alpha, anchor connectivity ---
    for name in ORDER:
        rows = frames_raw[name]
        f = frames[name]
        assert (len(rows), len(rows[0])) == (FH, FW), f"{name} size"
        assert all(len(r) == FW for r in rows), name
        assert all(s in OPAQUE or s == "." for r in rows for s in r), f"{name} unknown symbol"
        assert all(px[3] in (0, 255) for r in f for px in r), name
        body = body_component(f)
        assert len(body) >= 100, f"{name} body tiny"
        assert all(px[3] == 0 for px in f[0]), f"{name} top edge"
        assert all(f[y][0][3] == f[y][FW-1][3] == 0 for y in range(FH)), f"{name} side edges"
        checks.append({"view": name, "body_pixels": len(body)})

    # --- floor tile ---
    assert (len(tile), len(tile[0])) == (TH, TW), "tile size"
    assert all(opaque(px) for r in tile for px in r), "tile not fully opaque"

    # --- build player.png (16x96 vertical stack) ---
    player = blank(FW, FH * len(ORDER), pal["."])
    for i, name in enumerate(ORDER):
        blit(player, frames[name], 0, i * FH)
    assert len(player) == 96

    # --- build floor.png ---
    floor = tile

    # --- build preview.png ---
    fw_s, fh_s = FW * SCALE, FH * SCALE
    tw_s, th_s = TW * SCALE, TH * SCALE
    gap, margin = 16, 16
    col_w = fw_s + gap
    sprite_block_w = margin + 4 * col_w
    sprite_block_h = margin + fh_s + margin
    ground_w = PREVIEW_COLS * tw_s
    ground_h = PREVIEW_ROWS * th_s
    ground_block_w = ground_w + 2 * margin
    W = sprite_block_w + ground_block_w
    H = max(sprite_block_h, ground_h + 2 * margin)
    canvas = blank(W, H, pal["W"])
    sheet_row_y = margin + fh_s + gap
    for i, name in enumerate(ORDER):
        blit(canvas, scaled(frames[name], SCALE), margin + i * col_w, margin)

    gx, gy = sprite_block_w + margin, (H - ground_h) // 2
    one = scaled(tile, SCALE)
    for ry in range(PREVIEW_ROWS):
        for cx in range(PREVIEW_COLS):
            blit(canvas, one, gx + cx * tw_s, gy + ry * th_s)

    placements = []
    for name, col, row in (("down", 3, 1), ("right", 5, 1)):
        # Character origin in ground block:
        fx = gx + col * 16 * 8 + 8 * 8 - 8 * 8
        fy = gy + row * 16 * 8 + 15 * 8 - 23 * 8
        src_img = scaled(frames[name], SCALE)
        blit(canvas, src_img, fx, fy)
        tile_foot_x = gx + col * tw_s + AX * SCALE
        tile_foot_y = gy + row * tw_s + TH * SCALE - SCALE  # bottom row y=15
        sprite_foot_x = fx + AX * SCALE
        sprite_foot_y = fy + AY * SCALE
        assert sprite_foot_x == tile_foot_x, (name, sprite_foot_x, tile_foot_x)
        assert sprite_foot_y == tile_foot_y, (name, sprite_foot_y, tile_foot_y)
        assert 0 <= fx and fx + FW * SCALE <= W, name
        assert 0 <= fy and fy + FH * SCALE <= H, name
        placements.append({
            "view": name, "tile": [col, row],
            "sprite_origin": [fx, fy],
            "sprite_foot": [sprite_foot_x, sprite_foot_y],
            "tile_foot": [tile_foot_x, tile_foot_y],
        })
    assert margin + 4 * col_w <= gx, "sprite row overlaps ground block"

    # --- reproducibility: encode twice, then write ---
    player_bytes = png_bytes(player)
    assert player_bytes == png_bytes(player), "player.png not reproducible"
    player_dims = write_png(HERE / "player.png", player, player_bytes)
    floor_bytes = png_bytes(floor)
    assert floor_bytes == png_bytes(floor), "floor.png not reproducible"
    floor_dims = write_png(HERE / "floor.png", floor, floor_bytes)
    canvas_bytes = png_bytes(canvas)
    assert canvas_bytes == png_bytes(canvas), "preview.png not reproducible"
    preview_dims = write_png(HERE / "preview.png", canvas, canvas_bytes)

    # --- verification.json (after writing) ---
    def digest(p):
        return hashlib.sha256(Path(p).read_bytes()).hexdigest()

    verification = {
        "source": "source.json",
        "model": src["meta"]["model"],
        "frame_size": [FW, FH],
        "tile_size": [TW, TH],
        "order": list(ORDER),
        "anchor": [AX, AY],
        "outputs": {
            "player.png": {"size": list(player_dims), "sha256": digest(HERE / "player.png")},
            "floor.png": {"size": list(floor_dims), "sha256": digest(HERE / "floor.png")},
            "preview.png": {"size": list(preview_dims), "sha256": digest(HERE / "preview.png")},
        },
        "checks": {
            "frame_order": True,
            "frame_dimensions": True,
            "palette_exact": True,
            "opaque_alpha_255": True,
            "anchor_nontransparent": True,
            "anchor_connected_to_body": True,
            "tile_fully_opaque": True,
            "sprite_foot_equals_tile_foot": True,
            "bounds_valid": True,
            "png_reproducible": True,
        },
        "bodies": checks,
        "placements": placements,
    }
    (HERE / "verification.json").write_text(
        json.dumps(verification, indent=2, sort_keys=False) + "\n", encoding="utf-8")
    for name, dims in (("player.png", player_dims), ("floor.png", floor_dims),
                       ("preview.png", preview_dims)):
        print(name, dims)
    for p in placements:
        print("placement", p)


if __name__ == "__main__":
    main()

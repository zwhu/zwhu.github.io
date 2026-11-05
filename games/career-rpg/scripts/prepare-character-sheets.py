#!/usr/bin/env python3
"""Preserve originals; make explicitly alpha-normalized review candidates, not runtime atlases."""
import ctypes as C
import hashlib
import json
import struct
import subprocess
import zlib
from pathlib import Path

GAME = Path(__file__).resolve().parents[1]
SOURCE = GAME / 'art/source/remaining-characters-v1'
OUT = GAME / 'art/processed/remaining-characters-v1'


class PNGImage(C.Structure):
    _fields_ = [('opaque', C.c_void_p), ('version', C.c_uint32), ('width', C.c_uint32),
                ('height', C.c_uint32), ('format', C.c_uint32), ('flags', C.c_uint32),
                ('entries', C.c_uint32), ('warning', C.c_uint32), ('message', C.c_char * 64)]


lib = C.CDLL('/opt/homebrew/opt/libpng/lib/libpng16.16.dylib')
lib.png_image_begin_read_from_file.argtypes = [C.POINTER(PNGImage), C.c_char_p]
lib.png_image_finish_read.argtypes = [C.POINTER(PNGImage), C.c_void_p, C.c_void_p, C.c_int32, C.c_void_p]
lib.png_image_free.argtypes = [C.POINTER(PNGImage)]


def decode(path):
    im = PNGImage(); im.version = 1
    try:
        assert lib.png_image_begin_read_from_file(C.byref(im), str(path).encode()), bytes(im.message)
        im.format = 3
        buffer = (C.c_ubyte * (im.width * im.height * 4))()
        assert lib.png_image_finish_read(C.byref(im), None, buffer, 0, None), bytes(im.message)
        return im.width, im.height, bytes(buffer)
    finally:
        lib.png_image_free(C.byref(im))


def encode(w, h, data):
    def chunk(kind, body):
        return struct.pack('!I', len(body)) + kind + body + struct.pack('!I', zlib.crc32(kind + body) & 0xffffffff)
    scan = b''.join(b'\0' + data[y*w*4:(y+1)*w*4] for y in range(h))
    return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('!2I5B', w, h, 8, 6, 0, 0, 0))
            + chunk(b'sRGB', b'\0') + chunk(b'IDAT', zlib.compress(scan, 9)) + chunk(b'IEND', b''))


if __name__ == '__main__':
    report = {'status': 'design_candidates_only_not_runtime_atlases', 'alpha_threshold': 128,
              'source_rgba_unchanged': False, 'production_replaced': False,
              'method': 'libpng RGBA8 decode; alpha<128 removed, others opaque; transparent RGB zeroed; no resize or palette quantization; PNG->WebP lossless exact; decode verified',
              'metadata': 'Original images and provenance retained under art/source; derived candidate contains sRGB only, no provenance claim transferred',
              'limitations': ['Threshold changes alpha and may remove detail; visual comparison required.',
                              'Sheets are not split into runtime frames or aligned by animation anchors.',
                              'Walking, typing and runtime rendering not implemented for new characters.'], 'characters': []}
    for folder in sorted(SOURCE.iterdir()):
        if not folder.is_dir():
            continue
        source = folder / 'original.png'; w, h, original = decode(source)
        candidate = bytearray(original); changed = 0
        for i in range(0, len(candidate), 4):
            before = bytes(candidate[i:i+4])
            if candidate[i+3] < 128:
                candidate[i:i+4] = b'\0\0\0\0'
            else:
                candidate[i+3] = 255
            changed += bytes(candidate[i:i+4]) != before
        dest = OUT / folder.name; dest.mkdir(parents=True, exist_ok=True)
        png = dest / 'sheet.png'; webp = dest / 'sheet.webp'
        png.write_bytes(encode(w, h, candidate))
        subprocess.run(['/opt/homebrew/bin/cwebp', '-quiet', '-lossless', '-exact', '-q', '100', '-m', '4', '-metadata', 'all', str(png), '-o', str(webp)], check=True, timeout=60)
        decoded = dest / 'decode-check.png'
        subprocess.run(['/opt/homebrew/bin/dwebp', str(webp), '-o', str(decoded)], check=True, capture_output=True, timeout=30)
        dw, dh, rgba = decode(decoded); assert (dw, dh) == (w, h) and rgba == bytes(candidate)
        decoded.unlink()
        report['characters'].append({'id': folder.name, 'width': w, 'height': h,
                                    'original_bytes': source.stat().st_size, 'candidate_png_bytes': png.stat().st_size,
                                    'candidate_webp_bytes': webp.stat().st_size, 'alpha_changed_pixels': changed,
                                    'source_sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
                                    'candidate_rgba_sha256': hashlib.sha256(candidate).hexdigest(),
                                    'candidate_webp_sha256': hashlib.sha256(webp.read_bytes()).hexdigest(),
                                    'webp_decoded_exact_to_processed_png': True})
    report['total_original_bytes'] = sum(x['original_bytes'] for x in report['characters'])
    report['total_candidate_webp_bytes'] = sum(x['candidate_webp_bytes'] for x in report['characters'])
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT/'summary.json').write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps({k:v for k,v in report.items() if k != 'characters'}, indent=2))

"""Codex-authored pixel geometry; no reference image decoding or sampling."""
import hashlib
import json
import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent
W, H = 48, 64
P = {'ink':'292522', 'hair':'282420', 'hair2':'302a24',
     'skin':'f4c79f', 'light':'ffdbb1', 'shade':'dba57e',
     'red':'a34530', 'redlight':'b65339', 'redshade':'873a29', 'reddark':'603025',
     'collar':'f3e4c6', 'collarshade':'cdbb9c', 'pants':'444a50',
     'pantslight':'50575e', 'pantsshade':'353a3e', 'boot':'302b26', 'bootlight':'494036'}


class Frame:
    def __init__(self, flip=False):
        self.data = bytearray(W * H * 4)
        self.flip = flip

    def dot(self, x, y, color):
        if self.flip:
            x = W - 1 - x
        if 0 <= x < W and 0 <= y < H:
            i = (y * W + x) * 4
            self.data[i:i+4] = bytes.fromhex(P[color]) + b'\xff'

    def rect(self, x, y, w, h, color):
        for yy in range(y, y+h):
            for xx in range(x, x+w):
                self.dot(xx, yy, color)

    def poly(self, points, color):
        for y in range(min(p[1] for p in points), max(p[1] for p in points)):
            edges = []
            for a, b in zip(points, points[1:] + points[:1]):
                if min(a[1],b[1]) <= y+.5 < max(a[1],b[1]):
                    edges.append(a[0] + (y+.5-a[1])*(b[0]-a[0])/(b[1]-a[1]))
            edges.sort()
            for left, right in zip(edges[::2], edges[1::2]):
                for x in range(int(left)-1, int(right)+1):
                    if left <= x+.5 < right:
                        self.dot(x,y,color)


def body(f, back=False):
    f.poly([(17,42),(31,42),(31,56),(33,58),(33,62),(25,62),(25,51),(23,51),(23,62),(15,62),(15,58),(17,56)],'ink')
    f.rect(18,44,12,5,'pants')
    for x in [18,25]:
        f.rect(x,48,5,10,'pants')
        f.rect(x,49,1,7,'pantslight')
        f.rect(x+4,50,1,7,'pantsshade')
    for x in [15,25]:
        f.rect(x,58,8,3,'boot')
        f.rect(x+1,59,5,1,'bootlight')
    f.poly([(17,28),(20,27),(28,27),(31,28),(33,31),(33,35),(35,38),(35,45),(33,45),(33,49),(29,49),(28,44),(20,44),(19,49),(15,49),(14,46),(13,46),(13,38),(15,34),(15,30)],'ink')
    # Sleeves and cuff silhouettes are drawn before the body.
    for x in [14,30]:
        f.rect(x,36,4,9,'redshade')
        f.rect(x+1,33,3,8,'red')
        f.rect(x+1,44,3,2,'reddark')
        f.rect(x+1,46,3,2,'skin')
        f.dot(x+1,46,'light')
    f.poly([(18,29),(21,28),(27,28),(30,29),(31,33),(31,43),(29,45),(19,45),(17,43),(17,34)],'reddark')
    f.poly([(19,30),(29,30),(30,33),(30,41),(27,43),(19,43),(18,41),(18,33)],'red')
    f.poly([(19,31),(21,31),(20,35),(19,38),(18,38),(18,34)],'redlight')
    f.rect(28,35,2,6,'redshade')
    f.rect(20,43,8,1,'redshade')
    if back:
        f.rect(21,27,7,3,'reddark')
        f.rect(23,28,4,1,'redshade')
        f.rect(20,38,1,3,'redlight')
    else:
        f.rect(21,25,7,4,'shade')
        f.poly([(19,28),(22,28),(23,29),(27,29),(29,28),(28,31),(22,31)],'collarshade')
        f.rect(22,28,5,2,'collar')
        f.rect(23,30,3,1,'collar')


def front(back=False):
    f=Frame();body(f,back)
    # The jaw is stepped rather than a rectangular face; eyes have no white outline.
    f.poly([(15,15),(31,15),(33,18),(33,22),(31,22),(31,24),(28,24),(28,26),(20,26),(20,25),(16,25),(16,23),(14,23),(14,18)],'ink')
    f.poly([(16,16),(30,16),(31,19),(32,19),(32,22),(30,22),(30,24),(27,24),(27,25),(21,25),(21,24),(17,24),(17,22),(15,22),(15,19)],'skin')
    f.rect(19,23,9,1,'light');f.rect(29,20,2,2,'shade')
    hair=[(19,4),(27,4),(27,6),(31,6),(31,7),(34,7),(34,10),(36,10),(36,15),(35,15),(35,18),(33,18),(33,21),(31,21),(31,24),(29,24),(29,20),(27,20),(27,17),(25,17),(25,19),(23,19),(23,17),(21,17),(21,14),(19,14),(19,17),(17,17),(17,20),(15,20),(15,23),(13,22),(13,20),(11,20),(11,17),(10,17),(10,11),(12,11),(12,8),(16,8),(16,6),(19,6)]
    f.poly(hair,'hair')
    f.rect(16,12,17,6,'hair')
    f.poly([(13,11),(16,9),(20,9),(21,8),(24,8),(22,10),(18,11),(15,13),(12,15)],'hair2')
    if back:
        f.poly([(12,15),(35,14),(34,22),(31,22),(31,25),(28,25),(28,27),(20,27),(20,25),(16,25),(16,23),(13,23)],'hair')
        f.poly([(15,21),(17,23),(21,24),(27,24),(29,23),(29,25),(26,26),(21,26),(18,24)],'hair2')
    else:
        f.poly([(17,17),(30,17),(31,19),(32,20),(32,22),(30,22),(30,24),(27,24),(27,25),(21,25),(21,24),(17,24),(17,22),(15,22),(15,20),(17,19)],'skin')
        f.poly([(17,16),(20,15),(21,15),(21,17),(23,17),(23,19),(25,19),(25,16),(27,16),(27,15),(29,16),(30,18),(32,19),(32,15)],'hair')
        f.rect(18,19,2,4,'ink');f.rect(28,19,2,4,'ink')
        f.rect(22,24,4,1,'light')
        f.dot(17,22,'shade');f.dot(30,23,'shade')
    return f


def side(right=False):
    f=Frame(right)
    f.poly([(22,43),(31,43),(31,55),(32,58),(32,62),(17,62),(17,59),(20,57),(20,49)],'ink')
    f.rect(22,45,7,11,'pants');f.rect(23,48,2,8,'pantslight');f.rect(28,47,1,10,'pantsshade')
    f.rect(18,59,13,2,'boot');f.rect(20,59,8,1,'bootlight')
    f.poly([(20,27),(28,27),(31,30),(32,37),(32,44),(29,46),(21,45),(18,43),(18,33)],'ink')
    f.poly([(21,29),(28,29),(30,32),(30,43),(27,44),(20,43),(20,34)],'redshade')
    f.poly([(21,30),(26,30),(25,33),(23,34),(23,40),(20,41),(20,34)],'red')
    f.rect(20,35,1,4,'redlight')
    f.poly([(25,31),(29,31),(31,34),(30,43),(29,45),(25,45),(24,42),(25,36),(24,34)],'reddark')
    f.poly([(26,32),(28,32),(30,35),(29,42),(26,43),(26,37),(25,35)],'red')
    f.rect(26,44,3,4,'skin');f.rect(26,44,1,3,'light');f.rect(25,43,5,1,'reddark')
    f.rect(21,25,6,4,'shade');f.poly([(20,28),(23,27),(27,28),(25,30),(21,30)],'collar')
    f.poly([(16,13),(30,13),(31,19),(28,22),(27,25),(23,27),(19,26),(19,24),(16,24),(16,22),(13,21),(13,19),(15,19)],'ink')
    f.poly([(16,15),(28,15),(29,19),(26,22),(25,25),(22,26),(20,25),(20,23),(17,23),(17,21),(14,20),(16,19)],'skin')
    f.rect(23,24,3,1,'light');f.rect(26,21,2,3,'shade')
    f.poly([(23,4),(29,4),(29,6),(33,6),(33,8),(35,8),(35,11),(37,11),(37,16),(36,16),(36,21),(34,21),(34,24),(30,24),(30,26),(27,26),(27,22),(25,22),(25,20),(23,20),(23,17),(20,17),(20,15),(18,15),(18,17),(16,17),(16,20),(14,20),(14,17),(12,17),(12,12),(14,12),(14,9),(18,9),(18,7),(23,7)],'hair')
    f.poly([(16,11),(20,9),(26,8),(28,9),(24,10),(21,12),(17,14),(14,15)],'hair2')
    f.rect(17,18,2,4,'ink');f.rect(25,21,2,2,'skin');f.dot(26,22,'shade')
    if right:
        f.rect(31,9,2,1,'hair2')
    return f


def encode(width,height,data):
    def chunk(kind,body):
        return struct.pack('!I',len(body))+kind+body+struct.pack('!I',zlib.crc32(kind+body)&0xffffffff)
    rows=b''.join(b'\0'+data[y*width*4:(y+1)*width*4] for y in range(height))
    return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('!2I5B',width,height,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(rows,9))+chunk(b'IEND',b'')


if __name__=='__main__':
    frames=[front(),front(True),side(),side(True)]
    data=bytearray(W*4*H*4)
    for y in range(H):
        for n,f in enumerate(frames):
            start=(y*W*4+n*W)*4
            data[start:start+W*4]=f.data[y*W*4:(y+1)*W*4]
    raw=encode(W*4,H,data);(ROOT/'character.png').write_bytes(raw)
    scale=6;sw=W*4*scale;sh=H*scale;preview=bytearray(sw*sh*4)
    for y in range(sh):
        for x in range(sw):
            src=((y//scale)*W*4+x//scale)*4;dst=(y*sw+x)*4
            bg=224 if ((x//24+y//24)%2)==0 else 241
            preview[dst:dst+4]=data[src:src+4] if data[src+3] else bytes([bg,bg,bg,255])
    (ROOT/'preview.png').write_bytes(encode(sw,sh,preview))
    report={'author':'Codex','method':'independently authored raster polygons and pixel clusters; no source pixels sampled','frame_size':[W,H],'directions':['down','up','left','right'],'bytes':len(raw),'rgba_colors':len({bytes(data[i:i+4]) for i in range(0,len(data),4)}),'sha256':hashlib.sha256(raw).hexdigest(),'baseline_y':[max(y for y in range(H) if any(f.data[(y*W+x)*4+3] for x in range(W))) for f in frames],'production_replaced':False,'limits':['Standing frames only; no animation or integration.','Side geometry is mostly mirrored; not a full asymmetric character design.','Visual fidelity requires review, not inferred from file size.']}
    (ROOT/'report.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))

"""Deterministic environment drawing; standard library only; no image generation calls."""
import hashlib
import html
import json
import runpy
import struct
import zlib
from pathlib import Path

ROOT=Path(__file__).resolve().parent
W,H=384,216
INK='#30332f'
DESK=runpy.run_path(str(ROOT.parent/'procedural-desk-v1/generate.py'))['render']


class Canvas:
    def __init__(self):self.data=bytearray(W*H*4)
    def rect(self,x,y,w,h,c):
        color=bytes.fromhex(c.lstrip('#'))+b'\xff'
        for yy in range(max(0,y),min(H,y+h)):
            for xx in range(max(0,x),min(W,x+w)):
                i=(yy*W+xx)*4;self.data[i:i+4]=color
    def box(self,x,y,w,h,c,b=2):
        self.rect(x,y,w,h,INK);self.rect(x+b,y+b,w-b*2,h-b*2,c)
    def room(self,night=False,tile=False):
        self.rect(0,0,W,H,'#e7ddc7' if not night else '#656d7b')
        self.rect(0,62,W,154,'#b57d53' if not night else '#655a57')
        for y in range(65,H,16):
            self.rect(0,y,W,1,'#97633f' if not night else '#51494a')
            for x in range(-48+(y//16%2)*40,W,80):self.rect(x,y,1,16,'#97633f' if not night else '#51494a')
        if tile:
            self.rect(0,62,W,154,'#b4b9b2')
            for x in range(0,W,24):self.rect(x,62,1,154,'#8c9895')
            for y in range(62,H,24):self.rect(0,y,W,1,'#8c9895')
        self.rect(0,59,W,4,INK);self.rect(0,0,4,H,INK);self.rect(W-4,0,4,H,INK)
        self.rect(0,H-4,152,4,INK);self.rect(228,H-4,156,4,INK)
    def window(self,x,y,w=90,h=40,night=False):
        self.box(x,y,w,h,'#aecbd1' if not night else '#263d58',3)
        if night:
            for xx,hh in [(x+7,10),(x+25,17),(x+46,13),(x+66,22)]:
                self.rect(xx,y+h-hh-4,12,hh,'#354858')
                self.rect(xx+4,y+h-hh,2,2,'#e5c777')
        else:
            self.rect(x+4,y+h-13,w-8,9,'#6f9251')
            for xx in range(x+8,x+w-8,17):self.rect(xx,y+h-17,12,6,'#89a65a')
        self.rect(x+w//2,y+2,3,h-4,INK);self.rect(x,y+h-8,w,2,INK)
    def desk(self,x,y,scale=.48):
        raw=DESK();dw,dh=int(160*scale),int(128*scale)
        for yy in range(dh):
            for xx in range(dw):
                src=(min(127,int(yy/scale))*160+min(159,int(xx/scale)))*4
                if raw[src+3] and 0<=x+xx<W and 0<=y+yy<H:
                    dst=((y+yy)*W+x+xx)*4;self.data[dst:dst+4]=raw[src:src+4]
    def plant(self,x,y):
        self.box(x+5,y+18,16,16,'#e4d7b4');self.rect(x+11,y+5,3,17,'#415b39')
        for dx,dy,w,h in [(0,8,11,6),(16,5,10,6),(5,0,7,11),(13,0,6,10)]:
            self.box(x+dx,y+dy,w,h,'#779e4c',1)
    def shelf(self,x,y,w=45,h=70):
        self.box(x,y,w,h,'#885c3c',3)
        colors=['#647b81','#ded4b9','#ad6642','#48606a','#c49a65']
        for yy in range(y+7,y+h-10,22):
            self.rect(x+4,yy-2,w-8,17,'#343a38')
            for n,xx in enumerate(range(x+6,x+w-7,6)):
                self.rect(xx,yy+(n%3),4,12-n%3,colors[n%5])
            self.rect(x+3,yy+15,w-6,3,'#bd8c56')
    def carton(self,x,y,w=20,h=16):
        self.box(x,y,w,h,'#bd9761',1);self.rect(x+w//2-1,y+1,3,h-2,'#ddc38b')
        self.rect(x+3,y+h-5,5,2,'#886a45')
    def board(self,x,y,w,h):
        self.box(x,y,w,h,'#d9e2d8');self.rect(x+5,y+6,w-10,2,'#91a399')
        for xx,yy in [(7,13),(24,20),(42,12),(59,26)]:
            if xx+10<w:self.box(x+xx,y+yy,10,8,'#ddbf75',1)
    def table(self,x,y,w=90,h=30):
        self.box(x+4,y+h-2,6,16,'#7c553d');self.box(x+w-10,y+h-2,6,16,'#7c553d')
        self.box(x,y,w,h,'#bb8551');self.rect(x+3,y+3,w-6,3,'#d1a46c')
    def laptop(self,x,y):
        self.box(x,y,25,17,'#536d79');self.rect(x+3,y+3,19,10,'#334a58')
        self.box(x-2,y+17,29,5,'#71858b',1)
    def bed(self,x,y):
        self.box(x+2,y+7,46,82,'#76583e');self.box(x,y,50,12,'#9b7851')
        self.box(x+5,y+15,40,66,'#738e91');self.box(x+9,y+18,32,13,'#e8e1cb',1)
        self.rect(x+8,y+41,34,3,'#9fb4ad');self.rect(x+9,y+46,3,30,'#526f78')
    def poster(self,x,y,color):
        self.box(x,y,21,28,'#e7d9bb',1);self.rect(x+3,y+4,15,12,color)
        self.rect(x+4,y+20,12,1,'#929584');self.rect(x+4,y+23,8,1,'#929584')


SCENES=[
 ('hefei-dorm','合肥 · 大学宿舍','宿舍、游戏与求职前的自己；家具布局为演出设定。'),
 ('hefei-startup','合肥 · 安风徳办公室','求职、技术习惯与两次加薪；不虚构老板原话。'),
 ('nanjing-night','南京 · 深夜书桌','回家读技术书至凌晨两点；不把学习与故障强行建立因果。'),
 ('hangzhou-product','杭州 · 商品发布团队','商品发布与SDK协作；屏幕仅示意，不伪造真实系统。'),
 ('double11','杭州 · 双11值守','与TL共同排查；不编造超卖根因或真实日志。'),
 ('cloud-project','杭州 · 浙里办项目','设计系统与低码协作；不冒充真实办公空间。'),
 ('community-feedback','杭州 · 读到业主群反馈','主角在家阅读转述；不把群消息改成与家长当面见面。'),
 ('healthcode','春节 · 健康码支援','只表现临时抽调参与，不添加未确认的职责、地址与成果。'),
 ('parcel-station','菜鸟 · 驿站工作现场','驿站包裹与扫码工作区；不绘制雇主标志或真实用户标签。'),
 ('delivery-estate','双11 · 送货入楼','小区入口与楼道配送演出，不指定真实小区布局。'),
 ('bytedance','字节 · 性能工作','当前工作协作场景；不伪造内部看板或企业UI。'),
 ('present-study','现在 · AI与写作书桌','学习、工具、AgentToy与Blogflow；屏幕不生成假对话。')]


def draw(key):
    c=Canvas();night=key in ['nanjing-night','double11','healthcode','present-study']
    c.room(night,tile=key in ['parcel-station','delivery-estate','cloud-project'])
    if key=='hefei-dorm':
        c.window(93,10,108,43);c.bed(15,72);c.bed(315,72)
        c.desk(88,76,.57);c.desk(207,76,.57);c.shelf(92,154,45,48)
        c.poster(243,18,'#79855e');c.carton(274,176);c.rect(164,171,63,27,'#6b8077')
    elif key=='hefei-startup':
        c.window(22,10,103,42);c.board(158,12,106,40)
        c.desk(20,83,.61);c.desk(149,80,.61);c.shelf(319,62,48,82)
        c.table(104,160,125,26);c.laptop(151,160);c.plant(339,163)
    elif key=='nanjing-night':
        c.window(139,8,124,45,True);c.shelf(15,70,48,104)
        c.table(100,87,188,49);c.laptop(169,92)
        for i in range(4):c.box(113,104+i*4,32,4,['#c5b89a','#73818a'][i%2],1)
        c.box(246,94,8,20,'#d7b873');c.box(239,86,23,9,'#dfc78d')
        c.box(174,139,34,36,'#526977');c.plant(319,132);c.poster(78,17,'#76778a')
    elif key=='hangzhou-product':
        c.window(15,10,118,42);c.window(149,10,118,42);c.board(286,12,75,38)
        for x in [19,144,269]:c.desk(x,81,.57)
        c.table(115,164,150,26);c.laptop(172,163);c.plant(24,170);c.plant(332,165)
    elif key=='double11':
        c.window(21,10,96,42,True);c.board(146,10,204,42)
        for i in range(4):
            c.box(154+i*46,19,38,22,'#425e69');c.rect(159+i*46,34,27,2,'#86a28c')
        c.desk(28,86,.7);c.desk(212,86,.7)
        c.table(141,162,68,24);c.box(149,165,13,8,'#ece1c5');c.box(177,163,17,11,'#e1d8be')
        c.carton(340,179,24,18)
    elif key=='cloud-project':
        c.board(22,10,154,43);c.window(208,10,143,42)
        c.table(72,89,238,49)
        for x in [91,171,251]:c.laptop(x,93)
        for x in [95,175,255]:c.box(x,144,26,24,'#5d7880')
        c.shelf(17,102,34,73);c.plant(337,151)
    elif key=='community-feedback':
        c.window(226,9,129,44);c.shelf(15,71,43,94)
        c.box(84,83,132,18,'#677f76');c.box(76,99,148,38,'#789285')
        c.box(80,132,140,12,'#53685e');c.box(91,104,34,25,'#c2b587');c.box(177,104,34,25,'#b8866f')
        c.table(103,165,100,24);c.box(146,169,10,16,'#394b53');c.rect(148,172,6,8,'#adc0b7')
        c.plant(286,125);c.poster(111,15,'#7a9c8a')
    elif key=='healthcode':
        c.window(216,10,128,42,True);c.poster(30,10,'#b75740');c.poster(65,10,'#b75740')
        c.table(113,92,161,39);c.laptop(165,96);c.box(201,102,9,15,'#303e47')
        c.box(171,137,31,29,'#6d737e');c.shelf(21,78,49,94)
        c.table(292,151,56,25);c.box(310,154,17,10,'#c7ad75');c.plant(95,169)
    elif key=='parcel-station':
        for x in [17,99,181]:
            c.shelf(x,16,66,88)
            for yy in [23,47,70]:
                c.carton(x+7,yy,22,16);c.carton(x+34,yy,23,17)
        c.table(273,77,89,33);c.laptop(298,77);c.box(338,95,10,7,'#577a7b')
        for x,y in [(30,144),(54,162),(84,138),(287,157),(319,174)]:c.carton(x,y,27,21)
        c.box(151,148,72,35,'#6c8588');c.rect(151,151,72,3,'#9aada6')
        c.box(149,183,7,7,'#3e4544');c.box(216,183,7,7,'#3e4544')
    elif key=='delivery-estate':
        c.rect(0,0,W,68,'#b6c2bb');c.rect(0,61,W,5,'#636f6d')
        for x in [28,268]:
            c.box(x,8,81,53,'#d5d3bf');c.box(x+7,14,29,42,'#74848a');c.box(x+44,14,29,42,'#74848a')
        c.box(137,9,111,95,'#65777b',3);c.box(145,16,95,78,'#aab6b1')
        c.rect(190,17,2,76,'#697a7a');c.box(252,24,8,18,'#c6b987',1)
        for y in [108,116,124]:c.box(128,y,129,9,'#c5c8bb',1)
        for x in [28,60,92]:c.carton(x,160,27,23)
        c.box(266,155,69,30,'#6e8586');c.box(264,185,8,7,'#343d3d');c.box(328,185,8,7,'#343d3d')
        c.plant(342,106);c.plant(15,87)
    elif key=='bytedance':
        c.window(21,9,102,43);c.window(140,9,102,43);c.board(260,10,101,42)
        for i,height in enumerate([8,15,12,21,17]):c.rect(271+i*16,43-height,9,height,'#789a87')
        c.desk(30,83,.62);c.desk(220,83,.62)
        c.table(140,159,73,25);c.laptop(165,160);c.plant(19,168);c.shelf(328,153,38,49)
    elif key=='present-study':
        c.window(228,9,126,43,True);c.shelf(16,72,48,111);c.board(84,9,115,42)
        c.table(92,88,209,50);c.laptop(130,92);c.laptop(215,92)
        c.box(148,144,43,37,'#506873')
        for i in range(4):c.box(264,115-i*5,24,5,['#d6c4a2','#737e8b'][i%2],1)
        c.plant(328,128);c.box(103,101,10,14,'#e4d5b6')
    return c


def png(c,w=W,h=H):
    def chunk(k,d):return struct.pack('!I',len(d))+k+d+struct.pack('!I',zlib.crc32(k+d)&0xffffffff)
    raw=b''.join(b'\0'+c.data[y*w*4:(y+1)*w*4] for y in range(h))
    return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('!2I5B',w,h,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(raw,9))+chunk(b'IEND',b'')


if __name__=='__main__':
    records=[]
    contact=Canvas();contact.data=bytearray(W*3*H*4*4)
    for n,(key,title,note) in enumerate(SCENES):
        scene=draw(key);data=png(scene);(ROOT/(key+'.png')).write_bytes(data)
        for y in range(H):
            dst=(((n//3)*H+y)*W*3+(n%3)*W)*4
            contact.data[dst:dst+W*4]=scene.data[y*W*4:(y+1)*W*4]
        records.append({'id':key,'title':title,'note':note,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'file':key+'.png'})
    (ROOT/'contact-sheet.png').write_bytes(png(contact,W*3,H*4))
    report={'method':'Python standard-library raster drawing with shared hand-authored furniture','size':[W,H],'scenes':records,'total_png_bytes':sum(r['bytes'] for r in records),'nanjing_office':'reuse ../../web/art/office-room-v2.png; not redrawn','status':'environment_design_drafts_only','characters_included':False,'game_integrated':False,'limits':['Not a faithful recreation of real buildings.','Simplified textures and geometry differ from canonical Nanjing art; not approved replacements.','No collision, foreground occlusion layers or interaction anchors supplied.']}
    (ROOT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    style='*{box-sizing:border-box}body{margin:0;background:#faf8f3;color:#292825;font:15px/1.8 system-ui,sans-serif}main{max-width:1100px;padding:28px 24px;margin:auto}h1{font-size:27px;font-weight:600}h2{font-size:18px;font-weight:500}section{padding:16px 0;border-top:1px solid #e6e2da}img{width:100%;height:auto;image-rendering:pixelated}p{max-width:850px}.muted{font-size:13px;color:#77746e}nav{display:flex;gap:8px 18px;flex-wrap:wrap}a{color:#a64335}a:focus-visible{outline:3px solid #a64335;outline-offset:3px}@media(max-width:600px){main{padding:20px 12px}}'
    parts=['<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>全旅程程序场景草图</title><style>'+style+'</style><main><p class="muted">程序批量绘制 · 无image_gen调用 · 独立草图，未接入游戏</p><h1>剩余12个场景的环境草图</h1><p>共享家具、墙地、窗户与道具函数，按各场景安排布局。现有南京办公室继续复用。图片不含人物，人物使用已有素材与新设定图；可走区域、遮挡和交互仍需后续配置。没有照片依据的空间均为游戏演出设定。</p><p>全部PNG合计 '+format(report['total_png_bytes'],',')+' B；每张384×216。小体积来自有限像素与规则色块，细节比南京原作简化，尚未达到正式替换标准。</p><nav aria-label="场景目录">'+''.join('<a href="#'+r['id']+'">'+html.escape(r['title'])+'</a>' for r in records)+'</nav>']
    for r in records:parts.append('<section id="'+r['id']+'"><h2>'+html.escape(r['title'])+'</h2><img loading="lazy" src="'+r['file']+'" alt="'+html.escape(r['title'])+'环境程序草图"><p>'+html.escape(r['note'])+'</p><p class="muted">'+format(r['bytes'],',')+' B · 无人物、无交互接入</p></section>')
    parts.append('<section><h2>南京现有基准（复用）</h2><img loading="lazy" src="../../web/art/office-room-v2.png" alt="南京现有办公室背景"><p>程序草图的材质与不规则细节仍有差距，不因场景数量齐全而放宽视觉验收。</p></section><p><a href="generate.py">绘图源码</a> · <a href="report.json">文件与哈希记录</a> · <a href="../remaining-characters-v1/">人物设定</a> · <a href="../../web/">南京游戏</a></p></main></html>')
    (ROOT/'index.html').write_text('\n'.join(parts)+'\n');print(json.dumps({'scenes':len(records),'total_png_bytes':report['total_png_bytes']}))

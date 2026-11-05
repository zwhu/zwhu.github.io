"""Three distinct spatial designs replacing the generic-room experiment. No image APIs."""
import hashlib
import json
import runpy
from pathlib import Path

ROOT=Path(__file__).resolve().parent
LIB=runpy.run_path(str(ROOT.parent/'procedural-scenes-v1/generate.py'))
BASE,PNG=LIB['Canvas'],LIB['png']
W,H=384,216
INK='#30332f'


class Canvas(BASE):
    def poly(self,points,color):
        for y in range(min(p[1] for p in points),max(p[1] for p in points)):
            edges=[]
            for a,b in zip(points,points[1:]+points[:1]):
                if min(a[1],b[1])<=y+.5<max(a[1],b[1]):edges.append(a[0]+(y+.5-a[1])*(b[0]-a[0])/(b[1]-a[1]))
            edges.sort()
            for left,right in zip(edges[::2],edges[1::2]):
                for x in range(int(left)-1,int(right)+1):
                    if left<=x+.5<right:self.rect(x,y,1,1,color)
    def oval(self,x,y,w,h,color):
        for yy in range(h):
            for xx in range(w):
                if ((xx+.5-w/2)/(w/2))**2+((yy+.5-h/2)/(h/2))**2<=1:self.rect(x+xx,y+yy,1,1,color)
    def bunk(self,x,y,blue=True):
        # Two separate mattress decks, guard rails and a ladder distinguish a dorm bed.
        cloth='#5f8290' if blue else '#8b7b69'
        self.rect(x+4,y+35,70,73,'#807d6d')
        self.rect(x+3,y+106,79,6,'#8e8d7b')
        for yy in [y+12,y+65]:
            self.box(x+5,yy,66,31,'#444e4a')
            self.rect(x+8,yy+3,60,21,cloth);self.rect(x+9,yy+5,19,15,'#e5dfca')
            self.rect(x+30,yy+5,36,2,'#9fabb0');self.rect(x+30,yy+9,3,13,'#7f9aa0')
            self.rect(x+7,yy+25,63,5,'#b2b2a0')
        for xx in [x,x+72]:
            self.box(xx,y,5,112,'#9da69d',1);self.rect(xx+2,y+3,1,104,'#d2d1bd')
        self.box(x+3,y+4,72,4,'#b8b8a6',1)
        for xx in [x+12,x+29,x+47,x+63]:self.rect(xx,y+5,2,12,'#b7b8a9')
        self.rect(x+5,y+16,65,2,'#c4c4b1')
        for xx in [x+57,x+71]:self.box(xx,y+35,4,75,'#aab0a0',1)
        for yy in range(y+42,y+107,13):self.box(x+57,yy,18,3,'#bcbdaa',1)
        # Under-bed personal storage and slippers.
        self.box(x+12,y+98,25,10,'#6d7d74');self.rect(x+21,y+100,7,2,'#a8b4a0')
        self.box(x+41,y+105,6,7,'#616a6d',1);self.box(x+49,y+105,6,7,'#616a6d',1)
    def parcels(self,x,y,n=3):
        for i in range(n):self.carton(x+(i%3)*19,y-(i//3)*15,17,14)
    def tree(self,x,y):
        self.oval(x+2,y+35,38,12,'#8d9d79');self.box(x+19,y+20,5,23,'#806445',1)
        self.poly([(x+5,y+24),(x,y+19),(x+3,y+10),(x+9,y+10),(x+12,y+2),(x+26,y),(x+30,y+6),(x+38,y+7),(x+43,y+18),(x+36,y+27),(x+24,y+30),(x+13,y+29)],INK)
        self.poly([(x+7,y+22),(x+3,y+17),(x+7,y+12),(x+13,y+12),(x+15,y+5),(x+25,y+3),(x+29,y+10),(x+36,y+10),(x+39,y+18),(x+32,y+24),(x+22,y+26),(x+12,y+25)],'#739153')
        self.rect(x+15,y+7,10,4,'#9bb06a');self.rect(x+7,y+15,9,4,'#8ba55b')


def dorm():
    c=Canvas();c.rect(0,0,W,H,'#d8d0b7');c.rect(0,53,W,163,'#9faaa0')
    for y in range(55,H,20):
        c.rect(0,y,W,1,'#89978c')
        for x in range(0,W,28):c.rect(x,y,1,20,'#89978c')
    c.rect(0,50,W,4,INK);c.rect(0,0,5,H,INK);c.rect(379,0,5,H,INK)
    c.window(115,6,153,43);c.rect(111,4,8,48,'#6c9296');c.rect(265,4,8,48,'#6c9296')
    c.bunk(13,64);c.bunk(293,64,False)
    # Rear study nook and separate circulation down the centre.
    c.desk(109,62,.48);c.desk(201,62,.48)
    c.rect(132,142,122,48,'#727d70');c.rect(136,145,114,42,'#828b76')
    for y in [151,157,174,180]:c.rect(141,y,104,1,'#9fa28a')
    c.box(161,153,68,24,'#b08a56');c.box(166,175,5,12,'#6e6148');c.box(219,175,5,12,'#6e6148')
    c.laptop(182,151);c.box(212,157,7,9,'#d3d9c5',1)
    # Laundry line, hanging clothes and two distinct paper shapes.
    c.rect(14,19,74,1,'#555d53')
    for x,col in [(26,'#6f879a'),(56,'#ae7159')]:
        c.poly([(x,23),(x+5,21),(x+9,21),(x+14,23),(x+18,30),(x+13,32),(x+13,44),(x+1,44),(x+1,32),(x-4,30)],INK)
        c.rect(x+2,24,10,18,col);c.rect(x-1,25,16,5,col)
    c.poster(315,9,'#8c6752');c.poster(342,14,'#647d88')
    c.oval(16,184,23,16,INK);c.oval(18,185,19,12,'#637f85');c.oval(20,186,15,5,'#9eafb0')
    c.box(349,182,19,22,'#9a8061');c.rect(352,185,13,2,'#c2ad87')
    c.rect(5,212,145,4,INK);c.rect(234,212,145,4,INK)
    return c


def station():
    c=Canvas();c.rect(0,0,W,H,'#d5d0bc');c.rect(0,47,W,169,'#a9b1aa')
    for y in range(51,H,17):
        c.rect(0,y,W,1,'#8e9a94')
        for x in range(-20+(y//17%2)*20,W,40):c.rect(x,y,1,17,'#8e9a94')
    c.box(7,5,217,36,'#637776',3);c.rect(12,10,207,5,'#90a198')
    # Open shutter, side access, fixed ceiling fixtures.
    c.box(241,5,131,51,'#3d4e51',3)
    for y in [10,15,20,25,30]:c.rect(245,y,123,2,'#81928b')
    c.rect(247,34,118,19,'#4d615e');c.rect(260,38,88,11,'#9fb9b2')
    for x in [27,123,261]:c.box(x,43,51,4,'#e6dfbb',1)
    # Warehouse racks have exposed steel uprights and mixed-size stacks.
    for x in [13,88,163]:
        c.rect(x+4,67,64,68,'#737e72')
        for xx in [x,x+66]:c.box(xx,62,4,83,'#687c7c',1)
        for yy in [72,98,124]:
            c.rect(x+3,yy+17,65,4,'#526763')
            c.parcels(x+6,yy+3,3);c.carton(x+45,yy-2,18,19)
        c.rect(x+8,139,55,6,'#89978b')
    # Packing bench, tape roll, scanner, terminal and a conveyor.
    c.table(257,77,111,35);c.laptop(278,76)
    c.box(326,85,22,16,'#b28e58');c.rect(335,87,3,12,'#ddc08a')
    c.box(352,90,8,9,'#45575c',1);c.rect(355,97,3,8,'#45575c')
    c.oval(312,95,9,6,'#d0ba83');c.oval(315,97,3,2,'#695e42')
    c.box(118,157,141,25,'#697b7a');c.rect(122,161,133,13,'#344c4d')
    for x in range(126,252,8):c.rect(x,162,3,11,'#8d9c94')
    c.carton(146,153,26,22);c.carton(200,151,23,21)
    c.box(124,181,5,15,'#506663');c.box(248,181,5,15,'#506663')
    # Cage trolley and rolling wheels, not office furniture.
    c.box(284,148,79,44,'#547579');c.rect(288,152,71,35,'#8aa2a0')
    for x in range(292,359,11):c.rect(x,153,2,32,'#46676a')
    c.rect(287,164,73,2,'#46676a');c.rect(287,178,73,2,'#46676a')
    c.parcels(298,179,3);c.box(287,192,7,8,'#394647',1);c.box(352,192,7,8,'#394647',1)
    c.parcels(20,184,5)
    c.rect(0,211,W,5,'#596c68')
    for x in range(0,W,16):c.poly([(x,211),(x+7,211),(x+12,216),(x+5,216)],'#d1b55a')
    return c


def estate():
    c=Canvas();c.rect(0,0,W,H,'#d0ddd2');c.rect(0,101,W,115,'#aeb8aa')
    # Two masonry building masses frame a recessed entry and courtyard, no indoor shell.
    for x,w in [(0,129),(252,132)]:
        c.box(x,-4,w,112,'#bdc1b2',3);c.rect(x+5,0,w-10,104,'#d6d3c0')
        for y in range(9,104,9):
            c.rect(x+4,y,w-8,1,'#c4c3b1')
            for xx in range(x+8+(y//9%2)*12,x+w-4,25):c.rect(xx,y,1,9,'#c4c3b1')
        for xx in [x+18,x+73]:
            for yy in [10,53]:
                c.box(xx,yy,34,32,'#50666b',2);c.rect(xx+3,yy+3,28,23,'#94b1b5')
                c.rect(xx+16,yy+2,2,26,'#4d6266');c.rect(xx+2,yy+17,30,2,'#4d6266')
                c.rect(xx-2,yy+30,38,4,'#8d978b')
    c.rect(129,0,123,110,'#5f7370')
    c.box(143,27,97,80,'#384f51',3);c.rect(147,31,88,67,'#708e8c')
    c.rect(148,33,41,62,'#8aa9a3');c.rect(193,33,40,62,'#819b96')
    c.rect(189,30,4,68,'#3e5757');c.rect(183,61,3,12,'#c4c6a5');c.rect(198,61,3,12,'#c4c6a5')
    c.poly([(132,23),(139,14),(244,14),(253,23),(253,30),(132,30)],INK)
    c.rect(137,22,111,5,'#8d9a8a');c.box(244,44,8,18,'#b7b78c',1)
    c.box(155,5,72,9,'#9daa97',1)
    for y,width in [(105,105),(112,123),(119,141)]:
        c.box(191-width//2,y,width,9,'#c8c9b7',1);c.rect(194-width//2,y+2,width-6,2,'#e2dfcb')
    # Paved route changes shape around planted areas.
    c.poly([(119,129),(263,129),(313,216),(70,216)],'#d0d1bc')
    for y in range(135,216,12):
        c.rect(108-(y-135)//3,y,171+(y-135)*2//3,1,'#acb5a2')
        for x in range(117+(y//12%2)*15,273,30):c.rect(x,y,1,12,'#b1b9a8')
    for x in [7,303]:
        c.box(x,122,73,41,'#798c69',1);c.rect(x+3,126,67,32,'#8fa57d')
        c.tree(x+8,110);c.tree(x+37,123)
    c.box(15,175,49,7,'#8b7050');c.rect(18,183,4,13,'#475e54');c.rect(56,183,4,13,'#475e54')
    c.box(18,166,43,5,'#ac8a5e');c.rect(19,171,3,5,'#7a654b');c.rect(57,171,3,5,'#7a654b')
    # Parked delivery tricycle, cargo box and loose parcels.
    c.oval(318,197,13,13,INK);c.oval(360,197,13,13,INK)
    c.box(318,174,56,27,'#547c7b');c.rect(322,178,48,17,'#7b9d90')
    c.rect(339,178,3,17,'#557f77');c.rect(323,192,46,2,'#456b69')
    c.rect(310,179,4,24,'#3f5554');c.rect(303,176,12,3,'#3f5554')
    c.carton(324,161,22,18);c.carton(347,166,20,13)
    c.carton(90,175,23,21);c.carton(110,190,21,18)
    return c


SCENES=[('hefei-dorm','合肥大学宿舍',dorm,'上下铺、梯子、晾衣、双人学习位，中央保留走道。'),('parcel-station','菜鸟驿站',station,'开放卷帘门、密集包裹架、打包台、滚筒带和笼车。'),('delivery-estate','送货小区',estate,'室外住宅立面、内凹入口、台阶、庭院铺装与配送车。')]


if __name__=='__main__':
    rows=[];sheet=Canvas();sheet.data=bytearray(W*3*H*4)
    for n,(key,title,fn,note) in enumerate(SCENES):
        c=fn();data=PNG(c);(ROOT/(key+'.png')).write_bytes(data)
        for y in range(H):sheet.data[(y*W*3+n*W)*4:(y*W*3+(n+1)*W)*4]=c.data[y*W*4:(y+1)*W*4]
        rows.append({'id':key,'title':title,'note':note,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
    (ROOT/'contact-sheet.png').write_bytes(PNG(sheet,W*3,H))
    report={'method':'program-only raster geometry; no image_gen','prior_feedback':'v1 too simplified and indistinguishable; rejected as visual direction','status':'three_scene_spatial_redesign_drafts','dimensions':[W,H],'scenes':rows,'total_scene_bytes':sum(r['bytes'] for r in rows),'production_replaced':False,'limits':['Game staging layouts, not historical reconstruction.','Still simpler than canonical Nanjing; no formal style acceptance.','No actors, collisions, foreground layers or game integration.','Other nine v1 scenes have not received this redesign.']}
    (ROOT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    css='*{box-sizing:border-box}body{margin:0;background:#faf8f3;color:#292825;font:15px/1.8 system-ui,sans-serif}main{max-width:1120px;margin:auto;padding:28px 24px}h1{font-size:27px;font-weight:600}h2{font-size:20px;font-weight:500}section{border-top:1px solid #e6e2da;padding:20px 0}.pair{display:grid;grid-template-columns:1fr 1fr;gap:18px}img{width:100%;height:auto;image-rendering:pixelated}figure{margin:0}figcaption,.muted{font-size:13px;color:#77746e}a{color:#a64335}a:focus-visible{outline:3px solid #a64335;outline-offset:4px}@media(max-width:650px){main{padding:20px 12px}.pair{grid-template-columns:1fr}}'
    parts=['<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>场景空间重画 · v2</title><style>'+css+'</style><main><p class="muted">根据“过于简化、缺少区分度”重画 · 仍为程序草图</p><h1>先让空间本身有所区别</h1><p>三张均为384×216，保留原版作对照。改动集中在空间结构、主物件与使用痕迹，不只换墙色。人物、碰撞和交互尚未接入，其余九张尚未重画；没有真实建筑参考的部分均为演出设定。</p>']
    for r in rows:parts.append('<section><h2>'+r['title']+'</h2><p>'+r['note']+'</p><div class="pair"><figure><figcaption>第一版 · 用户反馈区分度不足</figcaption><img src="../procedural-scenes-v1/'+r['id']+'.png" alt="'+r['title']+'旧草图"></figure><figure><figcaption>第二版 · 空间重画</figcaption><img src="'+r['id']+'.png" alt="'+r['title']+'重画草图"></figure></div></section>')
    parts.append('<p><a href="generate.py">绘图源码</a> · <a href="report.json">本轮范围与记录</a> · <a href="../procedural-scenes-v1/">全部初稿</a></p></main></html>')
    (ROOT/'index.html').write_text('\n'.join(parts)+'\n');print(json.dumps({'scenes':3,'bytes':report['total_scene_bytes']}))

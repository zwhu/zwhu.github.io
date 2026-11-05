from pathlib import Path
from collections import deque
import json,re,hashlib
p=Path(__file__).resolve().parents[1]/'design'
c=json.loads((p/'chapter-01.json').read_text())
assert c['savePolicy']['id']=='atomic-per-event'
assert all(s['checkpoint'] is True for s in c['states'])
assert set(c['savePolicy']['checkpointStates'])=={s['id'] for s in c['states']}
start=(c['entry'],frozenset());q=deque([start]);seen={start}
while q:
 state,flags=q.popleft()
 for t in c['transitions']:
  if t['from']==state and set(t['requires'])<=flags:
   target=(t['to'],flags|frozenset(t['effects']))
   if target not in seen:seen.add(target);q.append(target)
for state,flags in seen:
 snapshot={'schema':1,'chapter':c['id'],'state':state,'flags':sorted(flags)}
 loaded=json.loads(json.dumps(snapshot))
 assert loaded['state']==state and frozenset(loaded['flags'])==flags
 assert loaded['flags'] in [sorted(f) for f in c['legalSnapshots'][state]]
def apply(state,flags,event):
 matches=[t for t in c['transitions'] if t['from']==state and t['event']==event and set(t['requires'])<=flags]
 assert len(matches)==1,event
 t=matches[0]
 if set(t['effects'])<=flags:return state,flags,False
 loaded=json.loads(json.dumps({'state':t['to'],'flags':sorted(flags|frozenset(t['effects']))}))
 return loaded['state'],frozenset(loaded['flags']),True
prefix=['open_forum_post','read_feedback','cto_rallies_team','confirm_feedback_reviewed','confirm_recheck_visited','confirm_impact_scope','resume_narrative','comfort_read']
for order in [('review_test_plan','review_trap_comment'),('review_trap_comment','review_test_plan')]:
 state,flags=start
 for event in prefix+list(order)+['write_manual_entry','open_journey','notice_react','finish_journey']:
  state,flags,accepted=apply(state,flags,event);assert accepted
  if event in ['confirm_recheck_visited','review_test_plan','review_trap_comment']:
   s2,f2,accepted2=apply(state,flags,event)
   assert not accepted2 and s2==state and f2==flags
 assert state=='complete' and {'test_reviewed','comment_reviewed','comfort_read','journey_finished'}<=flags
for d in c['dialogues']:
 assert not any(x in d['text'] for x in ['当时原话我记不清','这个项目第一次','不止一个人','游戏里的摆设','不代表当时'])
text=(p/'chapter-01.md').read_text();art=(p/'chapter-01-art.md').read_text()
assert not re.search('三项顺序任意|检查点 none|没有 report 快照|接着处理',text)
assert '(8,15)' in art and '16*y+15' in art
assert sum(s['budgetSeconds'] for s in c['states'])<=c['targetSeconds'][1]
rows=re.findall(r'^\s*(\d{1,2}) ([.A-HTe@+,]+)$',text,re.M)
assert len(rows)==16,('diagram rows',len(rows))
assert all(int(y)==i and len(row)==24 for i,(y,row) in enumerate(rows))
drawn={(x,int(y)) for y,row in rows for x,glyph in enumerate(row) if glyph in 'ABCDEFGHe'}
assert drawn=={tuple(tile) for tile in c['map']['blockedTiles']},'Diagram collision cells differ from data'
for asset in c['assets']:
 if asset['kind']=='audio':continue
 w,h=asset['size']
 if 'anchorX' in asset:assert 0<=asset['anchorX']<w and 0<=asset['anchorY']<h
 for sheet in asset.get('sheets',{}).values():
  if 'anchor' in sheet:assert 0<=sheet['anchor'][0]<w and 0<=sheet['anchor'][1]<h
  if 'sheetSize' in sheet:assert sheet['sheetSize']==[w*sheet['columns'],h*sheet['rows']]
hexes=set()
def scan(v):
 if isinstance(v,dict):
  for x in v.values():scan(x)
 elif isinstance(v,list):
  for x in v:scan(x)
 elif isinstance(v,str) and re.fullmatch('#[0-9a-fA-F]{6}',v):hexes.add(v.lower())
scan(c['palette']);assert len(hexes)==12 and all(x in art for x in hexes)
files={}
for f in ['chapter-01.md','chapter-01-art.md','chapter-01.json']:
 s=(p/f).read_text();assert '\ufffd' not in s and 'cfw' not in s
 files[f]=hashlib.sha256((p/f).read_bytes()).hexdigest()
print(json.dumps({'result':'passed','scope':'design data and document audit; no gameplay or visual acceptance',
 'atomicSnapshotConfigurations':len(seen),'learningOrdersVerified':2,'duplicateConfirmations':'unchanged and ignored',
 'mapDiagram':'matches all blocked cells','pixelAnchors':'in bounds','paletteColors':len(hexes),'sha256':files},ensure_ascii=False,indent=2))

#!/usr/bin/env python3
"""Write design/chapter-01.json and the two Markdown drafts from one data source.

Run from the repository root:
    python3 games/career-rpg/design/revisions/gen-chapter-01.py

Sources: tasks/chapter-01-flash.md and design/revisions/review-01.md … review-05.md.

review-05 policy, defined once: every accepted event writes exactly one full snapshot
{state, flags} (state = the state after the event), all seven states are checkpoints,
chapter_start writes {office, []}, restore reads that snapshot back exactly, and any
snapshot outside the legal (state, flags) set is treated as corrupt. SAVE_POLICY below
is the only definition; the JSON field, the state table, the storyboard "存档与恢复"
lines, the per-event save table, the restore examples and the simulator are all derived
from it. Markdown is rendered from the same data as the JSON, so coordinates, events,
dialogue IDs, asset IDs and footprints cannot drift between the three files. The
read-only simulator (simulate()) must pass before any file is written.
"""
import itertools
import json
import subprocess
import sys

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "design"

# ---------------------------------------------------------------------------------------------
# Identity and map
# ---------------------------------------------------------------------------------------------
CHAPTER_ID = "nanjing-first-release"
TITLE = "南京：第一次上线"
STATE_ORDER = ["office", "report", "incident", "investigation", "restored", "learning", "complete"]


def obj(id_, asset, label, tile, interaction, footprint, required, description):
    return {"id": id_, "assetId": asset, "label": label, "tile": list(tile),
            "interactionTile": list(interaction), "footprint": [list(t) for t in footprint],
            "required": required, "description": description}


OBJECTS = [
    obj("forum_pc", "obj-forum-pc", "我的工位电脑", (9, 3), (9, 4), [(9, 3)], True,
        "主线。office 中交互打开论坛，读用户无法登录的反馈，点“确认，去处理”进入 report（T01）；"
        "investigation 中再交互，重读论坛反馈，点“记下来”写入 feedback_reviewed（T04）。"),
    obj("trap_note", "obj-trap-note", "坑点注释", (11, 3), (11, 4), [(11, 3)], True,
        "主线（learning 的交互物件）。注释说明这里为什么有坑，不显示真实代码。交互后点“确认看过注释”"
        "写入 comment_reviewed（T10）。"),
    obj("test_notes", "obj-test-notes", "补测便签", (13, 3), (13, 4), [(13, 3)], True,
        "主线（learning 的交互物件）。记录补测试清单的便签，是叙事装置。交互后点“确认看过测试”"
        "写入 test_reviewed（T09）。"),
    obj("cto_pc", "obj-cto-pc", "CTO 工位电脑", (15, 3), (15, 4), [(15, 3)], True,
        "主线。incident 中与站在这里的 CTO 对话，点“一起过去”进入 investigation（T03）；investigation 中"
        "先读屏幕上的排查记录，点“记下来”写入 recheck_visited（T06），关上记录后读笔记本上的"
        "“这次影响到谁”，点“记下来”写入 impact_confirmed（T05）；三项齐全后再交互，才出现"
        "“这轮排查先到这里”，进入 restored（T07）。CTO 不移动、不占格，只换朝向。"),
    obj("manual_shelf", "obj-manual-shelf", "手册书架", (21, 3), (21, 4), [(21, 3)], True,
        "主线（learning／complete）。工作手册所在的矮书架，是游戏机制。两项确认齐全后交互，"
        "点“把这页写进手册”进入 complete（T11）；未齐时只显示“还没看完”。"),
    obj("bookshelf", "obj-bookshelf", "书架", (19, 3), (19, 4), [(19, 3), (20, 3)], False,
        "可选观察。地面占 2×1 格，交互点在 [19,4]；一句环境旁白，不指向事故。"),
    obj("window_plant", "obj-plant", "窗边绿植", (3, 12), (3, 13), [(3, 12)], False,
        "可选观察。一句旁白，不推进剧情。"),
    obj("coffee_mug", "obj-mug", "保温杯", (6, 12), (6, 13), [(6, 12)], False,
        "可选观察。一句旁白，不推进剧情。"),
]
BLOCKED = sorted({tuple(t) for o in OBJECTS for t in o["footprint"]})
OBJ = {o["id"]: o for o in OBJECTS}
SPAWN = (3, 14)
# CTO stays on one spot for the whole chapter; only his facing changes. It is not a collision tile.
CTO_TILE = (16, 2)


def region(role, x0, y0, x1, y1):
    return {(x, y): role for y in range(y0, y1 + 1) for x in range(x0, x1 + 1)}


ROLES = {}
# The 24×16 rectangle is the walkable boundary. Walls and windows are a background layer drawn
# above the rectangle and left of it; no wall tile exists inside the map.
ROLES.update(region("floor", 0, 0, 23, 15))
ROLES.update(region("rug", 8, 4, 10, 4))
ROLES.update(region("rug", 14, 4, 16, 4))
for o in OBJECTS:
    ROLES[tuple(o["tile"])] = o["id"]
TILES = [[ROLES[(x, y)] for x in range(24)] for y in range(16)]

# Facing the player needs when standing on each interaction tile (the object is one step ahead).
INTERACTION_DIR = {}
for _o in OBJECTS:
    # Facing = sign of (object tile - interaction tile): the object one step north (dy = -1) means
    # the player faces up. Every object here sits directly north of its interaction point.
    INTERACTION_DIR[_o["id"]] = {
        (0, -1): "up", (0, 1): "down", (-1, 0): "left", (1, 0): "right",
    }[(_o["tile"][0] - _o["interactionTile"][0], _o["tile"][1] - _o["interactionTile"][1])]
FACE_LABEL = {"up": "朝上", "down": "朝下", "left": "朝左", "right": "朝右"}

# The single pixel-index convention for feet and furniture bases (review-05). No other formula.
FOOT_RULE = "格 (x,y) 上的落点 = 格左上 + (8,15) = 世界逻辑像素 (16*x+8, 16*y+15)；精灵内脚底索引 [8,23]。"
FURNITURE_RULE = ("家具按 footprint 最下方一格的格索引 (x,y) 套同一个公式，落点 (16*x+8, 16*y+15)；"
                  "贴图内锚点 (宽÷2−1, 高−1)，贴图与锚点以落点为对齐点。")

OUTSIDE = {
    "rule": "0≤x≤23、0≤y≤15 的每一格都是可走地板、地毯或家具占格，地图矩形边界本身阻挡移动。"
            "办公室的上墙与窗是背景层，画在地图矩形上方的画布像素行 -16～-1，左墙画在画布 x<0；"
            "背景层不铺进 24×16 地图，也不写进 blockedTiles。地图内只有地板、地毯和家具。"}

ACTORS = [
    {"id": "player", "name": "我", "tile": list(SPAWN), "size": [16, 24], "anchor": [8, 23],
     "positionRule": "出生在门口 [3,14]。玩家移动由输入决定，剧情不瞬移玩家。格坐标与朝向不入档；"
                     "读档（或重玩）后由所在状态的入口位置摆放并朝向该对象的交互朝向（interactionDirs），"
                     "见 savePolicy.entryPlacement。"},
    {"id": "cto", "name": "CTO", "tile": list(CTO_TILE), "size": [16, 24], "anchor": [8, 23],
     "positionRule": "整章站在 [16,2]，不寻路、不移动、不占碰撞格、不阻挡玩家，也不在任何交互点上；"
                     "incident 之后朝向左下（面向 cto_pc），其余时间朝下。只切站立帧，不播行走。",
     "facing": {"incident_seen": "left-down（面向 cto_pc [15,3]）", "otherwise": "down"},
     "colleague": "旁白提到大家，但不出现同事立绘，不给具体分工。"},
]

# ---------------------------------------------------------------------------------------------
# Flags
# ---------------------------------------------------------------------------------------------
FLAG_ORDER = [
    "report_read", "incident_started", "incident_seen", "feedback_reviewed", "recheck_visited",
    "impact_confirmed", "outage_over", "comfort_read", "test_reviewed", "comment_reviewed",
    "manual_entry_written",
]
FLAG_LABEL = {
    "report_read": "论坛反馈已读", "incident_started": "呆住演示已发生",
    "incident_seen": "CTO 已带大家开始排查", "feedback_reviewed": "重读了论坛反馈并确认",
    "recheck_visited": "读过 CTO 电脑上的排查记录并确认", "impact_confirmed": "确认这次影响到真实用户",
    "outage_over": "两小时转场已过", "comfort_read": "宽慰已读完并收起", "test_reviewed": "补测试已确认",
    "comment_reviewed": "坑点注释已确认", "manual_entry_written": "手册已写入",
}


# ---------------------------------------------------------------------------------------------
# Transitions
# ---------------------------------------------------------------------------------------------
def tr(id_, from_, event, to, requires, effects, target, choice, label, dialogue, feedback):
    return {"id": id_, "from": from_, "event": event, "to": to, "requires": list(requires), "effects": list(effects),
            "target": target, "choice": choice, "label": label, "dialogue": dialogue,
            "playerFeedback": feedback, "effectMode": "add"}


INV_BASE = ["report_read", "incident_started", "incident_seen"]
RESTORE_REQ = INV_BASE + ["feedback_reviewed", "recheck_visited", "impact_confirmed"]
# T08 requires RESTORE_REQ + ["outage_over"] and writes comfort_read; requesting comfort_read again
# in its own requires would make learning unreachable (requires can only see pre-event flags).
LEARN_REQ = RESTORE_REQ + ["outage_over"]
# The storyline, in order. A transition with to == from is an in-state confirmation; it writes a
# flag, otherwise the second page of the same target would be a *-copy read page.
STORY = [
    tr("T01", from_="office", event="open_forum_post", to="report", requires=[], effects=["report_read"],
       target="forum_pc", choice="confirm", label="确认，去处理", dialogue="office-reaction",
       feedback="论坛面板里高亮“无法登录”；确认后进入 report。"),
    tr("T02", from_="report", event="read_feedback", to="incident", requires=["report_read"],
       effects=["incident_started"], target="dialog", choice="confirm", label="继续", dialogue="report-reaction",
       feedback="反应读完后，玩家仍在 [9,4]，进入 incident。"),
    tr("T03", from_="incident", event="cto_rallies_team", to="investigation",
       requires=["report_read", "incident_started"], effects=["incident_seen"], target="cto_pc",
       choice="confirm", label="一起过去", dialogue="incident-rally",
       feedback="任务条切到“排查 0/3”，可以自由走动。"),
    tr("T04", from_="investigation", event="confirm_feedback_reviewed", to="investigation",
       requires=INV_BASE, effects=["feedback_reviewed"], target="forum_pc", choice="confirm", label="记下来",
       dialogue="investigation-confirm-1", feedback="笔记本勾上“论坛反馈”，进度 +1。"),
    tr("T06", from_="investigation", event="confirm_recheck_visited", to="investigation",
       requires=INV_BASE, effects=["recheck_visited"], target="cto_pc", choice="confirm", label="记下来",
       dialogue="investigation-confirm-3", feedback="笔记本勾上“排查记录”，进度 +1。"),
    tr("T05", from_="investigation", event="confirm_impact_scope", to="investigation",
       requires=INV_BASE + ["recheck_visited"], effects=["impact_confirmed"], target="cto_pc",
       choice="confirm", label="记下来", dialogue="investigation-confirm-2",
       feedback="笔记本勾上“影响范围”，进度 +1。"),
    tr("T07", from_="investigation", event="resume_narrative", to="restored",
       requires=RESTORE_REQ, effects=["outage_over"],
       target="cto_pc", choice="confirm", label="这轮排查先到这里", dialogue="investigation-handoff",
       feedback="画面用离散色阶压暗，转场交代整整两小时。"),
    tr("T08", from_="restored", event="comfort_read", to="learning",
       requires=LEARN_REQ, effects=["comfort_read"], target="dialog", choice="confirm", label="收起",
       dialogue="restored-closing", feedback="宽慰收起，进入 learning，任务条“看过 0/2”。"),
    tr("T09", from_="learning", event="review_test_plan", to="learning", requires=LEARN_REQ,
       effects=["test_reviewed"], target="test_notes", choice="read", label="确认看过测试",
       dialogue="learning-test-copy", feedback="进度 +1；两项齐全后手册书架出现“把这页写进手册”。"),
    tr("T10", from_="learning", event="review_trap_comment", to="learning", requires=LEARN_REQ,
       effects=["comment_reviewed"], target="trap_note", choice="read", label="确认看过注释",
       dialogue="learning-comment-copy", feedback="进度 +1；两项齐全后手册书架出现“把这页写进手册”。"),
    tr("T11", from_="learning", event="write_manual_entry", to="complete",
       requires=LEARN_REQ + ["test_reviewed", "comment_reviewed"], effects=["manual_entry_written"],
       target="manual_shelf", choice="confirm", label="把这页写进手册", dialogue="learning-manual-1",
       feedback="手册打开新页，状态进入 complete。"),
]
# Non-advancing pages: one per transition, always listed; the confirm is listed only while
# confirmable() (requires hold and an effect is new), see options_for().
READS = {
    "T01": ("office-reopen", "重新打开论坛，帖子里还是那句“无法登录”。"),
    "T02": ("report-reaction", "反应已经读完了。"),
    "T03": ("incident-rally", "CTO 已经招呼大家过来了。"),
    "T04": ("investigation-feedback-copy", "论坛反馈已经记过了。"),
    "T05": ("investigation-cto-pc-first", "先把屏幕上的排查记录读完，再记影响范围。"),
    "T06": ("investigation-recheck-copy", "排查记录已经记过了。"),
    "T07": ("investigation-pending", "笔记本上还有没记下的，先把能确认的写完。"),
    "T08": ("restored-closing", "宽慰已经读完了。"),
    "T09": ("learning-test-copy", "测试清单已经看过了。"),
    "T10": ("learning-comment-copy", "注释已经看过了。"),
    "T11": ("learning-pending", "补测试和坑点注释还没都看完。"),
}
# Interaction targets get two pages: the confirming choice and the read page. The confirm is offered
# only while requires hold AND at least one effect is still new (confirmable()); once every effect is
# in flags the confirm is not shown at all and the read page is the only page (see options_for()).
OBJECT_TARGETS = ["forum_pc", "cto_pc", "test_notes", "trap_note", "manual_shelf"]
TRANSITIONS = []
for t in STORY:
    if t["target"] in OBJECT_TARGETS:
        copy_dialogue, _ = READS[t["id"]]
        t["options"] = [
            {"event": t["event"], "requires": t["requires"], "choice": t["choice"], "label": t["label"],
             "effects": t["effects"], "advance": True, "dialogue": t["dialogue"]},
            {"event": "copy__" + t["event"], "requires": [], "choice": "close",
             "label": "关闭" if t["to"] != t["from"] else "再看一眼", "effects": [], "advance": False},
        ]
        t["options"][1]["dialogue"] = copy_dialogue
        t["readPage"] = copy_dialogue

TRANSITIONS = STORY
PRODUCER = {f: t["id"] for t in TRANSITIONS for f in t["effects"]}

# LEGAL: every (state, flags) pair a stored snapshot may hold. It is not written down by hand; it is
# the node set of a small state machine over frozenset flags:
#   start = (entry, empty)  ->  every enabled transition  ->  (to, flags | effects)
# That is the same progression model check-design.py and the simulator use, so a snapshot with a
# flag no transition can produce (e.g. investigation + impact_confirmed without recheck_visited)
# is not in LEGAL and is rejected as corrupt. Computed from the progression below (see
# compute_legal()); the chapter-start snapshot is held to the same rule.
def compute_legal():
    nodes = {("office", frozenset())}
    queue = list(nodes)
    while queue:
        state, flags = queue.pop()
        for t in TRANSITIONS:
            if t["from"] != state or not set(t["requires"]) <= flags:
                continue
            node = (t["to"], flags | frozenset(t["effects"]))
            if node not in nodes:
                nodes.add(node)
                queue.append(node)
    return {s: sorted([[f for f in FLAG_ORDER if f in flags] for (st, flags) in nodes if st == s],
                      key=lambda c: (len(c), c)) for s in STATE_ORDER}


LEGAL = {}


def legal(state, flags):
    if state not in LEGAL:
        return False
    want = [f for f in FLAG_ORDER if f in set(flags)]
    return len(want) == len(set(flags)) and want in LEGAL[state]


TRANSITIONS_WITH_EFFECTS = [t for t in TRANSITIONS if t["event"] in PRODUCER.values()]
assert len(TRANSITIONS) == 11 and len(PRODUCER) == 11


# ---------------------------------------------------------------------------------------------
# The single save policy (review-04 §1, review-05). Everything else is generated from it.
# ---------------------------------------------------------------------------------------------
SAVE_POLICY = {
    "id": "atomic-per-event",
    "key": "career-rpg:nanjing:v1",
    "checkpoints": "all_states",
    "checkpointStates": list(STATE_ORDER),
    "snapshotShape": ["schema", "chapter", "state", "flags"],
    "acceptRule": "确认项显示／接受条件 = requires 全部满足，并且本次 effects 至少有一个尚未在 flags 里。"
                  "effects 已全在 flags 里时，该项只展示只读页：不接受、不写快照。"
                  "物件当前确认项只从满足该条件的项里取，已完成的项不占位，后面的未完成确认与只读页照常出现。",
    "chapterStart": {
        "state": "office",
        "flags": [],
        "tile": list(SPAWN),
        "writeWhen": "玩家开始本章（或重玩）时，在写入任何事件之前先写一次。",
    },
    "acceptedEvent": "被接受的确认项才写：先 state = 转移的 to，再 flags = 旧 flags ∪ 选项 effects（并集，不删任何标记），"
                     "最后把 {schema, chapter, state, flags} 作为同一个 JSON 值一次写入；一次事件只写一次，"
                     "snapshot.state 就是写完后的当前状态。",
    "ignored": "未接受的事件不改 state、不改 flags、不写入任何快照：只读页与关闭；requires 不满足；"
               "effects 已全部在 flags 里（已在 investigation 或 learning 写过同一标记后的再次确认，只显示该项只读页）；"
               "交互点或朝向不对。",
    "restore": "读档只读这一个快照，按 snapshot.state 与 snapshot.flags 原样恢复（exact snapshot）；"
               "state 与 flags 必须构成该状态的一个合法快照才算有效，不另存旧检查点状态，也不迁移旧格式。",
    "replay": "恢复后按 entryPlacement 把玩家摆到该状态入口格，并重播该状态的页面内短演出（见 replayLines："
              "论坛开场、反应、呆住与 CTO 招呼、排查开场、宽慰）；重播里每句仍要玩家确认，不自动推进状态、"
              "不自动写快照。对象页只在玩家走到交互点时由玩家交互打开，恢复后不自动弹出。",
    "invalid": "state 不在七个状态内、flags 不是该状态的合法组合、schema 或 chapter 不符、JSON 损坏、"
               "或存储写入失败：不迁移也不修补，按损坏存档处理，提供“重新开始”（写 chapter_start 快照）"
               "或“本次继续，不保存”（本会话可玩，重新载入即回到损坏提示）。第一版没有既有用户存档，不写任何迁移代码。",
    "entryPlacement": {
        "office": list(SPAWN), "report": list(OBJ["forum_pc"]["interactionTile"]),
        "incident": list(OBJ["forum_pc"]["interactionTile"]), "investigation": list(OBJ["cto_pc"]["interactionTile"]),
        "restored": list(OBJ["cto_pc"]["interactionTile"]), "learning": list(OBJ["cto_pc"]["interactionTile"]),
        "complete": list(OBJ["manual_shelf"]["interactionTile"]),
    },
    "replayLines": {
        "office": ["office-n1"], "report": ["report-reaction"],
        "incident": ["incident-freeze", "incident-cto-1", "incident-rally"],
        "investigation": ["investigation-n1", "investigation-cto-prompt"],
        "restored": ["restored-n1", "restored-cto-1", "restored-colleague-1", "restored-n3", "restored-player-1",
                     "restored-closing"],
        "learning": ["learning-n1", "learning-cto-1"], "complete": ["complete-n1"],
    },
}
assert set(SAVE_POLICY["entryPlacement"]) == set(STATE_ORDER)
LEGAL.update(compute_legal())
# ENTER = flags every reachable configuration of a state carries (intersection over LEGAL), i.e. the
# marks inherited from earlier states plus the state's own entry effect, not just the last edge's
# requires/effects. T08 writes comfort_read when entering learning, so complete inherits it too.
ENTER = {s: [f for f in FLAG_ORDER if all(f in combo for combo in LEGAL[s])] for s in STATE_ORDER}
assert ENTER["office"] == []
_start = SAVE_POLICY["chapterStart"]
assert _start["flags"] in LEGAL[_start["state"]], "chapter_start snapshot is not legal"
assert len(LEGAL["investigation"]) == 6 and len(LEGAL["learning"]) == 4 and len(LEGAL["complete"]) == 1
assert set(SAVE_POLICY["replayLines"]) == set(STATE_ORDER)


def place_text(tile):
    return f"[{tile[0]},{tile[1]}]"


def fmt_flags(flags):
    return "[" + ", ".join(f for f in FLAG_ORDER if f in set(flags)) + "]"


def event_snapshots():
    """One row per event that writes: T01…T11 (dialog events and in-state confirms included)."""
    rows = []
    for t in STORY:
        base = set(ENTER[t["from"]]) if t["from"] != "office" else set()
        rows.append({"event": t["event"], "id": t["id"], "from": t["from"], "to": t["to"],
                     "state": t["to"], "flags": ENTER[t["to"]] if t["to"] != t["from"] else
                     sorted(base | {t["effects"][0]}, key=FLAG_ORDER.index),
                     "holds": [f for f in t["requires"] if t["to"] != t["from"]],
                     "placement": SAVE_POLICY["entryPlacement"][t["to"]]})
    return rows


def restore_examples():
    """Refresh / reload examples, one per state and per investigation & learning combination."""
    out = []
    out.append({"case": "chapter_start", "state": "office", "flags": [],
                "placement": SAVE_POLICY["entryPlacement"]["office"],
                "after": "玩家在出生点 [3,14]，论坛未读；走到 [9,4] 才可做 open_forum_post。"})
    out.append({"case": "report", "state": "report", "flags": ENTER["report"],
                "placement": SAVE_POLICY["entryPlacement"]["report"],
                "after": "读回 report，重播 office-n3、report-reaction，点“继续”做 read_feedback。"})
    out.append({"case": "incident", "state": "incident", "flags": ENTER["incident"],
                "placement": SAVE_POLICY["entryPlacement"]["incident"],
                "after": "读回 incident，重播呆住与 CTO 招呼，走到 [15,4] 做 cto_rallies_team。"})
    inv_marks = ["feedback_reviewed", "recheck_visited", "impact_confirmed"]
    inv_target = {"feedback_reviewed": OBJ["forum_pc"]["label"], "recheck_visited": OBJ["cto_pc"]["label"],
                  "impact_confirmed": OBJ["cto_pc"]["label"]}
    for combo in LEGAL["investigation"]:
        flags = set(combo)
        missing = [m for m in inv_marks if m not in combo]
        if not missing:
            after = "重播排查开场；三项齐全，cto_pc 出现“这轮排查先到这里”，做 resume_narrative。"
        elif len(missing) == 3:
            after = "重播排查开场；三项都还没记，分别去 forum_pc 做 confirm_feedback_reviewed、去 cto_pc " \
                    "先做 confirm_recheck_visited 再做 confirm_impact_scope。"
        else:
            after = ("重播排查开场；已记的 " + "、".join(m for m in inv_marks if m in combo)
                     + " 只在对应物件上显示只读页；" + "、".join(f"{m}（{inv_target[m]}）" for m in missing)
                     + " 照常可做。")
        out.append({"case": "investigation", "state": "investigation",
                    "flags": [f for f in FLAG_ORDER if f in flags],
                    "placement": SAVE_POLICY["entryPlacement"]["investigation"], "after": after})
    out.append({"case": "restored", "state": "restored", "flags": ENTER["restored"],
                "placement": SAVE_POLICY["entryPlacement"]["restored"],
                "after": "读回 restored，重播宽慰，点“收起”做 comfort_read。"})
    learn_marks = ["test_reviewed", "comment_reviewed"]
    learn_target = {"test_reviewed": OBJ["test_notes"]["label"], "comment_reviewed": OBJ["trap_note"]["label"]}
    for combo in LEGAL["learning"]:
        flags = set(combo)
        missing = [m for m in learn_marks if m not in combo]
        if not missing:
            after = "重播 learning 开场；两项齐全，manual_shelf 出现“把这页写进手册”，做 write_manual_entry。"
        elif len(missing) == 2:
            after = "重播 learning 开场；两项都还没看，去 test_notes 做 review_test_plan、去 trap_note 做 " \
                    "review_trap_comment，manual_shelf 只显示“还没看完”。"
        else:
            after = ("重播 learning 开场；已记的 " + "、".join(m for m in learn_marks if m in combo)
                     + " 只在对应物件上显示只读页；" + "、".join(f"{m}（{learn_target[m]}）" for m in missing)
                     + " 照常可做，manual_shelf 只显示“还没看完”。")
        out.append({"case": "learning", "state": "learning", "flags": [f for f in FLAG_ORDER if f in flags],
                    "placement": SAVE_POLICY["entryPlacement"]["learning"], "after": after})
    out.append({"case": "complete", "state": "complete", "flags": ENTER["complete"],
                "placement": SAVE_POLICY["entryPlacement"]["complete"],
                "after": "读回 complete，停在完成页，可结束或重玩。"})
    return out


# Storyboard texts. The save lines are NOT written here; they are rendered from
# SAVE_POLICY + event_snapshots() so they cannot describe a different policy.
STATE_TEXT = {
    "office": {
        "title": "办公室", "budget": 25,
        "goal": "从门口走到自己的工位，打开论坛，看清用户说无法登录的反馈。",
        "playerAction": "走到 forum_pc 的交互点 [9,4]，朝上，按 E／空格（手机点 A 按钮或点提示），读帖后点“确认，去处理”。"
                        "路上可以顺手看书架、绿植和保温杯。",
        "feedback": "论坛面板出现，高亮“无法登录”；确认后屏幕上是这句话，进入 report。",
        "repeat": "进入 office 只有 chapter_start 一个快照，flags 为空；同一次浏览里反复关闭再打开论坛只重播 office-reopen，"
                  "不写标记。",
        "end": "在 forum_pc 点“确认，去处理”（T01，写 report_read），进入 report。",
    },
    "report": {
        "title": "读到反馈", "budget": 15,
        "goal": "停在屏幕前，意识到这是我第一次面对真实的线上 C 端用户。",
        "playerAction": "进入时玩家仍在 [9,4]，移动锁定，旁白与内心独白依次出现；读完点“继续”。",
        "feedback": "任务提示改为“先稳住”；这一句不自动进入下一状态。",
        "repeat": "同一点击只推进一步，不会连带事件；反应会在恢复时重播，但 read_feedback 只在点“继续”时被接受一次，之后不再出现确认项。",
        "end": "点“继续”（T02，写 incident_started），进入 incident。",
    },
    "incident": {
        "title": "呆住", "budget": 25,
        "goal": "先让“呆住”发生，再由 CTO 带大家排查。",
        "playerAction": "进入时玩家在 [9,4]，约 1.5 秒移动锁定、镜头停在登录示意上，我保持站立（跳过键立即显示 incident-freeze）。"
                        "随后 CTO 开口；走到 cto_pc 交互点 [15,4]，朝上，交互读对话并点“一起过去”。",
        "feedback": "登录示意只表现页面交不出结果，不显示真实报错、日志或“按钮没反应”；CTO 朝向左下，之后可自由走动。",
        "repeat": "呆住与 CTO 招呼是进入后的重播演出，可跳过，不写标记；走到 cto_pc 读到的对话以“一起过去”结尾，cto_rallies_team 只接受一次。",
        "end": "cto_pc 对话读完并点“一起过去”（T03，写 incident_seen），进入 investigation。",
    },
    "investigation": {
        "title": "一起排查", "budget": 45,
        "goal": "在 CTO 带大家排查时，做三件我能确认的事：重读论坛反馈、读 CTO 电脑上的排查记录、确认这次影响到谁。不猜根因。",
        "playerAction": "a. forum_pc [9,4]：重读反馈，点“记下来”（T04，feedback_reviewed）；"
                        "b. cto_pc [15,4]：读屏幕上的排查记录，点“记下来”（T06，recheck_visited）；"
                        "c. cto_pc [15,4]：关上记录后读笔记本“这次影响到谁”，点“记下来”（T05，impact_confirmed）。"
                        "论坛反馈和排查记录可先后任意；影响范围要在排查记录之后。三步都可来回。",
        "feedback": "任务条“排查 0/3→3/3”；三项齐全后 cto_pc 才出现“这轮排查先到这里”。点击只表示“我去看了并记下来”，"
                    "不代表修好了线上问题。",
        "repeat": "T05 要求 recheck_visited 先于它，否则显示 investigation-cto-pc-first；已确认项再交互只显示该项只读页"
                  "（*-copy），不显示“记下来”，不加标记、不写快照。cto_pc 的当前确认项跳过已完成的 T06，"
                  "所以 T06 记完后立刻出现 T05，三项齐全后出现 T07；只读页不挡后面的未完成确认。",
        "end": "三项标记齐全后，在 cto_pc 点“这轮排查先到这里”（T07，写 outage_over），进入 restored。",
    },
    "restored": {
        "title": "两小时后", "budget": 25,
        "goal": "接受“整整两小时后、问题恢复”的转场，读 CTO、老板、同事的宽慰。",
        "playerAction": "转场中不移动，点“继续”或跳过键逐句出示旁白与宽慰；最后在对话框上点“收起”。",
        "feedback": "画面以离散蓝灰两档压暗，显示“整整两小时后”；恢复用叙事交代，不把任何点击当成修复了线上问题。",
        "repeat": "回到 restored 会从头重播宽慰；每句单独确认，点“收起”只触发 comfort_read 一件事。",
        "end": "点“收起”（T08，写 comfort_read），进入 learning。",
    },
    "learning": {
        "title": "补测试与注释", "budget": 35,
        "goal": "亲眼看补测试和坑点注释，再把经验写进工作手册。",
        "playerAction": "test_notes [13,4] 交互并点“确认看过测试”（T09）；trap_note [11,4] 交互并点“确认看过注释”（T10）；"
                        "顺序任意、可来回。两项齐全后到 manual_shelf [21,4] 交互并点“把这页写进手册”（T11）。",
        "feedback": "任务条“看过 0/2→2/2”；手册打开新页（learning-manual-1），状态进入 complete。",
        "repeat": "T09／T10 只在首次确认时写标记；再交互只显示该项只读页（learning-test-copy／learning-comment-copy），"
                  "不加标记、不写快照，也不挡住另一项的确认。",
        "end": "test_reviewed 与 comment_reviewed 都写入后，在 manual_shelf 点“把这页写进手册”（T11，requires 同时包含两者），"
               "进入 complete。",
    },
    "complete": {
        "title": "手册新增一页", "budget": 10,
        "goal": "翻看本章手册页，结束或重玩。",
        "playerAction": "读手册页，选“结束本章”（收起手册，显示完成摘要）或“从办公室重玩”（再确认一次）。探视手册以外的物件不再触发事件，complete 的合法快照只有这一个。",
        "feedback": "显示“第一章完成”、本章事实与演出说明、回博客链接与重玩入口。",
        "repeat": "刷新或重进都读回 complete 的同一个快照，停在完成页，不再接受任何事件；"
                  "重玩只清除本游戏命名空间下的本章存档。",
        "end": "终态。重玩是另一个入口，不经过状态转移，也不写任何事件。",
    },
}


def save_lines(sid):
    """Storyboard save text for one state, rendered from SAVE_POLICY only."""
    place = place_text(SAVE_POLICY["entryPlacement"][sid])
    if sid == "office":
        head = (f"chapter_start 写 {{office, []}}，入口 {place}。office 只有这一个合法快照；"
                "带任何标记的 office 快照都按 invalid 处理。")
    else:
        incoming = next(t for t in STORY if t["to"] == sid)
        head = (f"T{incoming['id'][1:]} `{incoming['event']}` 写 {{state:{sid}, flags:{fmt_flags(ENTER[sid])}}}"
                f"（effects 含 `{incoming['effects'][0]}`），入口 {place}。")
    ins = [t for t in STORY if t["from"] == sid and t["to"] == sid]
    if ins:
        head += ("进入后 " + "／".join(f"`{t['event']}`（{t['effects'][0]}）" for t in ins)
                 + " 每被接受一次再写一次 {state:" + sid + ", flags:当前并集}；")
        head += "恢复后重播 " + "/".join(f"`{d}`" for d in SAVE_POLICY["replayLines"][sid]) + "。"
    else:
        head += ("恢复后重播 " + "/".join(f"`{d}`" for d in SAVE_POLICY["replayLines"][sid])
                 + ("；每句要玩家确认，不自动推进。" if sid != "complete" else "，停在完成页。"))
    return head


STATES = [{"id": sid, "title": STATE_TEXT[sid]["title"], "budgetSeconds": STATE_TEXT[sid]["budget"],
           "goal": STATE_TEXT[sid]["goal"], "playerAction": STATE_TEXT[sid]["playerAction"],
           "enterFlags": ENTER[sid], "endCondition": STATE_TEXT[sid]["end"],
           "feedback": STATE_TEXT[sid]["feedback"], "repeatRule": STATE_TEXT[sid]["repeat"],
           "checkpoint": True, "snapshot": SAVE_POLICY["id"],
           "resumeRule": save_lines(sid),
           "entryPlacement": SAVE_POLICY["entryPlacement"][sid]}
          for sid in STATE_ORDER]
assert all(s["checkpoint"] is True for s in STATES) and len(STATES) == 7

# The save table must reproduce every legal snapshot exactly: entry snapshot from the incoming
# effect, then each in-state mark added to the running union of that state.
assert all([f for f in FLAG_ORDER if f in ENTER[s]] == LEGAL[s][0] for s in STATE_ORDER), \
    "entry snapshot != guaranteed flags"
assert ENTER["investigation"] == INV_BASE and "comfort_read" in ENTER["complete"]
assert ENTER["complete"] == LEGAL["complete"][0]
assert [list(c) for c in LEGAL["office"]] == [SAVE_POLICY["chapterStart"]["flags"]]
assert len(LEGAL["investigation"]) == 6 and len(LEGAL["learning"]) == 4
assert len(LEGAL["complete"]) == 1 and len(LEGAL["restored"]) == 1

# ---------------------------------------------------------------------------------------------
# Dialogue. basis: fact_paraphrase = paraphrased supplied fact; staging = staging, UI, manual or
# imagined speech. No production notes in visible text; they go to the "note" field.
# ---------------------------------------------------------------------------------------------
DIALOGUES = []


def line(id_, state, speaker, basis, text, note=None):
    item = {"id": id_, "state": state, "speaker": speaker, "basis": basis, "text": text}
    if note:
        item["note"] = note
    DIALOGUES.append(item)


line("office-n1", "office", "narrator", "staging", "南京的办公室，下午。屋里安静，只有键盘声。",
     "场景演出，不代表当时的陈设。")
line("office-first-pc-1", "office", "player", "staging", "（打开论坛，看看怎么回事。）")
line("office-n3", "office", "narrator", "fact_paraphrase",
     "论坛里，有用户说无法登录。这是我第一次面对真实的线上 C 端用户。",
     "事实：用户在论坛反馈无法登录；这是作者第一次面对真实线上 C 端用户。论坛面板为演出。")
line("office-reaction", "office", "player", "staging", "（以前只在书上读过“线上用户”，现在他们就在这条帖子里。）")
line("office-reopen", "office", "narrator", "staging", "重新打开论坛，帖子里还是那句“无法登录”。")

line("report-reaction", "report", "narrator", "fact_paraphrase",
     "屏幕上的反馈还在。这是我第一次面对真实的线上 C 端用户。", "事实转述，演出暂停。")
line("report-player-1", "report", "player", "staging", "（……）")

line("incident-freeze", "incident", "narrator", "fact_paraphrase", "我盯着登录框，一动没动。",
     "事实：作者第一反应是呆住。登录示意不是技术复现，不显示报错、日志或按钮状态。")
line("incident-cto-1", "incident", "cto", "staging", "都过来，一起看看。别急，先弄清楚发生了什么。",
     "CTO 台词为演出草稿，不是原话。")
line("incident-rally", "incident", "narrator", "fact_paraphrase", "CTO 带着大家一起排查。",
     "事实：CTO 带大家排查；具体分工未确认，不出现。")

line("investigation-n1", "investigation", "narrator", "staging",
     "先做我能确认的事：再读一遍反馈，看看 CTO 电脑上的记录，记下这次影响到谁。")
line("investigation-cto-prompt", "investigation", "cto", "staging", "你那边也看看，我们一起来。")
line("investigation-confirm-1", "investigation", "narrator", "staging", "反馈上写的还是“无法登录”。我把这句记下来。")
line("investigation-feedback-copy", "investigation", "narrator", "staging", "论坛反馈已经记过了。")
line("investigation-cto-pc-first", "investigation", "player", "staging", "（先看 CTO 电脑上的排查记录。）")
line("investigation-confirm-3", "investigation", "narrator", "staging",
     "屏幕上是这段时间排查用的记录。我把这页抄进笔记本，没有急着下结论。",
     "记录内容为演出装置：不含真实报错、日志、根因。")
line("investigation-recheck-copy", "investigation", "narrator", "staging", "排查记录已经记过了。")
line("investigation-confirm-2", "investigation", "narrator", "fact_paraphrase", "笔记本上写着：这次影响到的是真实用户。",
     "事实范围只到“真实用户受到影响”，不写人数和具体症状。")
line("investigation-impact-copy", "investigation", "narrator", "staging", "影响范围已经记过了。")
line("investigation-pending", "investigation", "narrator", "staging", "笔记本上还有没记下的，先把能确认的写完。")
line("investigation-handoff", "investigation", "cto", "staging", "先到这里，大家都还在看。你去旁边缓一缓。")

line("restored-n1", "restored", "narrator", "fact_paraphrase", "画面压暗。整整两小时后，问题恢复了。",
     "事实：登录框故障整整两小时。转场为演出，不做真实等待。")
line("restored-cto-1", "restored", "cto", "staging", "好了，没事了，别太自责。", "演出草稿。")
line("restored-colleague-1", "restored", "colleague", "staging", "没关系，大家都经历过。",
     "作者回忆中的安慰大意；同事台词为演出草稿。")
line("restored-n3", "restored", "narrator", "fact_paraphrase",
     "CTO、老板、同事都过来安慰我，告诉我没关系，大家都经历过。", "事实转述。")
line("restored-player-1", "restored", "player", "staging", "（我点点头。）")
line("restored-closing", "restored", "narrator", "staging", "这一页，先留在这里。")

line("learning-n1", "learning", "narrator", "fact_paraphrase",
     "后来，我们补了测试，也补了注释，说明这里为什么会踩坑。", "事实：补测试、注释说明为什么有坑。")
line("learning-test-first", "learning", "narrator", "staging", "便签上列着这次补的测试。")
line("learning-cto-1", "learning", "cto", "staging", "这两处你都看看，以后心里有数。", "演出草稿。")
line("learning-test-copy", "learning", "narrator", "staging", "测试清单已经看过了。")
line("learning-comment-first", "learning", "narrator", "staging", "代码旁多了一段注释：这里是陷阱，以后改这里的人要当心。",
     "注释以卡片和色块表现，不显示真实代码。")
line("learning-comment-copy", "learning", "narrator", "staging", "注释已经看过了。")
line("learning-pending", "learning", "narrator", "staging", "补测试和坑点注释还没都看完。")
line("learning-manual-1", "learning", "narrator", "staging",
     "工作手册翻到新的一页：“第一次上线，是真实用户先告诉我出了问题。补测试，写清楚坑；出了事，大家会一起扛。”",
     "工作手册是游戏机制，不是确认的历史行为。")

line("complete-n1", "complete", "narrator", "staging", "本章到此结束。")
line("complete-n2", "complete", "player", "staging", "（往后回家读书、学前端，是另一段了。）",
     "夜读与事故的因果关系未确认。")

OBSERVE = {
    "bookshelf": ("observe-bookshelf", "书架上摆着几本翻旧的书，其中一本夹着一张便签。"),
    "window_plant": ("observe-plant", "窗边有一盆绿植，叶子擦得很干净。"),
    "coffee_mug": ("observe-mug", "桌上放着一个保温杯，杯盖没拧紧。"),
}
for _oid, (_did, _text) in OBSERVE.items():
    line(_did, "office", "narrator", "staging", _text,
         "可选观察的环境旁白。物件是游戏演出，不表示当时的陈设；只在 office 与 complete 的走动阶段交互，不写标记。")

DIALOGUE_LINKS = {
    "T01": ["office-n1", "office-first-pc-1", "office-n3", "office-reaction", "office-reopen"],
    "T02": ["report-reaction", "report-player-1"],
    "T03": ["incident-freeze", "incident-cto-1", "incident-rally"],
    "T04": ["investigation-n1", "investigation-cto-prompt", "investigation-confirm-1",
            "investigation-feedback-copy"],
    "T05": ["investigation-cto-pc-first", "investigation-confirm-2", "investigation-impact-copy"],
    "T06": ["investigation-confirm-3", "investigation-recheck-copy"],
    "T07": ["investigation-pending", "investigation-handoff"],
    "T08": ["restored-n1", "restored-cto-1", "restored-colleague-1", "restored-n3",
            "restored-player-1", "restored-closing"],
    "T09": ["learning-n1", "learning-cto-1", "learning-test-first", "learning-test-copy"],
    "T10": ["learning-comment-first", "learning-comment-copy"],
    "T11": ["learning-manual-1", "complete-n1", "complete-n2", "learning-pending"],
    "observe": [did for did, _ in OBSERVE.values()],
}
ORDER = {s["id"]: i for i, s in enumerate(STATES)}
DIALOGUES.sort(key=lambda d: ORDER[d["state"]])
_DLG = {d["id"]: d for d in DIALOGUES}
for _ids in SAVE_POLICY["replayLines"].values():
    for _d in _ids:
        assert _d in _DLG, "replay line missing: " + _d
# The replay examples in section seven quote office-n3 / report-reaction in the report scene; keep
# the report snapshot replay honest by listing them from the same table.

# ---------------------------------------------------------------------------------------------
# Assets
# ---------------------------------------------------------------------------------------------
PALETTE = [
    ["warm_white", "#faf8f3"], ["ink", "#292825"], ["stone", "#77746e"], ["cinnabar", "#a64335"],
    ["wood_dark", "#6b4a32"], ["wood_light", "#a87c55"], ["brick_gray", "#8d8a83"],
    ["grass_green", "#6f8f5a"], ["blue_gray", "#5d6e7a"], ["night_blue", "#2f3a45"],
    ["window_light", "#e8dfc8"], ["warm_light", "#e9c27a"],
]
ASSETS = []


def sa(id_, kind, size, description, **extra):
    ASSETS.append({"id": id_, "kind": kind, "size": list(size), "description": description, **extra})


def au(id_, duration_ms, description, loop=False):
    item = {"id": id_, "kind": "audio", "durationMs": duration_ms, "description": description}
    if loop:
        item["loop"] = True
    ASSETS.append(item)


sa("player-walk", "sprite", (16, 24),
   "主角“我”（设定：黑发、朱砂红上衣、深色裤子，不代表真人外貌）。四向行走，每向 4 帧（站立、左迈、站立、右迈），"
   "行序 down、up、left、right；每帧 16×24，脚底索引 [8,23]；整图 64×96。行走不阻挡他人。",
   frameSize=[16, 24], sheetSize=[64, 96], frames=16,
   sheet={"columns": 4, "rows": 4, "rowsOrder": ["down", "up", "left", "right"], "fps": 8, "anchor": [8, 23]})
sa("npc-cto", "sprite", (16, 24),
   "CTO（设定：深灰外套、圆眼镜，不还原真人）。四向站立各 1 帧，不做行走；每帧 16×24，脚底索引 [8,23]；"
   "整图 16×96。不阻挡他人。", frameSize=[16, 24], sheetSize=[16, 96], frames=4,
   sheet={"columns": 1, "rows": 4, "rowsOrder": ["down", "up", "left", "right"], "anchor": [8, 23]})
# Visual pixel box (size) and ground footprint (grid cells) are separate. Every tile in a
# footprint is drawn: the footprint's top-left cell carries the footprintExtent marker.
FURNITURE = [
    ("obj-forum-pc", (40, 32), "我的工位电脑显示器。贴图像素 40×32，视觉比一格宽、向上伸出约一格；地面碰撞只占 [9,3]。"),
    ("obj-cto-pc", (40, 32), "CTO 工位电脑显示器。贴图像素 40×32，视觉比一格宽、向上伸出约一格；地面碰撞只占 [15,3]。"),
    ("obj-test-notes", (24, 12), "桌上的补测便签。贴图像素 24×12，视觉比一格宽、比一格矮；地面碰撞只占 [13,3]。"),
    ("obj-trap-note", (24, 32), "桌上立着的注释卡片，只有色块线条，不写可读代码；贴图像素 24×32；地面碰撞只占 [11,3]。"),
    ("obj-bookshelf", (32, 48), "书架，宽 2 格、高 3 格的正面贴图。贴图像素 32×48；地面占 [19,3]、[20,3] 两格。"),
    ("obj-manual-shelf", (24, 40), "放工作手册的矮书架。贴图像素 24×40；地面碰撞只占 [21,3]。"),
    ("obj-plant", (24, 28), "窗边绿植。贴图像素 24×28；地面碰撞只占 [3,12]。"),
    ("obj-mug", (12, 12), "桌上的保温杯。贴图像素 12×12；地面碰撞只占 [6,12]。"),
]
for oid, size, desc in FURNITURE:
    o = next(x for x in OBJECTS if x["assetId"] == oid)
    fp_x = min(t[0] for t in o["footprint"])
    fp_y = max(t[1] for t in o["footprint"])
    width_tiles = max(t[0] for t in o["footprint"]) - fp_x + 1
    # A footprint must be covered by its own picture; a picture wider than its footprint may only
    # overlap free space, so multi-cell furniture is sized exactly.
    if width_tiles > 1:
        assert size[0] == 16 * width_tiles, f"{oid}: 2-cell furniture must be exactly 2 tiles wide"
    sa(oid, "sprite", size, desc, groundFootprint=o["footprint"], interactTile=o["interactionTile"],
       footprintExtent={"widthTiles": width_tiles, "heightTiles": 1},
       anchorTile=[fp_x, fp_y], anchorX=size[0] // 2 - 1, anchorY=size[1] - 1)
sa("tile-floor-wood", "tile", (16, 16), "木地板，4 个细微噪点变体，整图 64×16（4×1 排布）。", variants=4, sheetSize=[64, 16])
sa("tile-rug", "tile", (16, 16), "工位地毯，与木地板同尺寸。")
sa("tile-wall", "tile", (16, 32), "背景墙与踢脚线：只画在地图矩形上方的画布像素行 -16～-1，不铺进 24×16 地图，不参与碰撞。")
sa("tile-window", "tile", (16, 32), "窗：叠在上墙背景层的画布 x=80～143，属背景层，不参与碰撞。")
sa("tile-outage-dim", "tile", (16, 16), "两小时转场用离散蓝灰叠加，分两档，不做渐变模糊。")
sa("ui-dialog-box", "ui", (240, 64), "对话框底框，暖白、细边框、朱砂姓名签；文字用 DOM。")
sa("ui-forum-panel", "ui", (216, 120), "论坛面板（DOM）：标题、“无法登录”高亮、返回按钮；不出现真实用户名、日期、截图。")
sa("ui-notebook", "ui", (120, 80), "排查笔记本（DOM）：三项确认勾选，勾选时有短高亮。")
sa("ui-evidence-card", "ui", (120, 96), "补测便签与坑点注释的读取卡片（DOM）：只放文字与色块线条，不显示真实代码。")
sa("ui-manual-page", "ui", (216, 136), "工作手册页（DOM 排版），新页文字见 learning-manual-1。")
sa("ui-hud-task", "ui", (160, 16), "任务提示条（DOM），显示“排查 1/3”“看过 1/2”，只用文字。")
sa("ui-choice-button", "ui", (96, 24), "选项按钮底板，CSS 放大后触控区 ≥44 CSS px。")
sa("ui-mobile-controls", "ui", (96, 96), "手机方向键与 A 按钮，触控热区 ≥44 CSS px。")
sa("ui-pause-menu", "ui", (160, 88), "暂停菜单（DOM）：继续、查看手册、重玩、声音开关。")
sa("ui-complete-card", "ui", (216, 120), "章节完成摘要（DOM）：第一章完成、事实与演出说明、回博客链接、重玩。")
au("audio-ui-click", 60, "确认音，木质短点击。")
au("audio-ui-move", 40, "光标移动音。")
au("audio-notebook-tick", 120, "勾选音。")
au("audio-manual-page", 300, "手册翻页声。")
au("audio-open-forum", 220, "打开论坛面板的轻响。")
au("audio-step", 150, "一步脚步，木地板与地毯各一版。")
au("audio-transition-dim", 400, "两小时转场压暗时的一声低音，不持续。")
au("audio-ambient-office", 1500, "办公室环境底噪（键盘、椅轮），循环播放；用户开启声音后才播放。", loop=True)

# ---------------------------------------------------------------------------------------------
# Runtime rules that are not part of the save policy
# ---------------------------------------------------------------------------------------------
RUNTIME_RULES = {
    "interaction": {
        "definitions": "每个对象有三个位置：本体 tile（家具所在格，在 footprint 内，玩家站不上去）、"
                       "交互点 interactionTile（玩家应站的格，与本体相邻、不在 footprint 内）、"
                       "视觉包围（贴图像素，可以比一格宽或高）。",
        "triggerRule": "玩家所在格 == interactionTile，且朝向 == interactionDirs[id]（本体在交互点正上方则朝上，其余同理），"
                       "按 E／空格或点提示／A 按钮才触发；朝向不对时第一次按键只转身。",
        "notTrigger": "站在 [9,2] 朝下看 forum_pc、或站在 [20,4] 看两格宽书架，都不在交互点上，不触发。",
        "highlight": "同一行有多个交互点时，只高亮离玩家最近的交互点，距离相同按格坐标排序；触发仍须满足上面的规则。",
        "touch": "触屏点提示只在玩家已站在交互点且朝向正确时触发；不自动寻路，不隔空触发。",
    },
    "actors": "演员（玩家与 CTO）不是碰撞体：碰撞只认 blockedTiles 与地图矩形，演员重叠不阻挡、不推挤。"
              "对话与转场锁定输入时，演员停在剧情指定位置，锁定解除后直接恢复控制。",
    "events": "当前状态的可交互对象按 TRANSITIONS 顺序列出选项。确认项显示／接受条件 = requires 全部满足，并且本次 effects "
              "至少有一个尚未在 flags 里；不满足该条件的项只显示只读页。接受一个确认项 = state 变为 to、effects 并入 flags，"
              "并按 savePolicy 写完整快照；同一对象同一时刻只有一个当前确认项，已完成的项不占位、不挡住其后的 T05／T07，"
              "也不会顺带触发下一状态。没有满足条件的确认项时只显示只读页，不加标记、不写快照。",
    "pause": "对话、论坛、笔记本与转场期间锁定移动并清空按键；切后台或失焦立即暂停，恢复时不补跑累积时间。"
             "刷新后按 savePolicy.restore 读回同一个快照。",
    "skip": "跳过只压缩当前句、当前对话或当前转场的表达，不改变事件结果；以确认项结尾的对话"
                "（T01／T02／T03／T07／T08）被跳过时只把文字直接展开，确认项仍需玩家点一次，确认后照常写快照。",
}
RUNTIME_RULES["savePolicy"] = SAVE_POLICY

BLOCKED_DETAILS = [
    "事故根因、具体报错、代码和完整修复过程",
    "排查中每个人具体做了什么、具体技术分工",
    "换浏览器、改密码、群消息是否持续、先吃饭、哪条路径漏测是根因等历史细节",
    "老板原话、同事姓名外貌与逐字安慰措辞（旁白按作者回忆转述，CTO、同事台词是演出草稿）",
    "事故与随后深夜学习是否存在直接因果",
    "准确年份与日期",
    "工作手册是否在真实工作中存在（本章手册为游戏机制）",
    "作者是否认可美术方向（概念板未获认可，也不是生产素材）",
]

CHAPTER = {
    "id": CHAPTER_ID,
    "title": TITLE,
    "targetSeconds": [120, 180],
    "durationBasis": "设计预期 2～3 分钟（状态预算合计 180 秒），未实测。",
    "entry": "office",
    "terminal": "complete",
    "savePolicy": SAVE_POLICY,
    "map": {
        "width": 24,
        "height": 16,
        "origin": "左上角为 (0,0)；x 向右，y 向下，单位为整数格。",
        "pixelRule": FOOT_RULE + " " + FURNITURE_RULE,
        "spawn": list(SPAWN),
        "blockedTiles": [list(t) for t in BLOCKED],
        "outsideTiles": OUTSIDE,
        "tiles": TILES,
        "objects": OBJECTS,
    },
    "actors": ACTORS,
    "states": STATES,
    "transitions": TRANSITIONS,
    "legalSnapshots": LEGAL,
    "dialogueLinks": DIALOGUE_LINKS,
    "dialogues": DIALOGUES,
    "assets": ASSETS,
    "interactionDirs": INTERACTION_DIR,
    "runtimeRules": RUNTIME_RULES,
    "basisLegend": {
        "fact_paraphrase": "按作者提供事实转述，不作逐字记录。",
        "staging": "演出、界面、人物动作、手册或游戏机制草稿，不是确认的历史。",
    },
    "palette": PALETTE,
    "blockedHistoricalDetails": BLOCKED_DETAILS,
}


# ---------------------------------------------------------------------------------------------
# Extra structural self-checks (beyond scripts/check-design.py)
# ---------------------------------------------------------------------------------------------
def validate_extra(ch):
    errors = []
    produced = {f for t in ch["transitions"] for f in t["effects"]}
    dlg_ids = {d["id"] for d in ch["dialogues"]}
    if len(dlg_ids) != len(ch["dialogues"]):
        errors.append("duplicate dialogue IDs")
    linked = {d for ids in ch["dialogueLinks"].values() for d in ids}
    for d in ch["dialogues"]:
        if d["id"] not in linked:
            errors.append("dialogue not linked: " + d["id"])
    for tid, ids in ch["dialogueLinks"].items():
        for d in ids:
            if d not in dlg_ids:
                errors.append(f"dialogueLinks {tid} -> unknown {d}")
    for t in ch["transitions"]:
        if t["dialogue"] not in dlg_ids:
            errors.append("transition dialogue missing: " + t["id"])
        for o in t.get("options", []):
            if o["dialogue"] not in dlg_ids:
                errors.append("option dialogue missing: " + t["id"])
    for o in ch["map"]["objects"]:
        if o["assetId"] not in {a["id"] for a in ch["assets"]}:
            errors.append("unknown assetId " + o["assetId"])
        if sum(abs(a - b) for a, b in zip(o["tile"], o["interactionTile"])) != 1:
            errors.append("interaction not adjacent: " + o["id"])
        if tuple(o["interactionTile"]) in set(map(tuple, o["footprint"])):
            errors.append("interaction inside footprint: " + o["id"])
    owned = set()
    for o in ch["map"]["objects"]:
        for t in o["footprint"]:
            if tuple(t) in owned:
                errors.append("footprint overlap")
            owned.add(tuple(t))
    if owned != set(map(tuple, ch["map"]["blockedTiles"])):
        errors.append("blockedTiles != union of footprints")
    block_set = {tuple(t) for t in ch["map"]["blockedTiles"]}
    for a in ch["assets"]:
        if a["kind"] == "audio":
            if "size" in a:
                errors.append("audio has fake size: " + a["id"])
            continue
        w, h = a["size"]
        if "anchorX" in a:
            if a["anchorX"] != w // 2 - 1 or a["anchorY"] != h - 1:
                errors.append("furniture anchor not bottom-centre: " + a["id"])
            if set(map(tuple, a["groundFootprint"])) - block_set:
                errors.append("asset footprint outside collision map: " + a["id"])
            ox, oy = a["anchorTile"]
            if ((16 * ox + 8, 16 * oy + 15) != (16 * a["groundFootprint"][0][0] + 8,
                                                 16 * max(t[1] for t in a["groundFootprint"]) + 15)
                    and len({t[0] for t in a["groundFootprint"]}) > 1):
                errors.append("anchor tile is not the footprint's lowest-left cell: " + a["id"])
            if (16 * ox + 8, 16 * oy + 15) not in [(16 * t[0] + 8, 16 * t[1] + 15) for t in a["groundFootprint"]]:
                errors.append("anchor does not land inside footprint: " + a["id"])
        if "sheet" in a and a["sheetSize"] != [w * a["sheet"]["columns"], h * len(a["sheet"]["rowsOrder"])]:
            errors.append("sheet size mismatch: " + a["id"])
    if len(ch["palette"]) != 12 or len({v for _, v in ch["palette"]}) != 12:
        errors.append("palette is not exactly 12 unique colours")
    if set(produced) != set(FLAG_ORDER):
        errors.append("produced flags differ from FLAG_ORDER")
    if {s["id"] for s in ch["states"] if not s["checkpoint"]}:
        errors.append("a state is not a checkpoint")
    for d in ch["dialogues"]:
        for bad in ("游戏里的", "（游戏", "不是当年", "当年样子", "待确认", "reopen→"):
            if bad in d["text"]:
                errors.append("production note in visible dialogue: " + d["id"])
        if d["basis"] not in ("fact_paraphrase", "staging"):
            errors.append("bad basis " + d["id"])
    # "不写标记" is the positive rule; a bare "不写快照" now names the legacy per-state policy.
    for banned in ("接着处理", "resume_report", "resumeFromOffice", "per_event_then_on_leave",
                   "scene/none", "+ (8,16)", "+(8,16)", "(8, 16)", "2.5 格",
                   "checkpoint = none", "检查点 none"):
        if banned in json.dumps(ch, ensure_ascii=False):
            errors.append("forbidden leftover: " + banned)
    return errors


# ---------------------------------------------------------------------------------------------
# Read-only simulator: the single policy, applied literally. Node = (state, flags, snapshot).
# After every accepted event the snapshot is serialised, parsed back and used as the state of the
# next step, so a walk only continues if exact-snapshot restore reproduces state and flags.
# ---------------------------------------------------------------------------------------------
def confirmable(requires, effects, flags):
    """The one acceptance rule: requires hold and at least one effect is not in flags yet."""
    return set(requires) <= flags and bool(set(effects) - flags)


def options_for(state, flags, target):
    """(transition, option) pairs offered on one interaction target in one state.

    An object's confirming option is listed only while confirmable(); its read page ("再看一眼"／
    "关闭") is always listed. A transition whose effects are all in flags therefore offers the read
    page alone, so it never holds the object's first slot and the object's later unfinished confirms
    stay reachable. Dialog-only transitions (T02, T08) have one implicit confirming option.
    """
    out = []
    for t in TRANSITIONS:
        if t["from"] != state or t["target"] != target:
            continue
        if "options" in t:
            out.extend((t, o) for o in t["options"] if not o["advance"] or confirmable(o["requires"], o["effects"], flags))
            continue
        else:
            out.append((t, {"event": t["event"], "requires": t["requires"], "choice": t["choice"],
                            "label": t["label"], "effects": t["effects"], "advance": True,
                            "dialogue": t["dialogue"]}))
    return out


def available(state, flags, target):
    return [(t, o) for t, o in options_for(state, flags, target) if set(o["requires"]) <= set(flags)]


def current_page(state, flags, target):
    """The first option an object shows: the earliest transition on it whose confirm is offered,
    otherwise the earliest read page. A done mark's read page never precedes an unfinished confirm,
    because a done confirm is not offered at all (options_for())."""
    pages = available(state, flags, target)
    first = next(((t, o) for t, o in pages if o["advance"]), None)
    if first is not None:
        return first
    return pages[0] if pages else None


def make_snapshot(state, flags):
    return {"schema": 1, "chapter": CHAPTER_ID, "state": state,
            "flags": [f for f in FLAG_ORDER if f in set(flags)]}


def restore(raw):
    """Read one stored value back exactly. Returns (state, flags) or raises on a corrupt value."""
    snap = json.loads(raw)
    if set(snap) != set(SAVE_POLICY["snapshotShape"]) or snap["schema"] != 1 or snap["chapter"] != CHAPTER_ID:
        raise ValueError("corrupt snapshot envelope")
    if not legal(snap["state"], snap["flags"]):
        raise ValueError("illegal state/flag pair")
    if snap["flags"] != [f for f in FLAG_ORDER if f in set(snap["flags"])]:
        raise ValueError("flags not in canonical order")
    return snap["state"], frozenset(snap["flags"])


def step(state, flags, target, option, holding=None):
    """Apply one accepted option: validate, state = to, flags union, write one snapshot.

    The runtime resolves an option only among the pages the object actually shows (options_for(),
    which drops confirms whose effects are all in flags), so step() looks there too. holding names
    the transition the caller meant; the resolved option must belong to it.
    """
    match = [(t, o) for t, o in options_for(state, flags, target) if o["event"] == option["event"]]
    if holding is not None:
        match = [(t, o) for t, o in match if t["id"] == holding["id"]]
    if not match:
        raise AssertionError(f"{option['event']} is not a page of {target} in {state}")
    t, o = match[0]
    if not set(o["requires"]) <= set(flags):
        raise AssertionError(f"{o['event']} requires more flags")
    if not o["advance"]:
        if o["effects"]:
            raise AssertionError("read page advanced")
        return state, frozenset(flags), None  # no write
    if not confirmable(o["requires"], o["effects"], flags):
        raise AssertionError(f"{o['event']} re-confirms marks already in flags: not accepted, no snapshot")
    new_state = t["to"]
    new_flags = frozenset(flags) | frozenset(o["effects"])
    return new_state, new_flags, make_snapshot(new_state, new_flags)


def holding_option(state, flags, target, t):
    """The option for transition t that is offered on target: (t, option) or (None, None).

    In-state confirms list their own read page as one of t["options"] with a *different* event ID
    (copy__…); only the option carrying t["event"] itself is the confirmation of this mark, and it is
    reported only while options_for() still lists it (requires hold and an effect is new).
    """
    for tt, o in options_for(state, flags, target):
        if tt["id"] == t["id"] and o["event"] == t["event"]:
            return tt, o
    return None, None


def apply_holding(state, flags, target, t):
    tt, o = holding_option(state, flags, target, t)
    if o is None or not o["advance"]:
        return None            # the mark's confirmation is not offered: nothing to apply
    return step(state, flags, target, o, holding=t)


def duplicate_check(state, flags, tid, target):
    """Re-confirm a mark whose effects are already all in flags (the snapshot is not written again).

    Returns (bad, how). The confirm must not be offered any more; the object must instead show only
    the read page, which writes nothing; and going through step() with the confirm must be refused.
    The page that was shown first (the object's current page) must be a read page, never the stale
    confirm, so it cannot block a later unfinished confirm on the same object.
    """
    t = next(x for x in TRANSITIONS if x["id"] == tid)
    if not set(t["effects"]) <= flags:
        return True, "duplicate check on a mark that is not in flags"
    if holding_option(state, flags, target, t)[1] is not None:
        return True, "duplicate confirm still offered"
    pages = [(tt, o) for tt, o in available(state, flags, target) if not o["advance"]]
    if not any(tt["id"] == t["id"] and o["event"] == "copy__" + t["event"] for tt, o in pages):
        return True, "duplicate has no read page"
    # The object's current page must never be a confirm that this very object's other marks already
    # forbid: T06 is listed before T05, so a stale T06 confirm would cover T05 (and the T07 read page).
    current = current_page(state, flags, target)
    if current is not None and current[1]["advance"] and current[1]["event"] == t["event"]:
        return True, "duplicate confirm occupies the object's current page"
    confirm = {"event": t["event"], "requires": t["requires"], "effects": t["effects"], "advance": True}
    try:
        nstate, nflags, ns = step(state, flags, target, confirm, holding=t)
    except AssertionError as error:
        if "not a page" in str(error):
            return False, "only the read page is offered, no snapshot"
        return True, str(error)
    if ns is not None or nstate != state or nflags != flags:
        return True, "duplicate wrote or changed progress"
    for page in pages:
        if step(state, flags, target, page[1])[2] is not None:
            return True, "read page wrote a snapshot"
    return False, "read page only, no snapshot"


def simulate():
    """BFS over (state, flags, snapshot); every accepted event is serialised and read back."""
    lines, failures = [], []
    start_snap = make_snapshot(SAVE_POLICY["chapterStart"]["state"], SAVE_POLICY["chapterStart"]["flags"])
    start = ("office", frozenset(), json.dumps(start_snap, sort_keys=True))
    queue, seen, complete, accepted = [start], {start}, 0, 0
    targets = [o["id"] for o in OBJECTS] + ["dialog"]
    while queue:
        state, flags, snap = queue.pop(0)
        if not legal(state, flags):
            failures.append(f"illegal config {state} {sorted(flags)}")
        if json.loads(snap) != make_snapshot(state, flags):
            failures.append(f"snapshot not canonical at {state} {sorted(flags)}")
        rstate, rflags = restore(snap)  # exact restore; raises if the snapshot is corrupt
        if (rstate, rflags) != (state, flags):
            failures.append(f"exact restore mismatch at {state} {sorted(flags)}")
        has_confirm = False
        for target in targets:
            pages = available(state, flags, target)
            # At most one confirm per object, and only while its effects are new.
            if sum(o["advance"] for _, o in pages) > 1:
                failures.append(f"{target} in {state} {sorted(flags)} offers more than one confirm")
            for tt, o in pages:
                if o["advance"]:
                    if not confirmable(o["requires"], o["effects"], flags):
                        failures.append(f"{tt['id']} confirm offered with all effects in flags")
                    has_confirm = True
                nstate, nflags, ns = step(state, flags, target, o)
                accepted += 1
                if ns is None:
                    if nstate != state or nflags != flags:
                        failures.append("read page changed progress")
                    continue
                try:
                    rs, rf = restore(json.dumps(ns, sort_keys=True))  # read back before continuing
                except ValueError as error:
                    failures.append(f"{t['id']} {o['event']} wrote a non-restorable snapshot: {error}")
                    continue
                if (rs, rf) != (nstate, nflags):
                    failures.append(f"read-back mismatch after {t['id']}")
                node = (rs, rf, json.dumps(ns, sort_keys=True, ensure_ascii=False))
                if rs == "complete":
                    complete += 1
                if node not in seen:
                    seen.add(node)
                    queue.append(node)
        if not has_confirm and state != "complete":
            failures.append(f"dead end at {state} {sorted(flags)}")
        if state == "complete" and not {"test_reviewed", "comment_reviewed"} <= flags:
            failures.append("complete reached without both learning marks")
    per_state = {}
    for s, _, _ in seen:
        per_state[s] = per_state.get(s, 0) + 1
    lines.append(f"reachable (state, flags, exact snapshot) configurations: {len(seen)}; "
                 f"accepted-event applications read back: {accepted}; complete nodes: {complete}")
    lines.append("per state: " + ", ".join(f"{s}={per_state.get(s, 0)}" for s in STATE_ORDER)
                 + " (expected legal counts: " + ", ".join(f"{s}={len(LEGAL[s])}" for s in STATE_ORDER) + ")")
    if any(per_state.get(s, 0) != len(LEGAL[s]) for s in STATE_ORDER):
        failures.append("reachable configurations differ from the legal snapshot set")
    if per_state.get("complete") == 0:
        failures.append("complete unreachable")

    # Full walks: every legal route through the events, found by a depth-first search from
    # chapter_start in TRANSITIONS order (T05 cannot precede T06, so "orders" are legal paths, not
    # permutations). Every walk exercises the object read page first, writes one snapshot per
    # accepted event, reloads through that snapshot and only continues if the restored
    # (state, flags) equals what the event wrote.
    def legal_routes(limit=12):
        found, stack = [], [("office", frozenset(), [])]
        while stack and len(found) < limit:
            state, flags, path = stack.pop()
            if state == "complete":
                found.append(path)
                continue
            enabled = [t for t in TRANSITIONS
                       if t["from"] == state and set(t["requires"]) <= flags
                       and set(t["effects"]) - flags]
            for t in reversed(enabled):  # push in reverse so T01…T11 order is explored first
                stack.append((t["to"], flags | frozenset(t["effects"]), path + [t["id"]]))
        return found

    routes = legal_routes()
    walks, walk_events = 0, 0
    for route in routes:
        state, flags, stored = "office", frozenset(), json.dumps(start_snap, sort_keys=True)
        aborted = False
        for tid in route:
            t = next(x for x in TRANSITIONS if x["id"] == tid)
            state, flags = restore(stored)
            if t["target"] in OBJECT_TARGETS:  # read page first: must not write
                page = next(o for _, o in available(state, flags, t["target"]) if not o["advance"])
                if step(state, flags, t["target"], page)[2] is not None:
                    failures.append(f"read page {page['event']} wrote a snapshot")
            applied = apply_holding(state, flags, t["target"], t)
            # After writing, re-interacting with the same mark is read-only; the event itself was
            # produced from the pre-event flags in apply_holding, never from a done confirm.
            if applied is not None and t["to"] == state:
                again = duplicate_check(state, applied[1], tid, t["target"])
                if again[0]:
                    failures.append(f"route {route}: {tid} duplicate not read-only: {again[1]}")
            if applied is None:
                failures.append(f"route {route}: {tid} confirmation not offered in {state}")
                aborted = True
                break
            before = flags
            state, flags, ns = applied
            walk_events += 1
            if ns is None:
                failures.append(f"route {route}: {tid} did not write")
                aborted = True
                break
            stored = json.dumps(ns, sort_keys=True, ensure_ascii=False)
            try:
                rstate, rflags = restore(stored)  # exact snapshot is the only thing that continues
            except ValueError as error:
                failures.append(f"route {route}: {tid} snapshot not restorable: {error}")
                aborted = True
                break
            if (rstate, rflags) != (state, flags) or json.loads(stored)["state"] != state:
                failures.append(f"route {route}: {tid} restored snapshot differs from the event")
            if not before <= flags:
                failures.append(f"route {route}: {tid} lost a flag")
        if aborted:
            continue
        if state == "complete":
            walks += 1
        else:
            failures.append(f"route {route} ended in {state}, not complete")
    lines.append(f"legal routes from chapter_start: {len(routes)} (DFS, capped at 12); complete walks with a "
                 f"reload after every event and a read page before every object confirm: {walks}; "
                 f"accepted events in walks: {walk_events}")
    if walks != len(routes) or not routes:
        failures.append("not every legal route reaches complete")
    lines.append("  routes: " + "; ".join(" → ".join(r) for r in routes))

    # Explicit duplicate replay from each state's stored snapshot: re-confirm in-state marks.
    dup_checked, dup_read_only = 0, 0
    for st in ("investigation", "learning"):
        for combo in LEGAL[st]:
            flags = frozenset(combo)
            for tid in ("T04", "T05", "T06", "T09", "T10"):
                t = next(x for x in TRANSITIONS if x["id"] == tid)
                if t["to"] != st or t["effects"][0] not in flags:
                    continue
                again, how = duplicate_check(st, flags, tid, t["target"])
                if again:
                    failures.append(f"{tid} duplicate changed progress in {st} {sorted(flags)}: {how}")
                else:
                    dup_read_only += 1
                dup_checked += 1
    lines.append(f"duplicate re-confirm checks on {dup_checked} (state, flags) pairs: every done mark offers only its "
                 f"read page, writes no snapshot and does not hold the object's first slot; "
                 f"read-only, no-write: {dup_read_only}/{dup_checked}")

    # cto_pc must not let T06 (listed before T05 in TRANSITIONS order) block T05, and three marks
    # must reveal T07. Load-bearing pairs plus every legal investigation configuration.
    MARK_SHORT = {"feedback_reviewed": "反馈", "recheck_visited": "记录", "impact_confirmed": "影响"}
    cto_first = []
    for combo in LEGAL["investigation"]:
        flags = frozenset(combo)
        page = current_page("investigation", flags, "cto_pc")
        shown = page[0]["id"] if page else None
        marked = [f for f in INV_BASE + ["feedback_reviewed", "recheck_visited", "impact_confirmed"]
                  if f in flags and f not in ENTER["investigation"]]
        # First page of cto_pc: T07 when all three are in; otherwise the first confirm still holding.
        expect = ("T07" if set(RESTORE_REQ) <= flags
                  else "T05" if "recheck_visited" in flags and "impact_confirmed" not in flags else "T06")
        if shown != expect:
            failures.append(f"cto_pc first page for {sorted(combo)} is {shown}, expected {expect}")
        key = "+".join(MARK_SHORT[f] for f in marked) or "none"
        cto_first.append((key, shown))
    if len(cto_first) != 6:
        failures.append("expected six investigation configurations")
    lines.append("cto_pc first page by marks already on cto_pc: "
                 + ", ".join(f"{k}={v}" for k, v in cto_first))

    # Same state, different marks are distinct snapshot states: they cannot overwrite each other in
    # the sense of going backwards, because each stored value is one of LEGAL and includes its marks.
    for st in ("investigation", "learning"):
        for combo in LEGAL[st]:
            if not legal(st, combo):
                failures.append(f"legal set broken for {st}")

    # Investigation cannot reach restored without all three confirms; write requires both marks.
    for combo in [set(), {"test_reviewed"}, {"comment_reviewed"}, {"test_reviewed", "comment_reviewed"}]:
        flags = frozenset(ENTER["learning"]) | frozenset(combo)
        ok = any(o["event"] == "write_manual_entry" for _, o in available("learning", flags, "manual_shelf"))
        if ok != (combo == {"test_reviewed", "comment_reviewed"}):
            failures.append(f"write_manual_entry availability wrong for {sorted(combo)}")
    for combo in LEGAL["investigation"]:  # every legal investigation snapshot, six of them
        flags = frozenset(combo)
        ok = any(o["event"] == "resume_narrative" for _, o in available("investigation", flags, "cto_pc"))
        full = set(combo) == set(ENTER["investigation"]) | {"feedback_reviewed", "recheck_visited",
                                                            "impact_confirmed"}
        if ok != full:
            failures.append(f"resume_narrative availability wrong for {combo}")
    # A close on resume_narrative's read page must never advance.
    pending = next(o for _, o in available("investigation", frozenset(ENTER["investigation"]), "cto_pc")
                   if o["event"] == "copy__resume_narrative")
    if pending["advance"]:
        failures.append("investigation-pending read page advances")
    lines.append("investigation needs T04+T06+T05 before resume_narrative; write_manual_entry needs both marks; "
                 "dialogue-only transitions (read_feedback, comfort_read) each have one confirming page")

    # Literal walk-throughs of the two reported holes. Each interaction opens the object's current
    # page from the stored snapshot and is applied with step(); accepting a confirm writes, and a
    # read page (reached by closing) writes nothing. A stale confirm must never be the current page.
    target_of = {t["event"]: t["target"] for t in TRANSITIONS}
    setup = ["open_forum_post", "read_feedback", "cto_rallies_team", "confirm_feedback_reviewed"]

    def walk_steps(name, setup_events, script, end_state):
        log = []
        stored = [json.dumps(start_snap, sort_keys=True)]

        def accept(obj, evt):
            state, flags = restore(stored[0])
            page = current_page(state, flags, obj)
            if page is None or page[1]["event"] != evt:
                failures.append(f"{name}: {obj} page was {page[0]['id'] if page else None}, expected {evt}")
                return
            state, flags, ns = step(state, flags, obj, page[1])
            if ns is None:
                failures.append(f"{name}: {evt} wrote nothing")
                return
            stored[0] = json.dumps(ns, sort_keys=True, ensure_ascii=False)
            log.append(f"{obj} {page[0]['id']} 接受→{state}")

        def read_only(obj, copy_evt):
            state, flags = restore(stored[0])
            page = current_page(state, flags, obj)
            log.append(f"{obj} 再交互：当前页 {page[0]['id']}“{page[1]['label']}”")
            # The confirm just done is never offered again, so it cannot occupy the current page and
            # hide the object's later confirms. The page shown instead may be another open confirm
            # (already validated by step()); the read page must still be reachable behind it.
            done_event = copy_evt[len("copy__"):]
            if any(o["event"] == done_event for _, o in available(state, flags, obj)):
                failures.append(f"{name}: stale confirm {done_event} still offered on {obj}")
            behind = next((o for t_, o in available(state, flags, obj) if o["event"] == copy_evt), None)
            if behind is None:
                failures.append(f"{name}: {obj} has no {copy_evt}")
                return
            state, flags, ns = step(state, flags, obj, behind)
            if ns is not None or state != restore(stored[0])[0]:
                failures.append(f"{name}: {copy_evt} wrote")
            log.append(f"关闭后只读 {copy_evt}，不写快照")

        def offered(obj, evt):
            state, flags = restore(stored[0])
            shown = [o["event"] for _, o in available(state, flags, obj) if o["advance"]]
            log.append(f"{obj} 可确认 {shown}")
            if evt not in shown:
                failures.append(f"{name}: {obj} should offer {evt}, offers {shown}")

        for ev in setup_events:
            accept(target_of[ev], ev)
        for op, obj, arg in script:
            {"accept": accept, "read": read_only, "offered": offered}[op](obj, arg)
        state, flags = restore(stored[0])
        log.append(f"最终 {state} {fmt_flags(flags)} (写入 {end_state})")
        if state != end_state:
            failures.append(f"{name}: ended in {state}, expected {end_state}")
        lines.append(f"walked {name}: " + " | ".join(log))

    walk_steps(
        "T06确认→再T06只读不写→T05仍可出现并确认→三项齐全→T07出现→T07进restored", setup,
        [("accept", "cto_pc", "confirm_recheck_visited"), ("read", "cto_pc", "copy__confirm_recheck_visited"),
         ("offered", "cto_pc", "confirm_impact_scope"), ("accept", "cto_pc", "confirm_impact_scope"),
         ("read", "cto_pc", "copy__confirm_impact_scope"), ("offered", "cto_pc", "resume_narrative"),
         ("accept", "cto_pc", "resume_narrative")], "restored")
    walk_steps(
        "T09确认→再T09只读不写→T10确认→再T10只读不写→T11→complete",
        setup + ["confirm_recheck_visited", "confirm_impact_scope", "resume_narrative", "comfort_read"],
        [("accept", "test_notes", "review_test_plan"), ("read", "test_notes", "copy__review_test_plan"),
         ("offered", "trap_note", "review_trap_comment"), ("accept", "trap_note", "review_trap_comment"),
         ("read", "trap_note", "copy__review_trap_comment"), ("offered", "manual_shelf", "write_manual_entry"),
         ("accept", "manual_shelf", "write_manual_entry")], "complete")


    # Invalid snapshots: state/flag mixtures outside LEGAL are corrupt, restart or continue unsaved.
    bad = [{"schema": 1, "chapter": CHAPTER_ID, "state": "office", "flags": ["report_read"]},
           {"schema": 1, "chapter": CHAPTER_ID, "state": "report", "flags": []},
           {"schema": 1, "chapter": CHAPTER_ID, "state": "learning", "flags": ENTER["learning"] + ["impact_confirmed"]},
           {"schema": 1, "chapter": CHAPTER_ID, "state": "unknown", "flags": []},
           {"schema": 2, "chapter": CHAPTER_ID, "state": "office", "flags": []}]
    for b in bad:
        try:
            restore(json.dumps(b))
        except ValueError:
            continue
        failures.append(f"invalid snapshot accepted: {b}")
    lines.append(f"invalid snapshots rejected as corrupt (restart or continue without saving): {len(bad)} examples")
    return lines, failures


# ---------------------------------------------------------------------------------------------
# Markdown from the same data
# ---------------------------------------------------------------------------------------------
LETTERS = {"forum_pc": "A", "trap_note": "D", "test_notes": "C", "cto_pc": "B",
           "bookshelf": "E", "manual_shelf": "F", "window_plant": "G", "coffee_mug": "H"}


def tile_str(t):
    return "[" + ",".join(str(v) for v in t) + "]"


def render_map():
    inter = {tuple(o["interactionTile"]) for o in OBJECTS}
    cells = {}
    for o in OBJECTS:
        for t in o["footprint"]:
            cells[tuple(t)] = LETTERS[o["id"]] if tuple(t) == tuple(o["tile"]) else LETTERS[o["id"]].lower()
    rows = []
    for y in range(16):
        row = []
        for x in range(24):
            t = (x, y)
            if t in cells:
                row.append(cells[t])
            elif t == SPAWN:
                row.append("@")
            elif t == CTO_TILE:
                row.append("T")
            elif t in inter:
                row.append("+")
            else:
                row.append("," if ROLES[t] == "rug" else ".")
        assert len(row) == 24
        rows.append(f"{y:2} " + "".join(row))
    legend = ("A 我的工位电脑 [9,3] · B CTO 工位电脑 [15,3] · C 补测便签 [13,3] · D 坑点注释 [11,3] · "
              "E/e 书架 [19,3][20,3] · F 手册书架 [21,3] · G 窗边绿植 [3,12] · H 保温杯 [6,12] · "
              "+ 交互点 · @ 出生点 · T CTO 站位 [16,2] · `.` 地板 · `,` 地毯。"
              "这 24×16 格里没有墙：墙与窗画在地图矩形上方的画布像素行 -16～-1，左墙画在画布 x<0，"
              "不铺进任何可走格，也不参与碰撞。")
    return "\n".join(rows), legend


def flags_text(flags):
    return "、".join("`" + f + "`" for f in flags) or "无"


def render_design():
    body, legend = render_map()
    dlg = {d["id"]: d for d in DIALOGUES}
    sp = SAVE_POLICY
    total = sum(st["budgetSeconds"] for st in STATES)
    L = []
    L.append(f"# {TITLE}")
    L.append("")
    L.append("对象：`nanjing-first-release`，“一路写来”的首个可玩样章。人生时间线仍从合肥开始，本章只做南京。"
             "数据版见 [chapter-01.json](./chapter-01.json)，美术规格见 [chapter-01-art.md](./chapter-01-art.md)。"
             "状态：设计草案，尚未实现；2～3 分钟是按状态预算推算的**预期**，不是实测。"
             "概念板 `art/nanjing-art-direction-v1.png` 未获作者认可，也不是生产素材。")
    L.append("")
    L.append("## 一、目标与节奏")
    L.append("")
    L.append("玩家扮演当年的作者：论坛有人反馈无法登录；我第一次面对真实的线上 C 端用户，呆住；CTO 带大家排查；"
             "整整两小时后恢复；CTO、老板、同事安慰我；再补测试和注释，写进游戏里的工作手册。")
    L.append("")
    L.append("顺序固定为：论坛反馈 → 呆住 → CTO 带大家排查 → 两小时 → 宽慰 → 补测试与注释 → 手册。"
             "没有考试、失败或分数，也没有要猜的技术谜题：排查段只让玩家去不同物件重读已有内容并确认，"
             "恢复靠叙事转场。")
    L.append("")
    L.append("| 状态 | 标题 | 预算 | 检查点 | 入口格 | 离开条件 |")
    L.append("| --- | --- | --- | --- | --- | --- |")
    ends = {}
    for t in TRANSITIONS:
        ends.setdefault(t["from"], []).append(f"`{t['event']}`→{t['to']}")
    for st in STATES:
        L.append(f"| {st['id']} | {st['title']} | {st['budgetSeconds']}s | true（`{sp['id']}`） | "
                 f"{place_text(st['entryPlacement'])} | {'；'.join(ends.get(st['id'], ['—']))} |")
    L.append("")
    L.append(f"合计 {total} 秒，落在 120～180 秒的预期内；各状态预算含阅读与操作，需真人试玩校正。"
             "七个状态入口都是稳定检查点，读档只恢复最近一次被接受事件写下的同一个快照（第七节）。")
    L.append("")
    L.append("## 二、事实、演出与缺失")
    L.append("")
    L.append("| 内容 | 依据 |")
    L.append("| --- | --- |")
    L.append("| 用户在论坛反馈无法登录；作者第一反应呆住；登录框故障整整两小时；CTO 带大家排查；"
             "事后 CTO、老板、同事安慰；补测试、注释说明为什么有坑 | 作者提供的事实，`fact_paraphrase` 转述，非逐字记录 |")
    L.append("| “没关系，大家都经历过” | 作者提供的安慰大意；旁白 `fact_paraphrase`，CTO 与同事台词是 `staging` 演出草稿 |")
    L.append("| 办公室布局、站位、论坛面板、笔记本、排查记录页、工作手册、按钮 | `staging`，游戏演出，不是确认历史 |")
    L.append("")
    L.append("不写的边界见 JSON 的 `blockedHistoricalDetails`："
             + "；".join(BLOCKED_DETAILS) + "。"
             "登录示意不演“按钮点了没反应”，排查记录不含根因；对白里没有真实报错、日志、用户名或日期，"
             "也没有制作注释，那些说明只写在 JSON 的 `note` 字段与本文。")
    L.append("")
    L.append("## 三、地图与坐标")
    L.append("")
    L.append("24×16 格，地砖 16×16 px，原点左上 (0,0)，出生点 [3,14]。地图矩形内没有墙格：墙与窗是背景层，"
             "上墙画在矩形上方的画布像素行 -16～-1，窗在画布 x=80～143，左墙画在 x<0，"
             "不铺进地图、不写进 `blockedTiles`；地图边界本身阻挡移动。")
    L.append("")
    L.append("```text")
    L.append(body)
    L.append("```")
    L.append("")
    L.append(legend)
    L.append("")
    L.append("| 对象 ID | 资产 ID | 用途 | 本体格 | 交互点 | 交互朝向 | footprint | 必选 |")
    L.append("| --- | --- | --- | --- | --- | --- | --- | --- |")
    for o in OBJECTS:
        L.append(f"| {o['id']} | `{o['assetId']}` | {o['label']} | {tile_str(o['tile'])} | "
                 f"{tile_str(o['interactionTile'])} | {FACE_LABEL[INTERACTION_DIR[o['id']]]} | "
                 f"{' '.join(tile_str(t) for t in o['footprint'])} | {'是' if o['required'] else '否（可选）'} |")
    L.append("")
    L.append(f"`blockedTiles` 共 {len(BLOCKED)} 格，全部来自上面的 footprint，每格只属于一个对象，没有额外装饰障碍；"
             "每个交互点离本体 1 格、不在 footprint 内，从出生点都能走到。CTO 整章站在 [16,2]，不占碰撞格，"
             "也不在任何交互点上。")
    L.append("")
    L.append("像素落点只用一个公式：" + FOOT_RULE + "家具：" + FURNITURE_RULE)
    L.append("")
    L.append("### 交互规则")
    L.append("")
    L.append("- 对象有三个位置：本体格 tile、交互点 interactionTile、视觉包围（贴图像素）。"
             "触发要求：玩家所在格正是 interactionTile，朝向为表中“交互朝向”（JSON `interactionDirs`），"
             "再按 E／空格或点提示／A 按钮。朝向不对时第一次按键只转身。")
    L.append("- 例如 forum_pc：本体 [9,3] 在交互点 [9,4] 正上方，站 [9,4] 朝上就是标准站位；"
             "站 [9,2] 朝下、或站 [20,4] 看两格宽书架，都不触发。")
    L.append("- 同一行有多个交互点时只高亮离玩家最近的一个，触发仍按上面的规则；触屏不自动寻路、不隔空触发。")
    L.append("")
    L.append("## 四、按状态的分镜、操作与结束条件")
    L.append("")
    for st in STATES:
        L.append(f"### {st['id']}：{st['title']}（约 {st['budgetSeconds']} 秒，checkpoint = true）")
        L.append("")
        L.append(f"- 目标：{st['goal']}")
        L.append(f"- 玩家操作：{st['playerAction']}")
        L.append(f"- 结束条件：{st['endCondition']}")
        L.append(f"- 场景反馈：{st['feedback']}")
        L.append(f"- 重复与陷阱：{st['repeatRule']}")
        L.append(f"- 存档与恢复：{st['resumeRule']}")
        L.append(f"- 进入所需标记：{flags_text(st['enterFlags'])}")
        L.append("")
    L.append("任何被接受的确认项都按第七节写完整快照，所以“刷新回到哪里”只取决于最近这次确认。")
    L.append("")
    L.append("### 事件表")
    L.append("")
    L.append("`options` 最多一个确认项和一个只读页。确认项显示／接受条件 = requires 全部满足，且本次 effects 至少有一个"
             "尚未在标记里；effects 已全在标记里时只显示该项只读页。接受确认项 = state 变为 `to`、"
             "effects 并入标记、写一次完整快照。只读页不改状态、不加标记，也不写任何快照。")
    L.append("")
    L.append("| ID | 事件 | from → to | 目标 | 确认 label／requires → effects | 只读页 |")
    L.append("| --- | --- | --- | --- | --- | --- |")
    for t in TRANSITIONS:
        req = ", ".join(t["requires"]) if t["requires"] else "—"
        L.append(f"| {t['id']} | `{t['event']}` | {t['from']} → {t['to']} | {t['target']} | "
                 f"{t['label']}／{req} → {', '.join(t['effects'])} | "
                 f"{('`' + t['readPage'] + '`') if 'readPage' in t else '对话本身（T02、T08）'} |")
    L.append("")
    L.append("走通原因：T01→T02→T03 保证呆住先于 CTO 介入；T04（forum_pc）、T06（cto_pc 排查记录）、"
             "T05（cto_pc 影响范围，要求 T06 先写 recheck_visited）各写一个标记，T07 要三项齐全才进 restored，"
             "进入 investigation 不会自动恢复；T09、T10 各写一个标记，T11 同时要求两者，并在进入 complete 时"
             "继承 T08 写下的 comfort_read；T08 只在点“收起”时触发。")
    L.append("")
    L.append("## 五、关键对白")
    L.append("")
    L.append("完整对白与 `note` 以 JSON 的 `dialogues` 为准，这里只列关键句。`fact_paraphrase` 是事实转述，"
             "`staging` 是演出，都不是历史原话。")
    key_ids = ["office-n3", "report-reaction", "incident-freeze", "incident-cto-1", "incident-rally",
               "investigation-confirm-1", "investigation-confirm-2", "investigation-confirm-3",
               "investigation-handoff", "restored-n1", "restored-colleague-1", "restored-n3", "learning-n1",
               "learning-manual-1", "complete-n1"]
    current = None
    for did in key_ids:
        d = dlg[did]
        if d["state"] != current:
            current = d["state"]
            L.append("")
            L.append(f"**{current}**")
            L.append("")
        L.append(f"- `{did}` {d['speaker']}［{d['basis']}］：{d['text']}")
    L.append("")
    L.append("## 六、可选探索与界面")
    L.append("")
    L.append(f"{len(OBSERVE)} 个可选观察物件不写标记、不阻塞主线，office 与 complete 里都能看："
             + "；".join(f"`{oid}`（{OBJ[oid]['label']}，交互点 {tile_str(OBJ[oid]['interactionTile'])}）"
                        f"「{dlg[did]['text']}」" for oid, (did, _) in OBSERVE.items()) + "。"
             "主线提示是朱砂色小箭头加“去看看”，可选观察是石灰色圆点加“看看”，都不进任务条。")
    L.append("")
    L.append("键盘：WASD／方向键移动（斜走不加速），E 或空格交互与推进对话，Esc 暂停，Tab 选择、Enter 确认；"
             "只有焦点在游戏区域时才接管方向键。触屏：虚拟方向键加 A 按钮，热区至少 44 CSS px，"
             "点提示或 A 按钮同样只在满足交互规则时触发，按钮避开对话面板。对话、论坛、笔记本、手册都用 DOM "
             "与系统字体，可读屏，状态不只靠颜色；声音默认关闭，由开始页或暂停菜单开启。")
    L.append("")
    L.append("## 七、暂停、跳过、刷新、存档与重玩")
    L.append("")
    L.append(f"- 暂停与跳过：{RUNTIME_RULES['pause']}{RUNTIME_RULES['skip']}")
    L.append(f"- **存档政策** `{sp['id']}`：键 `{sp['key']}`，快照字段 {', '.join(sp['snapshotShape'])}。"
             f"检查点：{sp['checkpoints']}（" + "、".join(sp["checkpointStates"]) + "）。")
    L.append(f"- chapter_start：写 {{state:{sp['chapterStart']['state']}, flags:[]}}，"
             f"玩家在 {place_text(sp['chapterStart']['tile'])}。{sp['chapterStart']['writeWhen']}")
    L.append(f"- 确认项条件：{sp['acceptRule']}")
    L.append(f"- 被接受的事件：{sp['acceptedEvent']}")
    L.append(f"- 未接受或重复：{sp['ignored']}")
    L.append(f"- 读档：{sp['restore']}")
    L.append(f"- 重播：{sp['replay']}")
    L.append(f"- 非法快照：{sp['invalid']}")
    L.append("")
    L.append("写快照的事件（一次事件一次完整写入，`state` 即写入后的当前状态）：")
    L.append("")
    L.append("| 事件 | from → to | 快照 state | 快照 flags | 入口格 |")
    L.append("| --- | --- | --- | --- | --- |")
    L.append(f"| chapter_start | — → office | office | [] | {place_text(sp['chapterStart']['tile'])} |")
    for row in event_snapshots():
        flags = fmt_flags(row["flags"])
        if row["from"] in ("investigation", "learning") and row["to"] == row["from"]:
            flags = "当前并集 + [" + ", ".join(t["effects"][0] for t in STORY if t["id"] == row["id"]) + "]"
        elif row["holds"]:
            carry = [f for f in LEGAL[row["from"]][-1]
                     if f not in row["holds"] and f not in row["flags"]]
            flags = "保证标记 " + flags + ("；进入时另含此前已记的 " + "、".join(carry) if carry else "")
        L.append(f"| {row['id']} `{row['event']}` | {row['from']} → {row['to']} | {row['state']} | "
                 f"{flags} | {place_text(row['placement'])} |")
    L.append("")
    L.append("刷新或重进读回同一快照：")
    L.append("")
    for ex in restore_examples():
        label = ex["case"]
        if label in ("investigation", "learning"):
            marks = "+".join(f for f in ex["flags"] if f not in ENTER[label]) or "无"
            label = f"{label}（{marks}）"
        L.append(f"- {label}：磁盘 {{state:{ex['state']}, flags:{fmt_flags(ex['flags'])}}}，"
                 f"入口 {place_text(ex['placement'])}；{ex['after']}")
    L.append("")
    L.append("- 重玩只清除本章命名空间，按 chapter_start 写 office 空标记，complete 处二次确认。")
    L.append("")
    L.append("## 八、素材、声音与制作步骤")
    L.append("")
    L.append("资源 ID 与 JSON `assets` 一一对应，尺寸、占格与锚点见[美术规格](./chapter-01-art.md)：角色 "
             + "、".join(f"`{a['id']}`" for a in ASSETS if a["id"] in ("player-walk", "npc-cto")) + "；家具 "
             + "、".join(f"`{o['assetId']}`" for o in OBJECTS) + "；地砖 "
             + "、".join(f"`{a['id']}`" for a in ASSETS if a["kind"] == "tile") + "；界面 "
             + "、".join(f"`{a['id']}`" for a in ASSETS if a["kind"] == "ui") + "。")
    L.append("")
    L.append("声音只记录时长与是否循环，不设像素尺寸："
             + "、".join(f"`{a['id']}` {a['durationMs']} ms{'（循环）' if a.get('loop') else ''}"
                        for a in ASSETS if a["kind"] == "audio") + "。制作步骤：")
    L.append("")
    for i, step in enumerate([
        "用 16px 地砖、16×24 行走帧和 CTO 站位搭静态办公室，核对走道、交互点朝向与地图外的墙窗。",
        "实现纯剧情模块：选项、标记并集、原子快照与 exact 恢复；以本章 JSON 为数据源，先写覆盖七个检查点恢复的状态机测试。",
        "接入简单引擎：固定步长、碰撞只认 blockedTiles、交互规则（格与朝向）、对话锁定；演员不碰撞。",
        "完成 DOM 面板与键盘、触屏输入，声音默认关闭。",
        "制作行走图与家具，按锚点组装，补两小时转场的离散压暗。",
        "按验收方案跑 PLAY、STORY 与叙事核对，录完整样章与异常恢复片段。",
    ], 1):
        L.append(f"{i}. {step}")
    L.append("")
    L.append("## 九、风险")
    L.append("")
    for risk in [
        "同一行几个交互点可能同时出提示；按“只高亮最近一个”处理，实机仍需确认。",
        "排查段没有真实根因可演，容易显得空转；“去不同地方读一读、记下来”是否足够，要试玩判断。",
        "呆住演示只有约 1.5 秒，过短看不出停顿、过长拖慢节奏；实机调到“能感到停顿”。",
        "家具贴图比一格宽，遮挡按脚底行排序；两格宽的书架与 40px 宽的桌子要单独检查。",
        "手机小屏上论坛、手册和方向键争空间，字号与布局需在 375 px 宽度实测后再定。",
        "宽慰段落容易写成说教，试玩时请作者确认是否符合本人感受。",
        "快照写失败（存储满、隐私模式）只能提示“本次继续，不保存”，实现时不得悄悄只写标记或只写状态。",
        "调查段同一状态有 6 种合法快照、learning 有 4 种，complete 的快照还带着 learning 之前的全部标记；"
        "实现时要逐条对照 `legalSnapshots` 与各状态 `enterFlags`，不能只校验状态名。",
        "论坛面板与对话是进入状态后的重播演出；对象页（论坛、CTO 电脑、便签、注释、手册）只由玩家在交互点打开，"
        "恢复后不应自动弹出，否则会挤掉“读反馈→呆住”的停顿。",
    ]:
        L.append(f"- {risk}")
    L.append("")
    L.append("## 十、Agent 先验与作者后验")
    L.append("")
    L.append("本轮 Agent 只做设计：JSON 与两份正文由同一份数据生成；生成器内置只读模拟，按 "
             f"`{sp['id']}` 从 chapter_start 出发，每个被接受的事件后把快照序列化再读回，再继续到 complete。"
             "这些不验证游戏是否可玩、画面、性能，也不代表史实被作者认可。")
    L.append("")
    L.append("后续必须实测：浏览器走动与碰撞、交互规则与朝向、完整剧情、暂停与存档恢复、手机真机触控、"
             "素材加载与性能；未做之前一律标为“未验证”。")
    L.append("")
    L.append("作者后验：事实顺序与语气是否符合本人记忆；是否接受“排查只读取转录、恢复靠转场”；"
             "探索与阅读节奏是否舒服；美术方向是否喜欢。未回复不视为认可。")
    L.append("")
    return "\n".join(L) + "\n"


def render_art():
    A = {a["id"]: a for a in ASSETS}
    L = []
    L.append("# 南京第一章：素材制作清单与规格")
    L.append("")
    L.append("本章制作规格，只服务于 `nanjing-first-release`。尺寸与锚点都是**设计值**：尚未制作、导出或检查任何"
             "生产素材。概念板 `art/nanjing-art-direction-v1.png` 只用于看方向，不是图集来源，也不代表作者已认可。"
             "ID、像素尺寸、占格与锚点与 [chapter-01.json](./chapter-01.json) 的 `assets`、`map.objects` 一致。")
    L.append("")
    L.append("## 一、网格、坐标与锚点")
    L.append("")
    L.append("- 逻辑像素 1 px 显示为整数倍设备像素（2×、3×、4×），近邻采样，关闭线性过滤与 mipmap。地砖 16×16，"
             "角色帧 16×24。")
    L.append("- 坐标用像素索引：图左上角 (0,0)，x 向右、y 向下；宽 16 的图最右列是 15，高 24 的图最下行是 23。"
             "锚点 (anchorX, anchorY) 是图内像素索引，必须落在尺寸范围内。")
    L.append("- 统一落点公式（角色与家具共用这一个）：" + FOOT_RULE)
    L.append("- 家具：" + FURNITURE_RULE + " 例：书架 32×48，footprint [19,3]、[20,3]，最下方一格是 [19,3]，"
             "落点 (16*19+8, 16*3+15) = (312, 63)，贴图内锚点 (15,47)。")
    L.append("- 镜头：固定正交俯视三分之四视角，地面轴向排布；遮挡按锚点所在格的行号排序，同一行再按 y、x。")
    L.append("")
    L.append("## 二、统一调色板（精确 12 色）")
    L.append("")
    L.append("全部位图共用一张 12 色索引调色板，禁止抗锯齿半透明像素和表外颜色：")
    L.append("")
    for _name, _value in PALETTE:
        L.append(f"- `{_name}` `{_value}`")
    L.append("")
    L.append("用途：`warm_white` 墙与纸张，`ink` 字与轮廓，`stone` 可选观察提示，`cinnabar` 主角上衣与主线提示，"
             "`wood_dark` 桌面与书脊，`wood_light` 地板，`brick_gray` 椅面与踢脚线，`grass_green` 绿植，"
             "`blue_gray` 屏幕与地毯，`night_blue` 转场压暗，`window_light` 窗外光，`warm_light` 台灯与高光。")
    L.append("")
    L.append("离散光色：日景一档光照；两小时转场用 `night_blue` 两档叠加压暗（`tile-outage-dim`）。不用渐变、光晕与柔边。")
    L.append("")
    L.append("## 三、生产素材清单")
    L.append("")
    L.append("贴图像素尺寸与视觉高度是视觉包围，地面占格是碰撞格（JSON footprint），两者分开：碰撞只由 footprint 决定。"
             "家具的横向视觉宽度必须正好覆盖 footprint 的格宽（每格 16 px，2 格宽即 32 px），"
             "排成一行并列的家具（本行 `cto_pc` 与 `trap_note`）因此不会互相叠画。")
    L.append("")
    L.append("| 资产 ID | 类型 | 贴图像素尺寸 | 地面占格 | 说明 | 锚点 (x,y) |")
    L.append("| --- | --- | --- | --- | --- | --- |")
    for a in ASSETS:
        if a["kind"] == "audio":
            continue
        if a.get("groundFootprint"):
            ground = " ".join(tile_str(t) for t in a["groundFootprint"]) + f"（{a['footprintExtent']['widthTiles']}"
            ground += f"×{a['footprintExtent']['heightTiles']} 格）"
        elif a["id"] in ("player-walk", "npc-cto"):
            ground = "不碰撞"
        elif a["id"] in ("tile-wall", "tile-window"):
            ground = "地图外背景层"
        elif a["kind"] == "tile":
            ground = "平铺，不碰撞"
        else:
            ground = "UI，不占地"
        anchor = f"({a['anchorX']},{a['anchorY']})" if "anchorX" in a else ("(8,23)［每帧］" if "sheet" in a else "—")
        L.append(f"| `{a['id']}` | {a['kind']} | {a['size'][0]}×{a['size'][1]} | {ground} | {a['description']} | {anchor} |")
    L.append("")
    L.append("与地图对照（本体、footprint、交互点与 JSON `map.objects` 相同）：")
    L.append("")
    for o in OBJECTS:
        a = A[o["assetId"]]
        L.append(f"- `{o['id']}`：本体 {tile_str(o['tile'])}，footprint "
                 f"{' '.join(tile_str(t) for t in o['footprint'])}，交互点 {tile_str(o['interactionTile'])}"
                 f"（玩家{FACE_LABEL[INTERACTION_DIR[o['id']]]}）；贴图 {a['size'][0]}×{a['size'][1]}，"
                 f"锚点 ({a['anchorX']},{a['anchorY']})。")
    L.append("")
    L.append("墙与窗：`tile-wall`、`tile-window` 只作为背景层画在地图矩形上方的画布像素行 -16～-1（窗在画布 x=80～143），"
             "左墙画在 x<0；24×16 地图内没有墙格，角色不会走进画里的墙。")
    L.append("")
    L.append("## 四、角色帧与图集")
    L.append("")
    L.append("| 资产 | 每帧尺寸 | 排布 | 图集整图尺寸 | 播放与朝向 |")
    L.append("| --- | --- | --- | --- | --- |")
    for aid, note in [
        ("player-walk", "行序 down、up、left、right；每行 4 帧：站立、左迈、站立、右迈，8 fps，松键立即停在站立帧。"
                        "右向单独绘制，不做水平镜像。"),
        ("npc-cto", "行序 down、up、left、right；只有四向站立各 1 帧，整章不播行走，换朝向直接切帧。"),
    ]:
        a = A[aid]
        sh = a["sheet"]
        L.append(f"| `{aid}` | {a['frameSize'][0]}×{a['frameSize'][1]} | {sh['columns']} 列 × "
                 f"{len(sh['rowsOrder'])} 行（{a['frames']} 帧） | {a['sheetSize'][0]}×{a['sheetSize'][1]} | {note} |")
    L.append("")
    L.append("主角图集无内边距：4 列 16 宽共 64，4 行 24 高共 96，整图 64×96；CTO 图集整图 16×96。"
             "两套图集透明底，帧与帧之间不留渗色；每帧脚底像素在第 8 列、第 23 行。")
    L.append("")
    L.append("## 五、DOM 中文与手机 UI")
    L.append("")
    L.append("中文字不进位图：对话框、论坛、笔记本、手册、任务条、暂停菜单都用 HTML/CSS 系统字体，正文不小于 "
             "16 CSS px，行高 1.6；位图只负责底框、按钮底座和图标。")
    L.append("")
    L.append("- 桌面：画布按 2× 或 3× 整数倍缩放，居中显示整张 24×16 地图。")
    L.append("- 手机竖屏 375 CSS px：不缩小整张地图，逻辑视口改为跟随镜头的较小区域（例如 12×12 格），"
             "世界被裁切而像素仍按设备像素整数倍显示；镜头以角色为中心、按整格追随。"
             "对话、任务条、方向键是独立 DOM 层，字号与 44 CSS px 触控热区不随像素倍率变化。")
    L.append("- 横竖切换不丢状态，也不改变像素整数倍；交互按钮只在“站在交互点且朝向正确”时可点。")
    L.append("")
    L.append("## 六、音频")
    L.append("")
    L.append("只记录时长与是否循环，没有像素尺寸；声音默认关闭。"
             + "、".join(f"`{a['id']}` {a['durationMs']} ms{'（循环）' if a.get('loop') else ''}"
                        for a in ASSETS if a["kind"] == "audio") + "。")
    L.append("")
    L.append("## 七、图片与视频验收（要求，尚未执行）")
    L.append("")
    for item in [
        "像素：导出 1:1 原始尺寸 PNG，注明 CSS 视口与 DPR；放大查看不得有半透明或彩色杂边。",
        "透明边缘：角色与家具贴边不得残留底色；图集帧之间没有渗色。",
        "锚点：每帧脚底在 (8,23)；家具锚点在贴图底边中央，例如书架 (15,47)、桌子 (19,31)、保温杯 (5,11)，"
        "并按第一节公式把落点换算回世界逻辑像素。",
        "图集尺寸：`player-walk` 每帧 16×24、整图 64×96；`npc-cto` 每帧 16×24、整图 16×96。",
        "占格：贴图 40×32 的桌子视觉比一格宽，碰撞只占一格；两格宽书架贴图 32×48，碰撞恰好两格；截图时叠加 footprint 网格核对。",
        "调色板：抽样像素全部来自 12 色。",
        "墙窗只在地图外，实机截图中角色不会与画中的墙重叠。",
        "必交截图：办公室全景、四向站立与行走、家具与占格对照、论坛／笔记本／手册、桌面与 375 px 手机、两小时转场前后。",
    ]:
        L.append(f"- {item}")
    L.append("")
    L.append("视频：完整样章 2～3 分钟正常速度录屏、桌面交互、手机真机触控、异常恢复（连续点击、跳过、刷新继续、"
             "切后台）。截图与录屏都要标版本、浏览器、设备与输入方式；以上材料均尚未产生，不能写成已通过。")
    L.append("")
    return "\n".join(L) + "\n"


def write_json(ch):
    path = OUT / "chapter-01.json"
    path.write_text(json.dumps(ch, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return path


def main():
    errors = validate_extra(CHAPTER)
    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1
    lines, failures = simulate()
    print("save/restore simulation:")
    for ln in lines:
        print("  " + ln)
    if failures:
        print("simulation failed:", *failures, sep="\n  ", file=sys.stderr)
        return 1
    print(write_json(CHAPTER))
    check = subprocess.run([sys.executable, str(ROOT / "scripts/check-design.py"), str(OUT / "chapter-01.json")],
                           capture_output=True, text=True)
    sys.stdout.write(check.stdout)
    sys.stderr.write(check.stderr)
    if check.returncode:
        return check.returncode
    (OUT / "chapter-01.md").write_text(render_design(), encoding="utf-8")
    (OUT / "chapter-01-art.md").write_text(render_art(), encoding="utf-8")
    print(OUT / "chapter-01.md")
    print(OUT / "chapter-01-art.md")
    return 0


if __name__ == "__main__":
    sys.exit(main())

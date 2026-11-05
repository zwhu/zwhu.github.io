#!/usr/bin/env python3
"""Check chapter design references, conditional progression and map access, offline."""
import json
import sys
from collections import deque
from pathlib import Path

GAME = Path(__file__).resolve().parents[1]
STATES = {'office', 'report', 'incident', 'investigation', 'restored', 'learning', 'journey', 'complete'}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def unique_ids(items, name):
    require(isinstance(items, list) and items, name + ' must be a nonempty list')
    ids = [item['id'] for item in items]
    require(all(isinstance(value, str) and value for value in ids), name + ' has an invalid ID')
    require(len(ids) == len(set(ids)), name + ' has duplicate IDs')
    return set(ids)


def validate(chapter):
    require(chapter['id'] == 'nanjing-first-release', 'Unexpected chapter')
    require(chapter['targetSeconds'] == [120, 180], 'Unexpected target duration')
    states = unique_ids(chapter['states'], 'states')
    require(states == STATES, 'Required story states changed')
    require(chapter['entry'] == 'office' and chapter['terminal'] == 'complete', 'Invalid endpoints')
    for state in chapter['states']:
        for key in ('goal', 'playerAction', 'feedback'):
            require(isinstance(state[key], str) and state[key].strip(), 'Empty state ' + key)
        require(type(state['checkpoint']) is bool, 'checkpoint must be boolean')
    transitions = chapter['transitions']
    require(isinstance(transitions, list) and transitions, 'Missing transitions')
    for edge in transitions:
        require(edge['from'] in states and edge['to'] in states, 'Dangling transition')
        require(edge['from'] != chapter['terminal'], 'Terminal state must end the chapter')
        require(isinstance(edge['event'], str) and edge['event'], 'Missing event')
        for key in ('requires', 'effects'):
            require(isinstance(edge[key], list) and all(isinstance(x, str) and x for x in edge[key]),
                    'Invalid transition ' + key)
    # Follow actual conditions, not just a graph that ignores required flags.
    start = (chapter['entry'], frozenset())
    queue, visited, adjacency = deque([start]), {start}, {}
    used_edges = set()
    while queue:
        node = queue.popleft()
        state, flags = node
        adjacency[node] = []
        for index, edge in enumerate(transitions):
            if edge['from'] == state and set(edge['requires']) <= flags:
                target = (edge['to'], flags | frozenset(edge['effects']))
                adjacency[node].append(target)
                used_edges.add(index)
                if target not in visited:
                    visited.add(target)
                    require(len(visited) <= 4096, 'Progression is too complex for this checker')
                    queue.append(target)
    require({state for state, _ in visited} == states, 'Unreachable story states or missing flags')
    require(len(used_edges) == len(transitions), 'Unreachable transitions')
    finished = {node for node in visited if node[0] == chapter['terminal']}
    require(finished, 'Chapter cannot finish')
    can_finish = set(finished)
    while True:
        grown = can_finish | {node for node, targets in adjacency.items() if any(t in can_finish for t in targets)}
        if grown == can_finish:
            break
        can_finish = grown
    require(visited <= can_finish, 'Reachable story branch cannot finish')
    for state in chapter['states']:
        common = set.intersection(*(set(flags) for sid, flags in visited if sid == state['id']))
        if 'enterFlags' in state:
            require(set(state['enterFlags']) == common, 'Incorrect inherited entry flags: ' + state['id'])
    if 'legalSnapshots' in chapter:
        require(set(chapter['legalSnapshots']) == states, 'Snapshot states differ from graph')
        for sid, snapshots in chapter['legalSnapshots'].items():
            require({frozenset(flags) for flags in snapshots} == {flags for state, flags in visited if state == sid},
                    'Snapshot flags differ from reachable graph: ' + sid)

    room = chapter['map']
    require(room['width'] == 24 and room['height'] == 16, 'Unexpected map size')

    def tile(value):
        require(isinstance(value, list) and len(value) == 2 and all(type(x) is int for x in value),
                'Invalid tile coordinate')
        require(0 <= value[0] < room['width'] and 0 <= value[1] < room['height'], 'Tile outside map')
        return tuple(value)

    blocked = [tile(value) for value in room['blockedTiles']]
    require(len(blocked) == len(set(blocked)), 'Duplicate blocked tiles')
    blocked = set(blocked)
    spawn = tile(room['spawn'])
    require(spawn not in blocked, 'Blocked spawn')
    queue, reachable = deque([spawn]), {spawn}
    while queue:
        x, y = queue.popleft()
        for target in ((x-1, y), (x+1, y), (x, y-1), (x, y+1)):
            if (0 <= target[0] < room['width'] and 0 <= target[1] < room['height']
                    and target not in blocked and target not in reachable):
                reachable.add(target)
                queue.append(target)
    unique_ids(room['objects'], 'objects')
    if 'interactionDirs' in chapter:
        require(set(chapter['interactionDirs']) == {obj['id'] for obj in room['objects']},
                'Interaction directions need all object IDs')
    require(sum(not obj['required'] for obj in room['objects']) >= 2, 'Need two optional observations')
    footprints = set()
    for obj in room['objects']:
        position, interact = tile(obj['tile']), tile(obj['interactionTile'])
        require(type(obj['required']) is bool, 'required must be boolean')
        require(interact in reachable, 'Unreachable interaction: ' + obj['id'])
        require(sum(abs(a-b) for a, b in zip(position, interact)) <= 1, 'Interaction too far: ' + obj['id'])
        if 'interactionDirs' in chapter:
            delta = (position[0] - interact[0], position[1] - interact[1])
            direction = {(0, -1): 'up', (0, 1): 'down', (-1, 0): 'left', (1, 0): 'right', (0, 0): 'any'}[delta]
            require(chapter['interactionDirs'][obj['id']] == direction, 'Interaction direction reversed: ' + obj['id'])
        footprint = [tile(value) for value in obj['footprint']]
        require(footprint and len(footprint) == len(set(footprint)), 'Invalid object footprint')
        require(position in footprint and set(footprint) <= blocked, 'Footprint differs from collision map')
        footprints.update(footprint)
    require(footprints == blocked, 'Collision tiles need explicit furniture ownership')
    actors = unique_ids(chapter['actors'], 'actors')
    require({'player', 'cto'} <= actors, 'Required actors missing')
    for actor in chapter['actors']:
        require(tile(actor['tile']) in reachable, 'Unreachable actor: ' + actor['id'])
    player = next(actor for actor in chapter['actors'] if actor['id'] == 'player')
    require(tile(player['tile']) == spawn, 'Player position differs from spawn')
    unique_ids(chapter['dialogues'], 'dialogues')
    for line in chapter['dialogues']:
        require(line['state'] in states, 'Dialogue references unknown state')
        require(line['speaker'] in actors | {'narrator', 'colleague'}, 'Unknown speaker')
        require(line['basis'] in {'fact_paraphrase', 'staging'}, 'Dialogue needs a factual/staging label')
        require(isinstance(line['text'], str) and line['text'].strip(), 'Empty dialogue')
    assets = unique_ids(chapter['assets'], 'assets')
    for obj in room['objects']:
        require(obj['assetId'] in assets, 'Object references unknown asset')
    for asset in chapter['assets']:
        require(asset['kind'] in {'sprite', 'tile', 'ui', 'audio'}, 'Unknown asset kind')
        if asset['kind'] == 'audio':
            require(type(asset['durationMs']) is int and asset['durationMs'] > 0, 'Audio needs durationMs')
            require('size' not in asset, 'Audio must not use pixel dimensions')
            continue
        size = asset['size']
        require(isinstance(size, list) and len(size) == 2 and all(type(x) is int and x > 0 for x in size),
                'Asset needs positive design dimensions')
    require(chapter['blockedHistoricalDetails'], 'Keep unresolved historical details explicit')
    return len(visited), len(reachable)


def main():
    try:
        path = Path(sys.argv[1]) if len(sys.argv) > 1 else GAME / 'design/chapter-01.json'
        nodes, tiles = validate(json.loads(path.read_text()))
        print(f'Design structure passed: {nodes} reachable story configurations, {tiles} reachable map tiles.')
        print('This checks design data, not implemented gameplay, art quality or author acceptance.')
        return 0
    except (OSError, ValueError, KeyError, TypeError) as error:
        print('Design check failed: ' + str(error), file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())

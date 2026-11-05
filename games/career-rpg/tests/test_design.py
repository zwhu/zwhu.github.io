"""Exercise blocked progress and unreachable map cases with small design fixtures."""
import copy
import runpy
import unittest
from pathlib import Path

validate = runpy.run_path(str(Path(__file__).resolve().parents[1] / 'scripts/check-design.py'))['validate']


def example():
    states = ['office', 'report', 'incident', 'investigation', 'restored', 'learning', 'complete']
    return {
        'id': 'nanjing-first-release', 'targetSeconds': [120, 180], 'entry': 'office', 'terminal': 'complete',
        'states': [{'id': state, 'goal': '继续探索', 'playerAction': '交互', 'feedback': '继续', 'checkpoint': True}
                   for state in states],
        'transitions': [{'from': start, 'to': end, 'event': 'next_' + start,
                         'requires': ['done_' + states[i-1]] if i else [], 'effects': ['done_' + start]}
                        for i, (start, end) in enumerate(zip(states, states[1:]))],
        'map': {'width': 24, 'height': 16, 'spawn': [1, 1], 'blockedTiles': [[2, 2], [3, 2]],
                'objects': [{'id': name, 'tile': [x, 2], 'interactionTile': [x, 1], 'required': False,
                             'footprint': [[x, 2]], 'assetId': 'player'}
                            for name, x in [('book', 2), ('mug', 3)]]},
        'actors': [{'id': 'player', 'tile': [1, 1]}, {'id': 'cto', 'tile': [4, 1]}],
        'dialogues': [{'id': 'report', 'state': 'report', 'speaker': 'narrator',
                       'basis': 'fact_paraphrase', 'text': '有用户无法登录。'}],
        'assets': [{'id': 'player', 'kind': 'sprite', 'size': [16, 24]}],
        'blockedHistoricalDetails': ['故障根因未确认'],
    }


class DesignTests(unittest.TestCase):
    def setUp(self):
        self.design = example()

    def test_valid_design_can_finish_with_flags_and_reachable_interactions(self):
        self.assertEqual(validate(self.design), (7, 382))

    def test_graph_edge_does_not_make_an_unproducible_flag_reachable(self):
        self.design['transitions'][0]['requires'] = ['never_created']
        with self.assertRaisesRegex(ValueError, 'Unreachable'):
            validate(self.design)

    def test_one_reachable_dead_branch_fails_even_if_another_branch_finishes(self):
        self.design['transitions'].append({'from': 'office', 'to': 'restored', 'event': 'bad_skip',
                                           'requires': [], 'effects': []})
        with self.assertRaisesRegex(ValueError, 'cannot finish'):
            validate(self.design)

    def test_walkable_but_sealed_interaction_is_rejected(self):
        self.design['map']['blockedTiles'] = [[2, 0], [1, 1], [3, 1], [2, 2]]
        self.design['map']['spawn'] = [0, 0]
        self.design['actors'][0]['tile'] = [0, 0]
        with self.assertRaisesRegex(ValueError, 'Unreachable interaction'):
            validate(self.design)

    def test_out_of_bounds_and_blocked_spawn_are_rejected(self):
        original = copy.deepcopy(self.design)
        for coordinate, message in [([24, 1], 'outside map'), ([1, 1], 'Blocked spawn')]:
            with self.subTest(coordinate=coordinate):
                self.design = copy.deepcopy(original)
                self.design['map']['blockedTiles'].append(coordinate)
                with self.assertRaisesRegex(ValueError, message):
                    validate(self.design)

    def test_duplicate_state_and_missing_speaker_are_rejected(self):
        original = copy.deepcopy(self.design)
        self.design['states'].append(copy.deepcopy(self.design['states'][0]))
        with self.assertRaisesRegex(ValueError, 'duplicate IDs'):
            validate(self.design)
        self.design = original
        self.design['dialogues'][0]['speaker'] = 'unknown_person'
        with self.assertRaisesRegex(ValueError, 'Unknown speaker'):
            validate(self.design)

    def test_visual_asset_and_collision_ownership_must_match(self):
        self.design['map']['objects'][0]['assetId'] = 'missing_desk'
        with self.assertRaisesRegex(ValueError, 'unknown asset'):
            validate(self.design)
        self.design = example()
        self.design['map']['blockedTiles'].append([9, 9])
        with self.assertRaisesRegex(ValueError, 'ownership'):
            validate(self.design)

    def test_audio_has_duration_rather_than_fake_pixel_dimensions(self):
        self.design['assets'].append({'id': 'click', 'kind': 'audio', 'durationMs': 80})
        validate(self.design)
        self.design['assets'][-1]['size'] = [1, 1]
        with self.assertRaisesRegex(ValueError, 'pixel dimensions'):
            validate(self.design)

    def test_entry_flags_include_inherited_ancestors_not_just_immediate_effects(self):
        self.design['states'][-1]['enterFlags'] = ['done_learning']
        with self.assertRaisesRegex(ValueError, 'inherited entry flags'):
            validate(self.design)

    def test_snapshot_table_cannot_drop_a_flag_from_a_reachable_configuration(self):
        self.design['legalSnapshots'] = {sid['id']: [[]] for sid in self.design['states']}
        with self.assertRaisesRegex(ValueError, 'Snapshot flags differ'):
            validate(self.design)

    def test_player_faces_the_object_from_the_interaction_tile(self):
        self.design['interactionDirs'] = {'book': 'down', 'mug': 'down'}
        validate(self.design)
        self.design['interactionDirs']['book'] = 'up'
        with self.assertRaisesRegex(ValueError, 'direction reversed'):
            validate(self.design)


if __name__ == '__main__':
    unittest.main()

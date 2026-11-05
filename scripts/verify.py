#!/usr/bin/env python3
"""Run the same read-only repository checks locally and in CI."""
import shlex
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def checks():
    python = sys.executable
    return [
        ('Shared HTML and catalogs', [python, 'scripts/render-site.py', '--check']),
        ('Site generation contracts', [python, 'scripts/test-site-generation.py']),
        ('Local links and anchors', [python, 'scripts/check-links.py']),
        ('Link checker tests', [python, 'scripts/test-links.py']),
        ('Learning style ownership', [python, 'scripts/check-learning-styles.py']),
        ('Loading budgets and analytics', [python, 'scripts/check-performance.py']),
        ('Share images', [python, 'scripts/render-og-images.py', '--check']),
        ('About ability map', [python, 'scripts/render-about-map.py', '--check']),
        ('SEO metadata', [python, 'scripts/update-seo.py', '--check']),
        ('SEO contracts', [python, 'scripts/test-seo.py']),
        ('Comment behavior', ['node', '--test', 'tests/comments.test.cjs']),
        ('Career RPG chapter rules', ['node', '--test', 'games/career-rpg/web/tests/world.test.mjs', 'games/career-rpg/web/tests/story.test.mjs', 'games/career-rpg/web/tests/scene.test.mjs', 'games/career-rpg/web/tests/hefei.test.mjs', 'games/career-rpg/web/tests/hefei-skills.test.mjs']),
        ('Verify runner tests', [python, 'scripts/test-verify.py']),
    ]


def run_checks(steps, root=ROOT):
    failed = []
    for label, command in steps:
        print(f'\n[{label}] {shlex.join(command)}', flush=True)
        try:
            code = subprocess.run(command, cwd=root, check=False).returncode
        except OSError as error:
            print(f'Cannot run check: {error}', file=sys.stderr, flush=True)
            code = 1
        if code:
            failed.append(label)
    if failed:
        print('\nVerification failed: ' + ', '.join(failed), file=sys.stderr, flush=True)
        return 1
    print(f'\nVerification passed ({len(steps)} checks).', flush=True)
    return 0


if __name__ == '__main__':
    sys.exit(run_checks(checks()))

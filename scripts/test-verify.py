#!/usr/bin/env python3
"""Verify failure propagation and working-directory handling with real processes."""
import contextlib
import io
import runpy
import sys
import tempfile
import unittest
from pathlib import Path

VERIFY = runpy.run_path(str(Path(__file__).with_name('verify.py')))['run_checks']


class VerifyTests(unittest.TestCase):
    def run_checks(self, steps, root):
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            return VERIFY(steps, root)

    def test_runs_from_repository_directory_and_propagates_failure_without_stopping(self):
        with tempfile.TemporaryDirectory(prefix='zwhu-verify-') as directory:
            root = Path(directory)
            (root / 'present.txt').write_text('present')
            steps = [
                ('failure', [sys.executable, '-c', 'raise SystemExit(7)']),
                ('later check', [sys.executable, '-c',
                                 'from pathlib import Path; Path("result.txt").write_text(Path("present.txt").read_text())']),
            ]
            self.assertEqual(self.run_checks(steps, root), 1)
            self.assertEqual((root / 'result.txt').read_text(), 'present')

    def test_all_successful_checks_return_zero(self):
        self.assertEqual(self.run_checks([('success', [sys.executable, '-c', 'pass'])], Path.cwd()), 0)

    def test_unavailable_command_fails_and_later_checks_still_run(self):
        with tempfile.TemporaryDirectory(prefix='zwhu-verify-') as directory:
            root = Path(directory)
            steps = [
                ('unavailable', [str(root / 'missing-executable')]),
                ('later check', [sys.executable, '-c', 'from pathlib import Path; Path("ran.txt").touch()']),
            ]
            self.assertEqual(self.run_checks(steps, root), 1)
            self.assertTrue((root / 'ran.txt').is_file())


if __name__ == '__main__':
    unittest.main()

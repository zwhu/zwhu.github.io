"""Keep repository authoring inputs separate from the GitHub Pages publish root."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITE_ROOT = ROOT / 'docs'


def site_root(root=ROOT):
    return Path(root) / 'docs'


def public_content(root=ROOT):
    """Publish existing content URLs; edit only the authoring files under content/."""
    root = Path(root)
    return {site_root(root) / path.relative_to(root): path.read_bytes()
            for path in sorted((root / 'content').rglob('*')) if path.is_file()}

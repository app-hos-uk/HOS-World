#!/usr/bin/env python3
"""Fix corrupted theme classes from substring replacement bugs."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "src"

# Order matters: longest patterns first
FIXES = [
    (r"500/100/100", "500"),
    (r"500/100/15", "500/15"),
    (r"500/100/10", "500/10"),
    (r"500/100", "500/10"),
    (r"hover:bg-amber-500(?!\/)", "hover:bg-amber-600"),
    (r"hover:bg-amber-600/10", "hover:bg-amber-600"),
]


def process_file(path: Path) -> bool:
    content = path.read_text(encoding="utf-8")
    original = content
    for pattern, replacement in FIXES:
        content = re.sub(pattern, replacement, content)
    if content != original:
        path.write_text(content, encoding="utf-8")
        return True
    return False


def main():
    changed = []
    for path in sorted(list(ROOT.rglob("*.tsx")) + list(ROOT.rglob("*.css"))):
        if process_file(path):
            changed.append(str(path.relative_to(ROOT.parent)))
    print(f"Fixed {len(changed)} files")


if __name__ == "__main__":
    main()

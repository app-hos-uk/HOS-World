#!/usr/bin/env python3
"""Apply reference storefront font class names across apps/web/src."""

from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1] / "src"
SKIP_FILES = {"AdminLayout.tsx"}

REPLACEMENTS = [
    (r"font-cinzel", "font-display"),
    (r"font-lora", "font-body"),
    (r"font-\[family-name:var\(--font-cinzel\)\]", "font-display"),
    (r"font-\[family-name:var\(--font-lora\)\]", "font-body"),
    (r"text-\[#0D0D0D\]", "text-[#1a1406]"),
]

# font-inter -> font-ui except admin layout files
INTER_SKIP = {"AdminLayout.tsx", "admin/"}


def should_skip_inter(path: Path) -> bool:
    s = str(path)
    return any(x in s for x in INTER_SKIP)


def main() -> None:
    changed = 0
    for path in ROOT.rglob("*.tsx"):
        if path.name in SKIP_FILES:
            continue
        text = path.read_text(encoding="utf-8")
        original = text
        for old, new in REPLACEMENTS:
            text = re.sub(old, new, text)
        if not should_skip_inter(path):
            text = re.sub(r"font-inter", "font-ui", text)
        if text != original:
            path.write_text(text, encoding="utf-8")
            changed += 1
            print(f"updated: {path.relative_to(ROOT.parent)}")
    print(f"Done. {changed} files updated.")


if __name__ == "__main__":
    main()

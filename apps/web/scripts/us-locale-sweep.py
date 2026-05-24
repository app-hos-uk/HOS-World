#!/usr/bin/env python3
"""Replace UK locale references with US equivalents in apps/web/src."""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "src"

# Skip protected admin account references
SKIP_SUBSTRINGS = ("app@houseofspells.co.uk",)

REPLACEMENTS: list[tuple[str, str]] = [
    ("GBP · English (UK)", "USD · English (US)"),
    ("English (UK)", "English (US)"),
    ("UK shipping", "US shipping"),
    ("Fast UK delivery", "Fast US delivery"),
    ("across the UK", "across the US"),
    ("in our UK stores", "in our US stores"),
    ("trusted UK vendors", "trusted US vendors"),
    ("Help centre", "Help Center"),
    ("Loyalty Programme", "Loyalty Program"),
    ("Ambassador programme", "Ambassador program"),
    ("ambassador programme", "ambassador program"),
    ("loyalty programme", "loyalty program"),
    ("the programme", "the program"),
    ("Programme health", "Program health"),
    ("Programme Health", "Program Health"),
    ("Programme dashboard", "Program dashboard"),
    ("Loyalty Programme Management", "Loyalty Program Management"),
    ("fan-favourite", "fan-favorite"),
    ("House colours", "House colors"),
    ("cosy", "cozy"),
    ("jewellery", "jewelry"),
    ("info@houseofspells.co.uk", "info@houseofspells.com"),
    ("Three Broomsticks UK", "Three Broomsticks Co."),
    ("1 pt per £1", "1 pt per $1"),
    ("Marketplace%20vendor%20enquiry", "Marketplace%20vendor%20inquiry"),
    ("vendor enquiry", "vendor inquiry"),
    ("?? 'GBP'", "?? 'USD'"),
    ("useState('GBP')", "useState('USD')"),
    ("e.g. £5 Discount", "e.g. $5 Discount"),
]

# Currency symbol in template literals / JSX
POUND_TO_DOLLAR = re.compile(r"£(\{?)")

def should_skip(text: str) -> bool:
    return any(s in text for s in SKIP_SUBSTRINGS)


def transform(content: str) -> str:
    if should_skip(content) and "info@houseofspells" not in content and "GBP" not in content:
        # Still process files that only contain protected emails alongside other UK refs
        pass
    out = content
    for old, new in REPLACEMENTS:
        out = out.replace(old, new)
    out = POUND_TO_DOLLAR.sub(r"$\1", out)
    return out


def main() -> None:
    changed: list[str] = []
    for path in sorted(ROOT.rglob("*")):
        if not path.is_file():
            continue
        if path.suffix not in {".tsx", ".ts", ".jsx", ".js", ".md", ".json"}:
            continue
        original = path.read_text(encoding="utf-8")
        updated = transform(original)
        if updated != original:
            path.write_text(updated, encoding="utf-8")
            changed.append(str(path.relative_to(ROOT.parent)))
    print(f"Updated {len(changed)} files")
    for p in changed:
        print(f"  {p}")


if __name__ == "__main__":
    main()

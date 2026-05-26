#!/usr/bin/env python3
"""Ensure all form controls and table data text use readable dark-theme classes."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "src"

FORM_TAG_RE = re.compile(
    r"<(input|select|textarea)\b([\s\S]*?)(/?>)",
    re.IGNORECASE,
)
CLASS_RE = re.compile(
    r'className=(?:\{`([\s\S]*?)`\}|\{"([^"]*)"\}|"([^"]*)")',
)
SKIP_INPUT_TYPES = {
    "hidden",
    "checkbox",
    "radio",
    "submit",
    "button",
    "reset",
    "image",
    "file",
}
BG_RE = re.compile(r"\bbg-(?:hos-bg|transparent|\[)")
TEXT_RE = re.compile(r"\btext-(?:hos-text|white|gray|red|green|yellow|blue|amber|orange|purple|cyan|emerald|\[)")
PLACEHOLDER_RE = re.compile(r"\bplaceholder-hos-text-muted\b")
FOCUS_OUTLINE_RE = re.compile(r"\bfocus:outline-none\b")
FOCUS_BORDER_RE = re.compile(r"\bfocus:border-hos-gold\b")
BORDER_HOS_RE = re.compile(r"\bborder-hos-border\b")
LEGACY_BORDER_RE = re.compile(r"\bborder\b(?:\s+\bborder-\S+\b)?\s+\brounded")

FORM_AUGMENT = [
    "bg-hos-bg-secondary",
    "text-hos-text-secondary",
    "placeholder-hos-text-muted",
    "focus:outline-none",
    "focus:border-hos-gold",
]

# Table / data cell text (not buttons/badges)
TABLE_TEXT_REPLACEMENTS = [
    (r"(?<![\w-])text-sm font-medium text-white(?![\w-])", "text-sm font-medium text-hos-text-secondary"),
    (r"(?<![\w-])text-sm text-white(?![\w-])", "text-sm text-hos-text-secondary"),
    (r"(?<![\w-])font-medium text-white(?![\w-])", "font-medium text-hos-text-secondary"),
    (r"hover:text-white(?![/\w])", "hover:text-hos-gold"),
    (r"(?<![\w-])text-xl font-bold text-white(?![\w-])", "text-xl font-bold text-hos-text-secondary"),
    (r"(?<![\w-])text-2xl font-bold text-white(?![\w-])", "text-2xl font-bold text-hos-text-secondary"),
    (r"(?<![\w-])text-lg font-semibold text-white(?![\w-])", "text-lg font-semibold text-hos-text-secondary"),
    (r"(?<![\w-])text-lg font-medium text-white(?![\w-])", "text-lg font-medium text-hos-text-secondary"),
]

# Headings in dashboard pages often use bare text-white
HEADING_REPLACEMENTS = [
    (
        r'(<h1[^>]*className="[^"]*)\btext-white\b',
        r"\1text-hos-text-secondary",
    ),
    (
        r'(<h2[^>]*className="[^"]*)\btext-white\b',
        r"\1text-hos-text-secondary",
    ),
    (
        r'(<h3[^>]*className="[^"]*)\btext-white\b',
        r"\1text-hos-text-secondary",
    ),
    (
        r'(<h4[^>]*className="[^"]*)\btext-white\b',
        r"\1text-hos-text-secondary",
    ),
]

# Status badge fallback inside tables
BADGE_FALLBACK_RE = re.compile(
    r"bg-hos-bg-tertiary text-white(?![/\w])",
)

# Legacy generic borders on form controls — unused, handled in augment
LEGACY_FORM_BORDER = re.compile(
    r'className="([^"]*\bborder\b[^"]*\brounded[^"]*)"',
)


def _input_type(attrs: str) -> str | None:
    m = re.search(r'type="([^"]+)"', attrs, re.I)
    return m.group(1).lower() if m else None


def _should_skip_form(attrs: str, tag: str) -> bool:
    typ = _input_type(attrs)
    if tag.lower() == "input" and typ in SKIP_INPUT_TYPES:
        return True
    if "type='hidden'" in attrs or "type='checkbox'" in attrs:
        return True
    return False


def _extract_class(match: re.Match[str]) -> str | None:
    return match.group(1) or match.group(2) or match.group(3)


def _normalize_class(cls: str) -> str:
    return " ".join(cls.split())


def _augment_form_class(cls: str, tag: str) -> str:
    cls = _normalize_class(cls)
    if not cls or "PORTAL_" in cls or cls in {"input", "select"}:
        return cls

    is_formish = (
        BORDER_HOS_RE.search(cls)
        or LEGACY_BORDER_RE.search(cls)
        or ("px-" in cls and ("py-" in cls or "p-" in cls) and "border" in cls)
    )
    if not is_formish:
        return cls

    has_custom_bg = bool(BG_RE.search(cls))
    parts = cls.split()

    if not has_custom_bg and "bg-hos-bg-secondary" not in parts:
        parts.append("bg-hos-bg-secondary")

    if not TEXT_RE.search(cls):
        parts.append("text-hos-text-secondary")

    if tag.lower() != "select" and not PLACEHOLDER_RE.search(cls):
        parts.append("placeholder-hos-text-muted")

    if not FOCUS_OUTLINE_RE.search(cls):
        parts.append("focus:outline-none")

    if not FOCUS_BORDER_RE.search(cls) and "focus:ring" in cls:
        parts.append("focus:border-hos-gold")

    # Legacy generic border → hos border token
    if "border" in cls and not BORDER_HOS_RE.search(cls):
        if not re.search(r"\bborder-(?:red|green|gray|blue|amber|yellow|orange|purple)", cls):
            if "border-hos-border" not in parts:
                parts.append("border-hos-border")

    # De-dupe preserving order
    seen: set[str] = set()
    deduped: list[str] = []
    for p in parts:
        if p not in seen:
            seen.add(p)
            deduped.append(p)
    return " ".join(deduped)


def _replace_class_in_attrs(attrs: str, new_cls: str) -> str:
    def repl(match: re.Match[str]) -> str:
        if match.group(1) is not None:
            # className={`...`}
            return f"className={{`{new_cls}`}}"
        if match.group(2) is not None:
            # className={"..."}
            return f'className={{"{new_cls}"}}'
        # className="..."
        return f'className="{new_cls}"'

    return CLASS_RE.sub(repl, attrs, count=1)


def process_form_controls(content: str) -> tuple[str, int]:
    changes = 0

    def replacer(match: re.Match[str]) -> str:
        nonlocal changes
        tag, attrs, closing = match.group(1), match.group(2), match.group(3)
        if _should_skip_form(attrs, tag):
            return match.group(0)
        cm = CLASS_RE.search(attrs)
        if not cm:
            return match.group(0)
        old_cls = _extract_class(cm)
        if old_cls is None:
            return match.group(0)
        new_cls = _augment_form_class(old_cls, tag)
        if new_cls == _normalize_class(old_cls):
            return match.group(0)
        changes += 1
        new_attrs = _replace_class_in_attrs(attrs, new_cls)
        return f"<{tag}{new_attrs}{closing}"

    return FORM_TAG_RE.sub(replacer, content), changes


def _is_protected_white_line(line: str) -> bool:
    """Keep text-white on colored buttons, gold CTAs, and semantic badges."""
    protected = (
        "bg-red-",
        "bg-green-",
        "bg-blue-",
        "bg-hos-gold",
        "text-[#",
        "bg-yellow-",
        "bg-orange-",
        "bg-purple-",
        "text-green-",
        "text-red-",
        "text-yellow-",
        "text-hos-gold",
        "Admin Panel",
        "chart-title",
        "modal-title",
        "badge",
        "rounded-full",
        "animate-spin",
        "bg-black",
        "from-purple",
        "bg-gradient",
    )
    lower = line.lower()
    return any(p.lower() in lower for p in protected)


def process_table_and_heading_text(content: str) -> tuple[str, int]:
    changes = 0
    original = content

    content = BADGE_FALLBACK_RE.sub("bg-hos-bg-tertiary text-hos-text-secondary", content)
    if content != original:
        changes += 1
        original = content

    for pattern, repl in TABLE_TEXT_REPLACEMENTS:
        if repl is None:
            continue
        updated, n = re.subn(pattern, repl, content)
        if n:
            changes += n
            content = updated

    for pattern, repl in HEADING_REPLACEMENTS:
        updated, n = re.subn(pattern, repl, content)
        if n:
            changes += n
            content = updated

    # Line-safe pass for remaining table-ish text-white
    lines = content.split("\n")
    new_lines: list[str] = []
    for line in lines:
        if "text-white" in line and not _is_protected_white_line(line):
            if any(
                token in line
                for token in (
                    "<td",
                    "<th",
                    "<tr",
                    "<p ",
                    "<span",
                    "<div",
                    "font-medium",
                    "font-semibold",
                    "font-bold",
                    "<h1",
                    "<h2",
                    "<h3",
                    "<h4",
                    "table",
                )
            ):
                new_line = line
                # Don't touch template literals with dynamic status colors
                if "${" not in line or "text-white" in line.split("${")[0]:
                    new_line = re.sub(
                        r"(?<![\w-])text-white(?![/\w-])",
                        "text-hos-text-secondary",
                        new_line,
                    )
                if new_line != line:
                    changes += 1
                new_lines.append(new_line)
                continue
        new_lines.append(line)
    content = "\n".join(new_lines)

    return content, changes


def process_secondary_text_on_dark_bg(content: str) -> tuple[str, int]:
    """Replace text-white when paired with dark hos backgrounds (not colored CTAs)."""
    changes = 0
    replacements = [
        (r"bg-hos-bg-secondary text-white", "bg-hos-bg-secondary text-hos-text-secondary"),
        (r"bg-hos-surface text-white", "bg-hos-surface text-hos-text-secondary"),
        (r"whitespace-pre-wrap text-white", "whitespace-pre-wrap text-hos-text-secondary"),
        (r"placeholder-hos-text-muted text-white", "placeholder-hos-text-muted text-hos-text-secondary"),
        (r"border border-hos-border text-white rounded-lg", "border border-hos-border text-hos-text-secondary rounded-lg"),
        (r"className=\"text-white hover:text-hos-gold", 'className="text-hos-text-secondary hover:text-hos-gold'),
        (r"'text-white' : 'text-hos-text-muted'", "'text-hos-text-secondary' : 'text-hos-text-muted'"),
        (r": 'text-white'", ": 'text-hos-text-secondary'"),
        (r"\? 'text-white'", "? 'text-hos-text-secondary'"),
    ]
    for pattern, repl in replacements:
        updated, n = re.subn(pattern, repl, content)
        if n:
            changes += n
            content = updated
    return content, changes


BARE_FORM_SUFFIX = (
    " bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted "
    "focus:outline-none focus:border-hos-gold"
)

BARE_FORM_PATTERNS = [
    r'(className="(?:w-full |flex-1 )?[^"]*border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50)(?!"[^"]*bg-hos-bg)',
    r'(className="(?:w-full |flex-1 )?[^"]*border border-hos-border rounded-lg focus:ring-hos-gold/50 focus:border-hos-gold)(?!"[^"]*bg-hos-bg)',
    r'(className="(?:w-full |flex-1 )?[^"]*px-4 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50)(?!"[^"]*bg-hos-bg)',
    r'(className="w-full px-4 py-2 border border-hos-border rounded-lg focus:outline-none focus:ring-2 focus:ring-hos-gold/50)(?!"[^"]*bg-hos-bg)',
    r'(className="w-full pl-10 pr-4 py-2\.5 border border-hos-border rounded-lg text-sm focus:ring-hos-gold/50 focus:border-hos-gold)(?!"[^"]*bg-hos-bg)',
]


def process_bare_form_class_strings(content: str) -> tuple[str, int]:
    changes = 0
    for pat in BARE_FORM_PATTERNS:

        def repl(m: re.Match[str]) -> str:
            nonlocal changes
            s = m.group(1)
            if "bg-hos-bg" in s or "text-hos-text" in s:
                return s + '"'
            changes += 1
            return s + BARE_FORM_SUFFIX + '"'

        content = re.sub(pat + r'"', repl, content)
    return content, changes


def process_file(path: Path) -> bool:
    content = path.read_text(encoding="utf-8")
    original = content
    total = 0

    content, n = process_form_controls(content)
    total += n
    content, n = process_table_and_heading_text(content)
    total += n
    content, n = process_secondary_text_on_dark_bg(content)
    total += n
    content, n = process_bare_form_class_strings(content)
    total += n

    if content != original:
        path.write_text(content, encoding="utf-8")
        print(f"  {path.relative_to(ROOT.parent)} ({total} fixes)")
        return True
    return False


def _test_replace_class_in_attrs() -> None:
    new_cls = "border border-hos-border bg-hos-bg-secondary text-hos-text-secondary"
    cases = [
        (
            'className="border rounded-lg"',
            f'className="{new_cls}"',
        ),
        (
            'className={"border rounded-lg"}',
            f'className={{"{new_cls}"}}',
        ),
        (
            'className={`border rounded-lg`}',
            f"className={{`{new_cls}`}}",
        ),
    ]
    for attrs, expected in cases:
        got = _replace_class_in_attrs(attrs, new_cls)
        assert got == expected, f"attrs={attrs!r}\nexpected={expected!r}\ngot={got!r}"


def main() -> None:
    import sys

    if "--test" in sys.argv:
        _test_replace_class_in_attrs()
        print("form-field-sweep: all className replacement tests passed")
        return
    changed = 0
    for path in sorted(ROOT.rglob("*.tsx")):
        if process_file(path):
            changed += 1
    print(f"\nUpdated {changed} files")


if __name__ == "__main__":
    main()

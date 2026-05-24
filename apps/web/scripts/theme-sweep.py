#!/usr/bin/env python3
"""Bulk replace stale light-theme Tailwind classes with hos-* dark theme classes."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "src"

# Order matters: longer/more specific patterns first
REPLACEMENTS = [
    # Opacity variants
    (r"bg-gray-50/50", "bg-hos-bg-secondary/50"),
    (r"hover:bg-gray-50/50", "hover:bg-hos-bg-tertiary/50"),
    (r"bg-white/50", "bg-hos-bg-secondary/50"),
    (r"bg-white/80", "bg-hos-bg-secondary/80"),
    (r"bg-white/90", "bg-hos-bg-secondary/90"),
    (r"hover:bg-white/10", "hover:bg-hos-bg-tertiary/50"),
    # Purple focus rings
    (r"focus:ring-purple-500", "focus:ring-hos-gold/50"),
    (r"focus:ring-purple-300", "focus:ring-hos-gold/30"),
    (r"peer-focus:ring-purple-300", "peer-focus:ring-hos-gold/30"),
    (r"ring-purple-300", "ring-hos-gold/30"),
    (r"border-t-purple-600", "border-t-hos-gold"),
    (r"border-purple-200", "border-hos-border-accent"),
    (r"border-purple-300", "border-hos-border-accent"),
    (r"hover:border-purple-200", "hover:border-hos-border-accent"),
    (r"hover:border-purple-300", "hover:border-hos-border-accent"),
    (r"divide-purple-100", "divide-hos-border"),
    # Purple backgrounds/text
    (r"peer-checked:bg-purple-600", "peer-checked:bg-hos-gold"),
    (r"active:bg-purple-800", "active:bg-hos-gold-hover"),
    (r"hover:bg-purple-800", "hover:bg-hos-gold-hover"),
    (r"hover:bg-purple-700", "hover:bg-hos-gold-hover"),
    (r"bg-purple-800", "bg-hos-gold-hover"),
    (r"bg-purple-700", "bg-hos-gold-hover"),
    (r"bg-purple-600", "bg-hos-gold"),
    (r"bg-purple-500", "bg-hos-gold"),
    (r"bg-purple-100", "bg-hos-gold/20"),
    (r"bg-purple-50", "bg-hos-gold/10"),
    (r"hover:text-purple-900", "hover:text-hos-gold"),
    (r"hover:text-purple-800", "hover:text-hos-gold-hover"),
    (r"hover:text-purple-700", "hover:text-hos-gold-hover"),
    (r"hover:text-purple-600", "hover:text-hos-gold"),
    (r"text-purple-900", "text-hos-gold"),
    (r"text-purple-800", "text-hos-gold"),
    (r"text-purple-700", "text-hos-gold-hover"),
    (r"text-purple-600", "text-hos-gold"),
    (r"text-purple-500", "text-hos-gold"),
    # Blue → gold
    (r"bg-blue-600", "bg-hos-gold"),
    (r"bg-blue-100", "bg-hos-gold/20"),
    (r"text-blue-800", "text-hos-gold"),
    (r"text-blue-600", "text-hos-gold"),
    (r"text-blue-500", "text-hos-gold"),
    (r"hover:text-blue-600", "hover:text-hos-gold"),
    # Indigo
    (r"bg-indigo-600", "bg-hos-gold"),
    (r"text-indigo-600", "text-hos-gold"),
    # Gray backgrounds
    (r"hover:bg-gray-50", "hover:bg-hos-bg-tertiary"),
    (r"active:bg-gray-100", "active:bg-hos-bg-tertiary"),
    (r"hover:bg-gray-100", "hover:bg-hos-bg-tertiary"),
    (r"bg-gray-50", "bg-hos-bg-secondary"),
    (r"bg-gray-100", "bg-hos-bg-tertiary"),
    (r"bg-gray-200", "bg-hos-bg-tertiary"),
    (r"bg-white", "bg-hos-bg-secondary"),
    # Gray text
    (r"placeholder-gray-400", "placeholder-hos-text-muted"),
    (r"text-gray-900", "text-white"),
    (r"text-gray-800", "text-white"),
    (r"text-black", "text-white"),
    (r"text-gray-700", "text-hos-text-secondary"),
    (r"text-gray-600", "text-hos-text-secondary"),
    (r"text-gray-500", "text-hos-text-muted"),
    (r"text-gray-400", "text-hos-text-muted"),
    (r"hover:text-gray-900", "hover:text-white"),
    (r"hover:text-gray-700", "hover:text-hos-text-secondary"),
    # Gray borders/divides
    (r"divide-gray-200", "divide-hos-border"),
    (r"divide-gray-100", "divide-hos-border"),
    (r"divide-gray-50", "divide-hos-border"),
    (r"border-gray-300", "border-hos-border"),
    (r"border-gray-200", "border-hos-border"),
    (r"border-gray-100", "border-hos-border"),
    (r"focus:ring-hos-gold/50/20", "focus:ring-hos-gold/20"),
    (r"border-b-2 border-purple-600", "border-b-2 border-hos-gold"),
    (r"border-2 border-purple-600", "border-2 border-hos-gold"),
    (r"border-b-2 border-purple-700", "border-b-2 border-hos-gold"),
    (r"border-t-purple-700", "border-t-hos-gold"),
    (r"focus:border-purple-500", "focus:border-hos-gold"),
    (r"hover:border-purple-500", "hover:border-hos-gold"),
    (r"border-purple-600", "border-hos-gold"),
    (r"border-purple-500", "border-hos-gold"),
    (r"ring-purple-500", "ring-hos-gold/50"),
    (r"text-purple-200", "text-hos-gold/30"),
    (r"text-purple-100", "text-hos-text-secondary"),
    (r"from-purple-50 to-white", "from-hos-bg to-hos-bg-secondary"),
    (r"from-purple-50", "from-hos-bg"),
    (r"hover:bg-blue-700", "hover:bg-hos-gold-hover"),
    (r"bg-blue-50", "bg-hos-gold/10"),
    (r"border-blue-200", "border-hos-border-accent"),
    (r"bg-blue-500", "bg-hos-gold"),
    (r"hover:text-blue-700", "hover:text-hos-gold-hover"),
    (r"bg-hos-gold-hover text-white", "bg-hos-gold text-[#0D0D0D]"),
    (r"text-gray-300", "text-hos-text-muted"),
    (r"text-blue-700", "text-hos-gold"),
    (r"text-blue-900", "text-hos-gold"),
    (r"hover:bg-blue-200", "hover:bg-hos-gold/20"),
    (r"hover:bg-purple-200", "hover:bg-hos-gold/20"),
    (r"bg-purple-200", "bg-hos-gold/20"),
    (r"border-purple-100", "border-hos-border"),
    (r"border-purple-400", "border-hos-gold/50"),
    (r"text-purple-300", "text-hos-text-secondary"),
    (r"hover:text-blue-900", "hover:text-hos-gold-hover"),
    (r"bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600", "bg-hos-gold hover:bg-hos-gold-hover"),
    (r"bg-gradient-to-r from-purple-700 to-indigo-700", "bg-hos-gold"),
    (r"bg-gradient-to-r from-purple-600 to-indigo-600", "bg-hos-bg-secondary border border-hos-border"),
    (r"bg-gradient-to-r from-purple-600 to-purple-700", "bg-hos-bg-secondary border border-hos-border"),
    (r"from-purple-600 to-indigo-600", "from-hos-bg-secondary to-hos-bg-tertiary"),
    (r"from-purple-600 to-purple-700", "from-hos-bg-secondary to-hos-bg-tertiary"),
    (r"from-purple-700 to-indigo-800", "from-hos-bg-secondary to-hos-bg-tertiary"),
    (r"from-purple-600 to-purple-800", "from-hos-bg-secondary to-hos-bg-tertiary"),
    (r"from-purple-400 to-purple-600", "from-hos-gold/40 to-hos-gold"),
    (r"hover:from-purple-600 hover:to-indigo-600", "hover:from-hos-gold hover:to-hos-gold-hover"),
    (r"hover:from-purple-600", "hover:from-hos-gold-hover"),
    (r"hover:to-indigo-600", "hover:to-hos-gold-hover"),
    (r"border-indigo-600", "border-hos-gold"),
    (r"text-indigo-700", "text-hos-gold"),
    (r"text-indigo-800", "text-hos-gold"),
    (r"bg-indigo-100", "bg-hos-gold/20"),
    (r"bg-indigo-50", "bg-hos-gold/10"),
    (r"border-indigo-200", "border-hos-border-accent"),
    (r"border-indigo-500", "border-hos-gold"),
    (r"hover:bg-indigo-700", "hover:bg-hos-gold-hover"),
    (r"hover:bg-indigo-500", "hover:bg-hos-gold-hover"),
    (r"hover:text-indigo-800", "hover:text-hos-gold-hover"),
    (r"hover:text-indigo-700", "hover:text-hos-gold-hover"),
    (r"focus:border-indigo-500", "focus:border-hos-gold"),
    (r"focus:ring-indigo-500", "focus:ring-hos-gold/50"),
    (r"focus:ring-1 focus:ring-indigo-500", "focus:ring-1 focus:ring-hos-gold/50"),
    (r"ring-purple-400", "ring-hos-gold/50"),
    (r"ring-purple-200", "ring-hos-gold/30"),
    (r"ring-purple-600", "ring-hos-gold/50"),
    (r"ring-4 ring-purple-200", "ring-4 ring-hos-gold/30"),
    (r"border-l-purple-600", "border-l-hos-gold"),
    (r"to-purple-100", "to-hos-bg-tertiary"),
    (r"from-hos-bg0", "from-hos-bg-secondary"),
    (r"to-indigo-600", "to-hos-gold/30"),
    (r"bg-gray-900 text-white", "bg-hos-bg-tertiary text-white"),
    (r"hover:bg-gray-800", "hover:bg-hos-bg-secondary"),
    (r"to-blue-50", "to-hos-bg-secondary"),
    (r"placeholder-gray-500", "placeholder-hos-text-muted"),
    (r"hover:bg-gray-300", "hover:bg-hos-bg-tertiary"),
    (r"bg-gray-400", "bg-hos-text-muted"),
    (r"bg-gray-300", "bg-hos-bg-tertiary"),
    (r"bg-gray-600", "bg-hos-bg-tertiary"),
    (r"hover:bg-gray-700", "hover:bg-hos-bg-secondary"),
    (r"hover:bg-gray-600", "hover:bg-hos-bg-secondary"),
    (r"bg-gray-700", "bg-hos-bg-secondary"),
    (r"border-blue-300", "border-hos-border"),
    (r"from-blue-50 to-blue-100", "from-hos-bg-secondary to-hos-bg-tertiary"),
    (r"from-blue-50", "from-hos-bg-secondary"),
    (r"bg-gray-800", "bg-hos-surface"),
    (r"focus:ring-blue-500", "focus:ring-hos-gold/50"),
]

def process_file(path: Path) -> bool:
    content = path.read_text(encoding="utf-8")
    original = content
    for pattern, replacement in REPLACEMENTS:
        content = content.replace(pattern, replacement)
    if content != original:
        path.write_text(content, encoding="utf-8")
        return True
    return False


def main():
    changed = []
    for path in sorted(ROOT.rglob("*.tsx")):
        if process_file(path):
            changed.append(str(path.relative_to(ROOT.parent)))
    print(f"Updated {len(changed)} files")
    for f in changed[:50]:
        print(f"  {f}")
    if len(changed) > 50:
        print(f"  ... and {len(changed) - 50} more")


if __name__ == "__main__":
    main()

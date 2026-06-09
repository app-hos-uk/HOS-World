import type { TocItem } from '@/lib/blogHeadings';

interface TableOfContentsProps {
  items: TocItem[];
}

export function TableOfContents({ items }: TableOfContentsProps) {
  if (items.length < 2) return null;

  return (
    <nav aria-label="Table of contents" className="bg-hos-bg-secondary border border-hos-border rounded-xl p-5 mb-8">
      <h2 className="text-sm font-semibold text-hos-text-secondary uppercase tracking-wide mb-3">
        Table of Contents
      </h2>
      <ol className="space-y-2">
        {items.map((item) => (
          <li key={item.id} className={item.level === 3 ? 'ml-4' : ''}>
            <a
              href={`#${item.id}`}
              className="text-sm text-hos-text-muted hover:text-hos-gold transition-colors"
            >
              {item.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

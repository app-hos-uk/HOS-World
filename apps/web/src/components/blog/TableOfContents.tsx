'use client';

import { useEffect, useState } from 'react';

interface TocItem {
  id: string;
  text: string;
  level: number;
}

interface TableOfContentsProps {
  contentHtml: string;
}

export function TableOfContents({ contentHtml }: TableOfContentsProps) {
  const [items, setItems] = useState<TocItem[]>([]);

  useEffect(() => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(contentHtml, 'text/html');
    const headings = doc.querySelectorAll('h2, h3');
    const toc: TocItem[] = [];

    headings.forEach((heading, index) => {
      const text = heading.textContent?.trim();
      if (!text) return;
      const id = `section-${index}`;
      toc.push({
        id,
        text,
        level: heading.tagName === 'H2' ? 2 : 3,
      });
    });

    setItems(toc);
  }, [contentHtml]);

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

export function injectHeadingIds(html: string): string {
  let index = 0;
  return html.replace(/<(h[23])([^>]*)>(.*?)<\/\1>/gi, (_match, tag, attrs, content) => {
    const id = `section-${index++}`;
    if (attrs.includes('id=')) return `<${tag}${attrs}>${content}</${tag}>`;
    return `<${tag}${attrs} id="${id}">${content}</${tag}>`;
  });
}

'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/lib/api';

const SVG_SAFE_TAGS = new Set([
  'svg', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon',
  'ellipse', 'g', 'defs', 'use', 'text', 'tspan',
]);

function sanitizeSvg(raw: string): string {
  const parser = typeof DOMParser !== 'undefined' ? new DOMParser() : null;
  if (!parser) return '';
  const doc = parser.parseFromString(raw, 'image/svg+xml');
  const svg = doc.querySelector('svg');
  if (!svg) return '';

  function cleanNode(node: Element) {
    const children = Array.from(node.children);
    for (const child of children) {
      if (!SVG_SAFE_TAGS.has(child.tagName.toLowerCase())) {
        child.remove();
      } else {
        const attrs = Array.from(child.attributes);
        for (const attr of attrs) {
          if (attr.name.startsWith('on') || attr.value.includes('javascript:')) {
            child.removeAttribute(attr.name);
          }
        }
        cleanNode(child);
      }
    }
  }
  cleanNode(svg);
  return svg.outerHTML;
}

interface Department {
  id: string;
  name: string;
  slug: string;
  description?: string;
  meta?: string;
  ctaText?: string;
  ctaUrl: string;
  iconSvg?: string;
}

export default function BrowseByDepartment() {
  const [departments, setDepartments] = useState<Department[]>([]);

  useEffect(() => {
    apiClient
      .getDepartments()
      .then((res) => {
        if (res?.data?.length) setDepartments(res.data);
      })
      .catch(() => {
        /* silent — section simply won't render */
      });
  }, []);

  if (departments.length === 0) return null;

  return (
    <section className="max-w-7xl mx-auto px-4 py-8 sm:py-12">
      <div className="flex items-end justify-between mb-8 gap-4">
        <div>
          <p className="text-hos-gold-dim text-[11px] uppercase tracking-[0.1em] font-ui font-semibold">
            Shop the aisles
          </p>
          <h2 className="font-display text-hos-gold-hover text-2xl md:text-3xl mt-1">
            Browse by department
          </h2>
          <p className="text-hos-text-secondary text-sm mt-1 font-body">
            Same marketplace checkout — pick a lane and dive into what vendors stock for your fandom.
          </p>
        </div>
        <Link
          href="/products"
          className="text-hos-gold text-sm font-ui font-semibold hover:text-hos-gold-hover transition-colors shrink-0"
        >
          View all deals →
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
        {departments.map((dept) => (
          <Link key={dept.id} href={dept.ctaUrl} className="dept-card group">
            <div
              className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_90%_70%_at_15%_-10%,rgba(201,162,39,0.14),transparent_52%)]"
              aria-hidden
            />
            {dept.iconSvg && (
              <div
                className="dept-card-icon"
                dangerouslySetInnerHTML={{ __html: sanitizeSvg(dept.iconSvg) }}
              />
            )}
            <div className="relative z-10 min-w-0">
              {dept.meta && (
                <span className="block text-hos-gold-dim text-[10px] uppercase tracking-[0.1em] font-ui font-semibold mb-2">
                  {dept.meta}
                </span>
              )}
              <h3 className="font-display text-hos-gold-hover text-xl md:text-2xl mb-2.5">
                {dept.name}
              </h3>
              {dept.description && (
                <p className="text-hos-text-secondary text-[15px] leading-relaxed mb-3.5 font-body">
                  {dept.description}
                </p>
              )}
              {dept.ctaText && (
                <span className="font-ui text-[13px] font-bold text-hos-gold group-hover:text-hos-gold-hover transition-colors">
                  {dept.ctaText}
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

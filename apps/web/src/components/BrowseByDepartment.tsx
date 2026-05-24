'use client';

import Link from 'next/link';

const DEPARTMENTS = [
  {
    id: 'collectables',
    meta: '2.4k+ listings · props & figures',
    title: 'Collectables & replicas',
    description: 'Wands, statuettes, prop replicas, pins, and glass‑cabinet pieces from rated sellers.',
    cta: 'Shop collectables',
    href: '/products?category=collectibles',
    icon: (
      <svg viewBox="0 0 64 64" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M32 8 L38 26 L56 28 L42 40 L46 58 L32 48 L18 58 L22 40 L8 28 L26 26 Z" />
      </svg>
    ),
  },
  {
    id: 'apparel',
    meta: 'Robes, tees, scarves & layers',
    title: 'Apparel & robes',
    description: 'House colors, con‑ready cosplay basics, and cozy layers for everyday fan flex.',
    cta: 'Shop apparel',
    href: '/products?category=apparel',
    icon: (
      <svg viewBox="0 0 64 64" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M22 12 L42 12 L48 22 L44 52 L20 52 L16 22 Z" />
        <path d="M28 12 V22 M36 12 V22" />
      </svg>
    ),
  },
  {
    id: 'home',
    meta: 'Gifts, décor & tableware',
    title: 'Home & gifts',
    description: 'Mugs, lamps, wall art, and bundle‑ready sets when you need a present yesterday.',
    cta: 'Shop home & gifts',
    href: '/products?category=home-gifts',
    icon: (
      <svg viewBox="0 0 64 64" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M12 28 L32 14 L52 28 V54 H12 Z" />
        <rect x="26" y="38" width="12" height="16" />
      </svg>
    ),
  },
];

export default function BrowseByDepartment() {
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
          <p className="text-hos-text-muted text-sm mt-1 font-body">
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
        {DEPARTMENTS.map((dept) => (
          <Link key={dept.id} href={dept.href} className="dept-card group">
            <div
              className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_90%_70%_at_15%_-10%,rgba(201,162,39,0.14),transparent_52%)]"
              aria-hidden
            />
            <div className="dept-card-icon">{dept.icon}</div>
            <div className="relative z-10 min-w-0">
              <span className="block text-hos-gold-dim text-[10px] uppercase tracking-[0.1em] font-ui font-semibold mb-2">
                {dept.meta}
              </span>
              <h3 className="font-display text-hos-gold-hover text-xl md:text-2xl mb-2.5">{dept.title}</h3>
              <p className="text-hos-text-muted text-[15px] leading-relaxed mb-3.5 font-body">{dept.description}</p>
              <span className="font-ui text-[13px] font-bold text-hos-gold group-hover:text-hos-gold-hover transition-colors">
                {dept.cta}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

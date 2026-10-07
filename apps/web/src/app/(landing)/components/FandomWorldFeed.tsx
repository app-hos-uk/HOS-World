import Link from 'next/link';
import { FandomWorldCard } from './FandomWorldCard';
import { marketContent } from '../lib/marketContent';
import type { FandomWorldItem } from '../lib/fandomWorldApi';

type Props = {
  items: FandomWorldItem[];
};

export function FandomWorldFeed({ items }: Props) {
  return (
    <section className="fw-section" aria-labelledby="fw-heading">
      <div className="fw-section-header rv">
        <p className="eyebrow">{marketContent.fandomWorldHeading}</p>
        <h2 id="fw-heading" className="sec-h2">
          {marketContent.fandomWorldSubtitle}
        </h2>
        <p className="fw-section-desc">{marketContent.fandomWorldDescription}</p>
      </div>

      {items.length > 0 ? (
        <div className="fw-grid">
          {items.map((item, index) => (
            <div
              key={item.id}
              className="rv"
              style={{ transitionDelay: `${Math.min(index * 0.06, 0.36)}s` }}
            >
              <FandomWorldCard item={item} />
            </div>
          ))}
        </div>
      ) : (
        <p className="fw-empty rv">Stories from every universe will appear here soon.</p>
      )}

      <div className="fw-cta rv">
        <Link href="/fandom-world">Explore Fandom World</Link>
      </div>
    </section>
  );
}

import { FandomWorldCard } from './FandomWorldCard';
import { marketConfig } from '../lib/marketConfig';
import type { FandomWorldItem } from '../lib/fandomWorldApi';

type Props = {
  items: FandomWorldItem[];
  exploreHref: string;
};

export function FandomWorldFeed({ items, exploreHref }: Props) {
  return (
    <section className="fw-section" aria-labelledby="fw-heading">
      <div className="fw-section-header rv">
        <p className="eyebrow">{marketConfig.fandomWorldHeading}</p>
        <h2 id="fw-heading" className="sec-h2">
          {marketConfig.fandomWorldSubtitle}
        </h2>
        <p className="fw-section-desc">{marketConfig.fandomWorldDescription}</p>
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
        <p className="fw-empty rv">Stories and event announcements will appear here soon.</p>
      )}

      <div className="fw-cta rv">
        <a href={exploreHref}>Explore Fandom World</a>
      </div>
    </section>
  );
}

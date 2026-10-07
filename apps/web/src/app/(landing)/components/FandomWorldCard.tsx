'use client';

import { useState } from 'react';
import { FilmIcon, MapPinIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { StarIcon } from '@heroicons/react/24/solid';
import { FandomVideoModal } from './FandomVideoModal';
import { FandomShareButton } from './FandomShareButton';
import { UNIVERSES } from '../lib/universes';
import {
  fandomCardKind,
  formatFandomDate,
  timeAgo,
  youtubeThumbnail,
  type FandomWorldItem,
} from '../lib/fandomWorldApi';

type Props = {
  item: FandomWorldItem;
};

type EventIcon = 'star' | 'film' | 'pin' | 'spark';

function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function eventMeta(item: FandomWorldItem): { label: string; icon: EventIcon } {
  const raw = (item.eventType || '').trim();
  const key = raw.toLowerCase();
  if (/premiere|movie|film|release/.test(key)) {
    return { label: raw ? titleCase(raw) : 'Release', icon: 'film' };
  }
  if (/convention|comic-?con|\bcon\b/.test(key)) {
    return { label: raw ? titleCase(raw) : 'Convention', icon: 'pin' };
  }
  if (/celebrat|cosplay|fandom/.test(key)) {
    return { label: raw ? titleCase(raw) : 'Celebration', icon: 'spark' };
  }
  if (item.isHOSEvent) return { label: 'House Event', icon: 'star' };
  return { label: raw ? titleCase(raw) : 'Event', icon: 'spark' };
}

function EventGlyph({ icon }: { icon: EventIcon }) {
  const props = { width: 14, height: 14, 'aria-hidden': true as const };
  if (icon === 'star') return <StarIcon {...props} />;
  if (icon === 'film') return <FilmIcon {...props} />;
  if (icon === 'pin') return <MapPinIcon {...props} />;
  return <SparklesIcon {...props} />;
}

function universeAccent(categories: string[]): string | null {
  for (const category of categories) {
    const needle = category.trim().toLowerCase();
    if (!needle) continue;
    const match = UNIVERSES.find((universe) => {
      const name = universe.n.toLowerCase();
      return name === needle || name.startsWith(needle) || needle.startsWith(name);
    });
    if (match) return match.ac;
  }
  return null;
}

function coverSource(item: FandomWorldItem): string | null {
  if (item.imageUrl) return item.imageUrl;
  if (item.videoUrl) return youtubeThumbnail(item.videoUrl);
  return null;
}

export function FandomWorldCard({ item }: Props) {
  const [open, setOpen] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const kind = fandomCardKind(item);
  const image = imgFailed ? null : coverSource(item);
  const category = item.categories.find((entry) => entry.trim()) || '';
  const accent = image ? null : universeAccent(item.categories);
  const meta = kind === 'event' ? eventMeta(item) : null;
  const opensModal = Boolean(item.videoUrl) && (kind === 'video' || kind === 'event');
  const externalUrl = !opensModal ? item.externalUrl : undefined;
  const when = kind === 'event' ? formatFandomDate(item.date) : timeAgo(item.date);

  const className = [
    'fw-card',
    kind === 'event' && item.isHOSEvent ? 'fw-card--hos-event' : '',
    kind === 'event' && !item.isHOSEvent ? 'fw-card--event' : '',
    kind === 'video' ? 'fw-card--video' : '',
    !image ? 'fw-card--no-image' : '',
    !opensModal && !externalUrl ? 'fw-card--static' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const inner = (
    <>
      <div
        className="fw-card-img-wrap"
        style={
          accent
            ? { background: `linear-gradient(135deg, ${accent}66, rgba(5,5,13,.95))` }
            : undefined
        }
      >
        {image ? (
          <img
            className="fw-card-img"
            src={image}
            alt=""
            loading="lazy"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <span className="fw-no-img-icon" aria-hidden="true">
            ✦
          </span>
        )}
        <div className="fw-card-img-gradient" />
        {kind === 'news' && <span className="fw-type-badge">News</span>}
        {kind === 'video' && <span className="fw-type-badge fw-type-badge--video">Video</span>}
        {kind === 'video' && (
          <span className="fw-play-overlay" aria-hidden="true">
            <span className="fw-play-triangle" />
          </span>
        )}
        {kind === 'event' && item.videoUrl && (
          <span className="fw-play-badge" aria-hidden="true">
            <span className="fw-play-triangle" />
          </span>
        )}
        {kind === 'news' && (item.sourceLogoUrl || item.sourceName) && (
          <span className="fw-source">
            {item.sourceLogoUrl ? (
              <img className="fw-source-logo" src={item.sourceLogoUrl} alt="" />
            ) : null}
            {item.sourceName ? <span className="fw-source-name">{item.sourceName}</span> : null}
          </span>
        )}
      </div>
      <div className="fw-card-body">
        {meta && (
          <p className="fw-event-badge">
            <EventGlyph icon={meta.icon} />
            <span>{meta.label}</span>
          </p>
        )}
        <h3 className="fw-title">{item.title}</h3>
        {kind === 'video' && item.sourceName ? (
          <p className="fw-card-source-line">{item.sourceName}</p>
        ) : null}
        {(item.excerpt || (kind === 'event' && item.location)) && (
          <p className="fw-excerpt">{item.excerpt || item.location}</p>
        )}
      </div>
      <div className="fw-card-footer">
        {category ? <span className="fw-tag">{category}</span> : <span />}
        <span className="fw-card-footer-right">
          {when ? <span className="fw-date">{when}</span> : null}
          <FandomShareButton
            url={item.externalUrl || item.videoUrl || ''}
            title={item.title}
          />
        </span>
      </div>
    </>
  );

  return (
    <>
      {opensModal ? (
        <button type="button" className={className} onClick={() => setOpen(true)}>
          {inner}
        </button>
      ) : externalUrl ? (
        <a className={className} href={externalUrl} target="_blank" rel="noopener noreferrer">
          {inner}
        </a>
      ) : (
        <article className={className}>{inner}</article>
      )}
      {open && item.videoUrl ? (
        <FandomVideoModal
          videoUrl={item.videoUrl}
          title={item.title}
          sourceName={item.sourceName}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

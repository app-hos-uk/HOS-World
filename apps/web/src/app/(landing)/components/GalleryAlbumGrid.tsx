import Link from 'next/link';
import type { GalleryAlbum } from '../lib/galleryApi';
import { formatGalleryDate } from '../lib/galleryApi';

type Props = {
  albums: GalleryAlbum[];
  limit?: number;
};

export function GalleryAlbumGrid({ albums, limit }: Props) {
  const items = limit ? albums.slice(0, limit) : albums;

  if (items.length === 0) {
    return (
      <p className="gallery-empty rv">Event galleries will appear here once published.</p>
    );
  }

  return (
    <div className="gallery-album-grid">
      {items.map((album, idx) => (
        <Link
          key={album.id}
          href={`/gallery/${album.slug}`}
          className="gallery-album-card rv"
          style={{ transitionDelay: `${Math.min(idx * 0.06, 0.36)}s` }}
        >
          <div className="gallery-album-media">
            {album.coverUrl ? (
              <img src={album.coverUrl} alt="" loading="lazy" />
            ) : (
              <div className="gallery-album-placeholder" aria-hidden="true">
                📷
              </div>
            )}
          </div>
          <div className="gallery-album-body">
            {album.eventDate && (
              <p className="gallery-album-date">{formatGalleryDate(album.eventDate)}</p>
            )}
            <h3 className="gallery-album-title">{album.title}</h3>
            {album.location && <p className="gallery-album-location">{album.location}</p>}
            <p className="gallery-album-meta">
              {album.imageCount ?? album.images?.length ?? 0} photos
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}

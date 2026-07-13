import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LandingShell } from '../../components/LandingShell';
import { LandingFooter } from '../../components/LandingFooter';
import { GalleryImageGrid } from '../../components/GalleryImageGrid';
import { landingPageMetadata } from '../../lib/landingMetadata';
import { fetchGalleryAlbum, fetchGalleryAlbums, formatGalleryDate } from '../../lib/galleryApi';

export const revalidate = 60;

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  const albums = await fetchGalleryAlbums();
  return albums.map((album) => ({ slug: album.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const album = await fetchGalleryAlbum(slug);
  if (!album) {
    return landingPageMetadata({
      title: 'Gallery — House of Spells',
      description: 'Event photo gallery',
      path: '/gallery',
    });
  }
  return landingPageMetadata({
    title: `${album.title} — Gallery | House of Spells`,
    description: album.description || `Photos from ${album.title}`,
    path: `/gallery/${album.slug}`,
  });
}

export default async function GalleryAlbumPage({ params }: Props) {
  const { slug } = await params;
  const album = await fetchGalleryAlbum(slug);
  if (!album) notFound();

  const images = album.images || [];

  return (
    <LandingShell nav="gallery" mainId="pg-gallery-event">
      <main id="pg-gallery-event" className="hos-page gallery-page" tabIndex={-1}>
        <div className="page-hero rv">
          <p className="eyebrow">
            <Link href="/gallery" className="gallery-breadcrumb-link">
              Gallery
            </Link>
            {' / '}
            {album.title}
          </p>
          <h1 className="sec-h2">{album.title}</h1>
          {(album.eventDate || album.location) && (
            <p className="sec-sub">
              {[formatGalleryDate(album.eventDate), album.location].filter(Boolean).join(' · ')}
            </p>
          )}
          {album.description && <p className="gallery-album-description rv">{album.description}</p>}
        </div>

        <GalleryImageGrid images={images} albumTitle={album.title} />

        <div className="landing-cta-row">
          <Link href="/gallery" className="btn-g">
            All Events
          </Link>
          <Link href="/founding-members" className="btn-p">
            Claim Your Place
          </Link>
        </div>

        <LandingFooter />
      </main>
    </LandingShell>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { LandingShell } from '../components/LandingShell';
import { LandingFooter } from '../components/LandingFooter';
import { GalleryAlbumGrid } from '../components/GalleryAlbumGrid';
import { landingPageMetadata } from '../lib/landingMetadata';
import { fetchGalleryAlbums, groupGalleryAlbums } from '../lib/galleryApi';

export const revalidate = 60;

export const metadata: Metadata = landingPageMetadata({
  title: 'Gallery — House of Spells',
  description: 'Moments from House of Spells events — launches, gatherings, and fandom celebrations.',
  path: '/gallery',
});

export default async function GalleryPage() {
  const albums = await fetchGalleryAlbums();
  const groups = groupGalleryAlbums(albums);

  return (
    <LandingShell nav="gallery" mainId="pg-gallery">
      <main id="pg-gallery" className="hos-page gallery-page" tabIndex={-1}>
        <div className="page-hero rv">
          <p className="eyebrow">The Chronicle</p>
          <h1 className="sec-h2">
            Moments From
            <br />
            Every Event
          </h1>
          <p className="sec-sub">
            Browse photo albums from House of Spells launches, gatherings, and celebrations across the multiverse.
          </p>
        </div>

        {groups.map((group) => (
          <section key={group.key} className="gallery-region-section rv">
            {group.label && <h2 className="gallery-region-title">{group.label}</h2>}
            <GalleryAlbumGrid albums={group.albums} />
          </section>
        ))}

        <div className="landing-cta-row">
          <Link href="/" className="btn-g">
            Back to Home
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

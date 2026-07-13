import { slugify } from '@hos-marketplace/utils';

/** Build nested upload path: gallery/{country}/{outlet}/{event-slug} */
export function buildGalleryUploadFolder(album: {
  countryCode?: string | null;
  outletSlug?: string | null;
  slug: string;
}): string {
  const country = slugify(album.countryCode?.trim() || 'global') || 'global';
  const outlet = slugify(album.outletSlug?.trim() || 'general') || 'general';
  const event = slugify(album.slug) || album.slug.replace(/[^a-zA-Z0-9_-]/g, '');
  return `gallery/${country}/${outlet}/${event}`;
}

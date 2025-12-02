/**
 * Convert string to URL-friendly slug
 */
export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')           // Replace spaces with hyphens
    .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
    .replace(/\-\-+/g, '-')         // Replace multiple hyphens with single hyphen
    .replace(/^-+/, '')             // Trim hyphen from start
    .replace(/-+$/, '');            // Trim hyphen from end
}

/**
 * Generate unique slug by appending number if needed
 */
export function generateUniqueSlug(baseSlug: string, existingSlugs: string[]): string {
  let slug = slugify(baseSlug);
  let counter = 1;

  while (existingSlugs.includes(slug)) {
    slug = `${slugify(baseSlug)}-${counter}`;
    counter++;
  }

  return slug;
}

/**
 * Extract slug from URL
 */
export function extractSlugFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const parts = pathname.split('/').filter(Boolean);
    return parts[parts.length - 1] || '';
  } catch {
    return '';
  }
}



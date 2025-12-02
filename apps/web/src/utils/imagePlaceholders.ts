/**
 * Image Placeholder Utilities
 * 
 * This file provides helper functions for using placeholder images
 * during development. Replace with actual images before production.
 * 
 * See: /public/IMAGE_SPECIFICATIONS.md for image requirements
 */

/**
 * Get placeholder image URL from placeholder service
 * Use this temporarily if actual images are not available
 */
export function getPlaceholderImage(
  width: number,
  height: number,
  text: string,
  bgColor: string = '4c1d95',
  textColor: string = 'ffffff'
): string {
  // Using placehold.co service
  return `https://placehold.co/${width}x${height}/${bgColor}/${textColor}?text=${encodeURIComponent(text)}`;
}

/**
 * Image size constants for reference
 */
export const IMAGE_SIZES = {
  HERO_BANNER: { width: 1920, height: 1080, maxSize: '500KB' },
  BANNER_CAROUSEL: { width: 800, height: 600, maxSize: '200KB' },
  FEATURE_BANNER: { width: 1920, height: 1080, maxSize: '400KB' },
  PRODUCT_THUMBNAIL: { width: 400, height: 400, maxSize: '50KB' },
  PRODUCT_DETAIL: { width: 1200, height: 900, maxSize: '200KB' },
  FANDOM_COLLECTION: { width: 800, height: 450, maxSize: '150KB' },
} as const;

/**
 * Brand colors for placeholder backgrounds
 */
export const PLACEHOLDER_COLORS = {
  PURPLE_DARK: '4c1d95',
  PURPLE_MEDIUM: '7c3aed',
  INDIGO: '6366f1',
  AMBER: 'd97706',
  GOLD: 'fbbf24',
} as const;

/**
 * Example usage:
 * 
 * // For hero banner
 * const placeholder = getPlaceholderImage(
 *   IMAGE_SIZES.HERO_BANNER.width,
 *   IMAGE_SIZES.HERO_BANNER.height,
 *   'Harry Potter Hero',
 *   PLACEHOLDER_COLORS.PURPLE_DARK
 * );
 * 
 * // In component
 * <img 
 *   src={actualImage || placeholder} 
 *   alt="Hero banner"
 *   width={IMAGE_SIZES.HERO_BANNER.width}
 *   height={IMAGE_SIZES.HERO_BANNER.height}
 * />
 */


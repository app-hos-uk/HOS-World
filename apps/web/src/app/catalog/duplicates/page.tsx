'use client';

/**
 * Catalog-scoped entry point for cross-seller duplicate review.
 * Reuses the shared procurement submissions page (already allows CATALOG role)
 * so Catalog users stay under /catalog/* instead of /procurement/*.
 */
export { default } from '../../procurement/submissions/page';

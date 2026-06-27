/** Flatten Strapi v4 REST entities (`{ id, attributes }`) for API consumers. */
export function normalizeStrapiEntity<T extends Record<string, unknown>>(
  entity: unknown,
): (T & { id: string }) | null {
  if (!entity || typeof entity !== 'object') return null;

  const record = entity as Record<string, unknown>;
  if (record.attributes && typeof record.attributes === 'object') {
    return {
      id: String(record.id),
      ...(record.attributes as T),
    };
  }

  return {
    id: String(record.id ?? ''),
    ...(record as T),
  };
}

export function normalizeStrapiCollection<T extends Record<string, unknown>>(
  items: unknown,
): Array<T & { id: string }> {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => normalizeStrapiEntity<T>(item))
    .filter((item): item is T & { id: string } => item != null);
}

export function getStrapiOrigin(strapiApiUrl: string): string {
  return strapiApiUrl.replace(/\/api\/?$/, '');
}

/** Resolve Strapi media (populated relation, flat URL, or legacy string). */
export function resolveStrapiMediaUrl(
  media: unknown,
  strapiApiUrl: string,
): string | undefined {
  if (!media) return undefined;
  if (typeof media === 'string') {
    const trimmed = media.trim();
    if (!trimmed) return undefined;
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
    if (trimmed.startsWith('/')) return `${getStrapiOrigin(strapiApiUrl)}${trimmed}`;
    return trimmed;
  }

  if (typeof media === 'object') {
    const obj = media as Record<string, unknown>;
    const nested = obj.data ?? media;
    const normalized = normalizeStrapiEntity<{ url?: string }>(nested);
    if (normalized?.url) {
      return resolveStrapiMediaUrl(normalized.url, strapiApiUrl);
    }
  }

  return undefined;
}

export function normalizeBannerRecord(
  raw: Record<string, unknown>,
  strapiApiUrl: string,
): Record<string, unknown> {
  return {
    ...raw,
    image: resolveStrapiMediaUrl(raw.image, strapiApiUrl) ?? raw.image,
  };
}

export function normalizePageRecord(raw: Record<string, unknown>): Record<string, unknown> {
  const seo = raw.seo;
  if (seo && typeof seo === 'object' && !Array.isArray(seo)) {
    return raw;
  }
  return raw;
}

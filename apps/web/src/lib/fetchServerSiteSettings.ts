import {
  DEFAULT_SITE_SETTINGS,
  type PublicSiteSettings,
} from '@/lib/siteSettingsDefaults';
import { getDirectApiBaseUrl } from '@/lib/apiBaseUrl';

/** Server-side fetch for layout metadata and structured data (cached 5 min). */
export async function fetchServerSiteSettings(): Promise<PublicSiteSettings> {
  try {
    const base = getDirectApiBaseUrl();
    const res = await fetch(`${base}/config/site`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return DEFAULT_SITE_SETTINGS;
    const json = (await res.json()) as { data?: Partial<PublicSiteSettings> };
    const d = json?.data;
    if (!d) return DEFAULT_SITE_SETTINGS;
    return {
      platformName: d.platformName || DEFAULT_SITE_SETTINGS.platformName,
      platformUrl: d.platformUrl || DEFAULT_SITE_SETTINGS.platformUrl,
      contactEmail: d.contactEmail || DEFAULT_SITE_SETTINGS.contactEmail,
      contactPhone: d.contactPhone || DEFAULT_SITE_SETTINGS.contactPhone,
      contactAddress: d.contactAddress || DEFAULT_SITE_SETTINGS.contactAddress,
      footerAbout: d.footerAbout || DEFAULT_SITE_SETTINGS.footerAbout,
      socialFacebookUrl: d.socialFacebookUrl || DEFAULT_SITE_SETTINGS.socialFacebookUrl,
      socialInstagramUrl: d.socialInstagramUrl || DEFAULT_SITE_SETTINGS.socialInstagramUrl,
      socialXUrl: d.socialXUrl || DEFAULT_SITE_SETTINGS.socialXUrl,
    };
  } catch {
    return DEFAULT_SITE_SETTINGS;
  }
}

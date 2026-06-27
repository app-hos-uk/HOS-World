'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/lib/api';
import {
  DEFAULT_SITE_SETTINGS,
  type PublicSiteSettings,
} from '@/lib/siteSettingsDefaults';

const SiteSettingsContext = createContext<PublicSiteSettings>(DEFAULT_SITE_SETTINGS);

export function SiteSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<PublicSiteSettings>(DEFAULT_SITE_SETTINGS);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.getPublicSiteSettings();
        const d = res?.data;
        if (!d || cancelled) return;
        setSettings({
          platformName: d.platformName || DEFAULT_SITE_SETTINGS.platformName,
          platformUrl: d.platformUrl || DEFAULT_SITE_SETTINGS.platformUrl,
          contactEmail: d.contactEmail || DEFAULT_SITE_SETTINGS.contactEmail,
          contactPhone: d.contactPhone || DEFAULT_SITE_SETTINGS.contactPhone,
          contactAddress: d.contactAddress || DEFAULT_SITE_SETTINGS.contactAddress,
          footerAbout: d.footerAbout || DEFAULT_SITE_SETTINGS.footerAbout,
          socialFacebookUrl: d.socialFacebookUrl || DEFAULT_SITE_SETTINGS.socialFacebookUrl,
          socialInstagramUrl: d.socialInstagramUrl || DEFAULT_SITE_SETTINGS.socialInstagramUrl,
          socialXUrl: d.socialXUrl || DEFAULT_SITE_SETTINGS.socialXUrl,
        });
      } catch {
        // Keep defaults
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(() => settings, [settings]);

  return (
    <SiteSettingsContext.Provider value={value}>{children}</SiteSettingsContext.Provider>
  );
}

export function useSiteSettings(): PublicSiteSettings {
  return useContext(SiteSettingsContext);
}

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';

export type PartnerLinkUrlInput = {
  code: string;
  targetUrl: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign?: string | null;
  utmContent?: string | null;
  utmTerm?: string | null;
};

export const PARTNER_CODE_RE = /^PARTNER-[A-Z0-9][A-Z0-9_-]{2,62}$/;

@Injectable()
export class PartnerUrlService {
  constructor(private config: ConfigService) {}

  generateFullUrl(link: PartnerLinkUrlInput): string {
    const baseUrl = (
      this.config.get<string>('FRONTEND_URL', 'https://houseofspells.com') ||
      'https://houseofspells.com'
    ).replace(/\/$/, '');
    const refPath = `/ref/${encodeURIComponent(link.code)}`;
    const params = new URLSearchParams();
    params.set('utm_source', link.utmSource);
    params.set('utm_medium', link.utmMedium);
    if (link.utmCampaign) params.set('utm_campaign', link.utmCampaign);
    if (link.utmContent) params.set('utm_content', link.utmContent);
    if (link.utmTerm) params.set('utm_term', link.utmTerm);
    return `${baseUrl}${refPath}?${params.toString()}`;
  }

  generateQrData(link: PartnerLinkUrlInput): string {
    return this.generateFullUrl(link);
  }

  generatePartnerCode(partnerSlug: string, linkName: string): string {
    const slugPart = partnerSlug
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 12)
      .toUpperCase();
    const namePart = linkName
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 12)
      .toUpperCase();
    const randomSuffix = randomBytes(3).toString('hex').slice(0, 4).toUpperCase();
    return `PARTNER-${slugPart}-${namePart}-${randomSuffix}`.replace(/-+/g, '-').replace(/-$/, '');
  }
}

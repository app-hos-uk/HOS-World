import { ConfigService } from '@nestjs/config';
import { PartnerUrlService } from './partner-url.service';

describe('PartnerUrlService', () => {
  const config = { get: jest.fn().mockReturnValue('https://houseofspells.com') };
  const svc = new PartnerUrlService(config as unknown as ConfigService);

  const link = {
    code: 'PARTNER-HOTELS-NYC-AB12',
    targetUrl: '/register',
    utmSource: 'hotels-nyc',
    utmMedium: 'referral',
    utmCampaign: 'summer',
    utmContent: 'banner',
    utmTerm: null as string | null,
  };

  it('builds a /ref URL with UTM params', () => {
    const url = svc.generateFullUrl(link);
    expect(url).toContain('https://houseofspells.com/ref/PARTNER-HOTELS-NYC-AB12?');
    expect(url).toContain('utm_source=hotels-nyc');
    expect(url).toContain('utm_medium=referral');
    expect(url).toContain('utm_campaign=summer');
    expect(url).toContain('utm_content=banner');
    expect(url).not.toContain('utm_term=');
  });

  it('strips a trailing slash from FRONTEND_URL', () => {
    config.get.mockReturnValue('https://houseofspells.com/');
    expect(svc.generateFullUrl(link)).toMatch(/^https:\/\/houseofspells\.com\/ref\//);
  });

  it('generateQrData matches the full URL', () => {
    config.get.mockReturnValue('https://houseofspells.com');
    expect(svc.generateQrData(link)).toBe(svc.generateFullUrl(link));
  });

  it('generatePartnerCode is PARTNER-prefixed and uppercase', () => {
    const code = svc.generatePartnerCode('hotels-nyc', 'Front Desk');
    expect(code).toMatch(/^PARTNER-HOTELSNYC-FRONTDESK-[A-Z0-9]+$/);
  });
});

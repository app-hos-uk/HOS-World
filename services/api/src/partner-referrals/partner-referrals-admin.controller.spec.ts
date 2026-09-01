import { PartnerReferralsAdminController } from './partner-referrals-admin.controller';
import { PartnerReferralsService } from './partner-referrals.service';
import { PartnerAnalyticsService } from './services/partner-analytics.service';

describe('PartnerReferralsAdminController', () => {
  let controller: PartnerReferralsAdminController;
  const partners = {
    listPartners: jest.fn().mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 }),
    createPartner: jest.fn().mockResolvedValue({ id: 'p1' }),
    getPartner: jest.fn().mockResolvedValue({ id: 'p1', links: [] }),
    updatePartner: jest.fn().mockResolvedValue({ id: 'p1' }),
    archivePartner: jest.fn().mockResolvedValue({ id: 'p1', status: 'ARCHIVED' }),
    createLink: jest.fn().mockResolvedValue({ id: 'l1' }),
    listLinks: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    getLink: jest.fn().mockResolvedValue({ id: 'l1' }),
    updateLink: jest.fn().mockResolvedValue({ id: 'l1' }),
    getLinkFullUrl: jest.fn().mockResolvedValue('https://x/ref/CODE'),
    getLinkQrData: jest.fn().mockResolvedValue('https://x/ref/CODE'),
  };
  const analytics = {
    getDashboard: jest.fn().mockResolvedValue({ totalPartners: 1 }),
    getPartnerReport: jest.fn().mockResolvedValue({}),
    getLinkReport: jest.fn().mockResolvedValue({}),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new PartnerReferralsAdminController(
      partners as unknown as PartnerReferralsService,
      analytics as unknown as PartnerAnalyticsService,
    );
  });

  it('dashboard', async () => {
    const r = await controller.dashboard();
    expect(analytics.getDashboard).toHaveBeenCalled();
    expect(r.data).toEqual({ totalPartners: 1 });
  });

  it('list partners', async () => {
    await controller.list('ACTIVE', 'hotels', '1', '20');
    expect(partners.listPartners).toHaveBeenCalledWith({
      status: 'ACTIVE',
      search: 'hotels',
      page: 1,
      limit: 20,
    });
  });

  it('create partner', async () => {
    await controller.create({ name: 'Hotels NYC' } as any);
    expect(partners.createPartner).toHaveBeenCalled();
  });

  it('link url and qr', async () => {
    const url = await controller.linkUrl('l1');
    const qr = await controller.linkQr('l1');
    expect(url.data).toEqual({ url: 'https://x/ref/CODE' });
    expect(qr.data).toEqual({ qrData: 'https://x/ref/CODE' });
  });

  it('partner and link reports', async () => {
    await controller.report('p1');
    await controller.linkReport('l1');
    expect(analytics.getPartnerReport).toHaveBeenCalledWith('p1');
    expect(analytics.getLinkReport).toHaveBeenCalledWith('l1');
  });
});

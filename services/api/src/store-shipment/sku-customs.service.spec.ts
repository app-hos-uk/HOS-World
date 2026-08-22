import { SkuCustomsService } from './sku-customs.service';

describe('SkuCustomsService.enrichSaleItems', () => {
  const prisma = {
    product: { findUnique: jest.fn() },
    skuCustomsAttribute: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };
  const service = new SkuCustomsService(prisma as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('treats a missing SKU as pending enrichment, not blocked', async () => {
    const result = await service.enrichSaleItems([{ sku: null, name: 'Mystery figure' }]);
    expect(result.anyBlocked).toBe(false);
    expect(result.allReady).toBe(false);
    expect(result.results).toEqual([
      { sku: null, name: 'Mystery figure', status: 'PENDING', reason: 'missing_sku' },
    ]);
  });

  it('resolveLineSku prefers the POS SKU then the catalog product SKU', async () => {
    expect(await service.resolveLineSku({ sku: 'POS-1', productId: 'prod-1' })).toBe('POS-1');
    prisma.product.findUnique.mockResolvedValue({ sku: 'FIG-1' });
    expect(await service.resolveLineSku({ sku: null, productId: 'prod-1' })).toBe('FIG-1');
    prisma.product.findUnique.mockResolvedValue({ sku: null });
    expect(await service.resolveLineSku({ sku: '  ', productId: 'prod-2' })).toBeNull();
  });

  it('falls back to the catalog product SKU when the POS line has none', async () => {
    prisma.product.findUnique.mockResolvedValue({ sku: 'FIG-1' });
    prisma.skuCustomsAttribute.findUnique.mockResolvedValue({
      id: 'attr-1',
      sku: 'FIG-1',
      status: 'READY',
    });

    const result = await service.enrichSaleItems([
      { sku: null, productId: 'prod-1', name: 'Figure' },
    ]);

    expect(prisma.product.findUnique).toHaveBeenCalledWith({
      where: { id: 'prod-1' },
      select: { sku: true },
    });
    expect(result.anyBlocked).toBe(false);
    expect(result.allReady).toBe(true);
    expect(result.results[0]).toMatchObject({ sku: 'FIG-1', status: 'READY' });
  });

  it('only marks the shipment blocked when a customs row is BLOCKED', async () => {
    prisma.skuCustomsAttribute.findUnique.mockResolvedValue({
      id: 'attr-2',
      sku: 'HAZ-1',
      status: 'BLOCKED',
    });

    const result = await service.enrichSaleItems([{ sku: 'HAZ-1', name: 'Restricted' }]);
    expect(result.anyBlocked).toBe(true);
    expect(result.allReady).toBe(false);
  });
});

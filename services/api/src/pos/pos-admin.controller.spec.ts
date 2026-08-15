import { PosAdminController } from './pos-admin.controller';

/**
 * Credentials live in a single encrypted blob, so the update path must merge partial
 * edits over the stored values. Regression guard: admins editing one field (e.g. the
 * domain prefix) previously wiped stored OAuth tokens.
 */
describe('PosAdminController — credential updates', () => {
  const STORED = {
    domainPrefix: 'old-prefix',
    clientId: 'client-1',
    clientSecret: 'secret-1',
    accessToken: 'access-1',
    refreshToken: 'refresh-1',
  };

  let prisma: any;
  let encryption: any;
  let controller: PosAdminController;

  const encrypted = (value: unknown) => `enc:${JSON.stringify(value)}`;

  beforeEach(() => {
    prisma = {
      pOSConnection: {
        findUnique: jest.fn().mockResolvedValue({ credentials: encrypted(STORED) }),
        update: jest.fn().mockImplementation(({ data }: any) => ({
          id: 'conn-1',
          provider: 'lightspeed',
          ...data,
          store: { id: 'store-1', name: 'Store', code: 'ST1' },
        })),
      },
    };

    encryption = {
      encrypt: jest.fn().mockImplementation((plain: string) => `enc:${plain}`),
      decryptJson: jest.fn().mockImplementation((blob: string) => JSON.parse(blob.slice(4))),
    };

    // Only prisma, encryption and platformSeller are exercised here; the sync/queue
    // dependencies in between are unused by the credential-update path.
    const unused = () => ({}) as any;
    controller = new PosAdminController(
      prisma,
      encryption,
      unused(), // factory
      unused(), // productSync
      unused(), // inventorySync
      unused(), // customerSync
      unused(), // customerIdentityBackfill
      unused(), // queue
      unused(), // discrepancies
      { resolvePlatformRetailSellerId: jest.fn() } as any,
    );
  });

  const savedCredentials = () =>
    JSON.parse(prisma.pOSConnection.update.mock.calls[0][0].data.credentials.slice(4));

  it('merges a partial credential update over the stored blob', async () => {
    await controller.update('conn-1', { credentials: { domainPrefix: 'new-prefix' } } as any);

    expect(savedCredentials()).toEqual({ ...STORED, domainPrefix: 'new-prefix' });
  });

  it('overwrites only the fields supplied', async () => {
    await controller.update('conn-1', {
      credentials: { accessToken: 'access-2', refreshToken: 'refresh-2' },
    } as any);

    const saved = savedCredentials();
    expect(saved.accessToken).toBe('access-2');
    expect(saved.refreshToken).toBe('refresh-2');
    expect(saved.clientSecret).toBe('secret-1');
  });

  it('falls back to the supplied credentials when the stored blob cannot be decrypted', async () => {
    encryption.decryptJson.mockImplementation(() => {
      throw new Error('bad key');
    });

    await controller.update('conn-1', { credentials: { domainPrefix: 'only' } } as any);

    expect(savedCredentials()).toEqual({ domainPrefix: 'only' });
  });

  it('leaves credentials untouched when the update omits them', async () => {
    await controller.update('conn-1', { externalOutletId: 'outlet-9' } as any);

    const data = prisma.pOSConnection.update.mock.calls[0][0].data;
    expect(data.credentials).toBeUndefined();
    expect(data.externalOutletId).toBe('outlet-9');
  });

  it('does not return credentials or webhook secret to the client', async () => {
    const res: any = await controller.update('conn-1', {
      credentials: { domainPrefix: 'new-prefix' },
      webhookSecret: 'hook',
    } as any);

    expect(res.data.credentials).toBeUndefined();
    expect(res.data.webhookSecret).toBeUndefined();
    expect(res.data.hasCredentials).toBe(true);
    expect(res.data.hasWebhookSecret).toBe(true);
  });
});

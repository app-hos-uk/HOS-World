import { BadRequestException } from '@nestjs/common';
import { AuthController } from './auth.controller';

describe('AuthController invitation validation', () => {
  const adminSellersService = { getInvitationByToken: jest.fn() };
  const controller = new AuthController({} as any, adminSellersService as any, {} as any);

  beforeEach(() => jest.clearAllMocks());

  it.each([undefined, '', '   '])(
    'rejects a missing token instead of reaching the service (%p)',
    async (token) => {
      await expect(controller.validateInvitation(token as string)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(adminSellersService.getInvitationByToken).not.toHaveBeenCalled();
    },
  );

  it('returns invitation details when the token is present', async () => {
    const expiresAt = new Date('2026-01-01');
    adminSellersService.getInvitationByToken.mockResolvedValue({
      email: 'seller@example.com',
      sellerType: 'BRAND',
      expiresAt,
      secret: 'must-not-leak',
    });

    const result = await controller.validateInvitation('tok-1');

    expect(adminSellersService.getInvitationByToken).toHaveBeenCalledWith('tok-1');
    expect(result.data).toEqual({
      email: 'seller@example.com',
      sellerType: 'BRAND',
      expiresAt,
    });
  });
});

import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { AcceptInvitationDto } from '../../auth/dto/accept-invitation.dto';
import { VerifyAgeDto } from '../../compliance/dto/verify-age.dto';
import { UnsubscribeNewsletterDto } from '../../newsletter/dto/unsubscribe-newsletter.dto';
import { TrackReferralDto } from '../../referrals/dto/track-referral.dto';
import { ChatbotMessageDto } from '../../support/dto/chatbot-message.dto';

// Mirrors the global pipe configured in main.ts, so these assertions describe what the running
// API does rather than what the DTO would do under different settings.
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: true },
});

const run = (metatype: any, value: unknown) =>
  pipe.transform(value, { type: 'body', metatype, data: '' });

// Each of these is unauthenticated, so anyone can reach it with anything. Each answered 500 on an
// empty body because the handler dereferenced a field the caller never sent.
describe('public POST body validation', () => {
  describe('POST /compliance/verify-age', () => {
    it('rejects an empty body rather than uppercasing an absent country', async () => {
      await expect(run(VerifyAgeDto, {})).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an implausible age', async () => {
      await expect(run(VerifyAgeDto, { country: 'GB', age: 999 })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('accepts a complete request', async () => {
      await expect(run(VerifyAgeDto, { country: 'GB', age: 21 })).resolves.toMatchObject({
        country: 'GB',
        age: 21,
      });
    });
  });

  describe('POST /newsletter/unsubscribe', () => {
    it('rejects an empty body rather than lower-casing an absent email', async () => {
      await expect(run(UnsubscribeNewsletterDto, {})).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a value that is not an email', async () => {
      await expect(run(UnsubscribeNewsletterDto, { email: 'not-an-email' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('accepts an email', async () => {
      await expect(
        run(UnsubscribeNewsletterDto, { email: 'reader@example.com' }),
      ).resolves.toMatchObject({ email: 'reader@example.com' });
    });
  });

  describe('POST /support/chatbot/message', () => {
    it('rejects an empty body rather than lower-casing an absent message', async () => {
      await expect(run(ChatbotMessageDto, {})).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a blank message, which would bill an LLM call for nothing', async () => {
      await expect(run(ChatbotMessageDto, { message: '   ' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects a message beyond the length cap', async () => {
      await expect(run(ChatbotMessageDto, { message: 'a'.repeat(4001) })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('accepts a message with its optional conversation context', async () => {
      await expect(
        run(ChatbotMessageDto, {
          message: 'Where is my order?',
          conversationId: 'conv-1',
          context: { orderId: 'order-1' },
        }),
      ).resolves.toMatchObject({ message: 'Where is my order?' });
    });
  });

  describe('POST /referrals/track', () => {
    it('rejects an empty body rather than querying on an undefined code', async () => {
      await expect(run(TrackReferralDto, {})).rejects.toBeInstanceOf(BadRequestException);
    });

    it('accepts a code with campaign parameters', async () => {
      await expect(
        run(TrackReferralDto, {
          referralCode: 'FRIEND10',
          visitorId: 'visitor-1',
          landingPage: 'https://example.com/p/1',
          utmParams: { utm_source: 'instagram' },
        }),
      ).resolves.toMatchObject({ referralCode: 'FRIEND10' });
    });
  });

  describe('POST /auth/accept-invitation', () => {
    it('rejects an empty body rather than reading through an absent registerDto', async () => {
      await expect(run(AcceptInvitationDto, {})).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a token with no registration payload', async () => {
      await expect(run(AcceptInvitationDto, { token: 'invite-token' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    // The nested payload is validated too, so a malformed registration is a 400 here rather than
    // a failure deeper in the sign-up path.
    it('rejects a registration payload that would not pass on its own', async () => {
      await expect(
        run(AcceptInvitationDto, {
          token: 'invite-token',
          registerDto: { email: 'not-an-email', password: 'x' },
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});

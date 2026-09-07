import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FandomChallengeService } from './fandom-challenge.service';

function makeService(overrides: Record<string, string> = {}): FandomChallengeService {
  const cfg = {
    get: jest.fn((key: string) => overrides[key] ?? undefined),
  } as unknown as ConfigService;
  return new FandomChallengeService(cfg);
}

describe('FandomChallengeService', () => {
  let service: FandomChallengeService;

  beforeEach(() => {
    service = makeService({ JWT_SECRET: 'test-secret-32-chars-long-enough' });
  });

  describe('generate', () => {
    it('returns a challenge with all required fields', () => {
      const challenge = service.generate();
      expect(challenge.token).toBeDefined();
      expect(typeof challenge.question).toBe('string');
      expect(challenge.options).toHaveLength(4);
      expect(typeof challenge.fandom).toBe('string');
      expect(challenge.expiresAt).toBeDefined();
    });

    it('shuffles options so answer index varies', () => {
      const indices = new Set<number>();
      for (let i = 0; i < 50; i++) {
        const c = service.generate();
        const decoded = Buffer.from(c.token, 'base64url').toString('utf8');
        const correctIdx = Number(decoded.split('|')[1]);
        indices.add(correctIdx);
      }
      expect(indices.size).toBeGreaterThan(1);
    });
  });

  describe('validate', () => {
    it('accepts a correct answer', () => {
      const challenge = service.generate();
      const decoded = Buffer.from(challenge.token, 'base64url').toString('utf8');
      const correctIdx = Number(decoded.split('|')[1]);
      expect(() => service.validate(challenge.token, correctIdx)).not.toThrow();
    });

    it('rejects an incorrect answer', () => {
      const challenge = service.generate();
      const decoded = Buffer.from(challenge.token, 'base64url').toString('utf8');
      const correctIdx = Number(decoded.split('|')[1]);
      const wrongIdx = (correctIdx + 1) % 4;
      expect(() => service.validate(challenge.token, wrongIdx)).toThrow(BadRequestException);
    });

    it('rejects a reused token', () => {
      const challenge = service.generate();
      const decoded = Buffer.from(challenge.token, 'base64url').toString('utf8');
      const correctIdx = Number(decoded.split('|')[1]);
      service.validate(challenge.token, correctIdx);
      expect(() => service.validate(challenge.token, correctIdx)).toThrow(
        /already been used/,
      );
    });

    it('rejects a tampered token', () => {
      const challenge = service.generate();
      const tampered = Buffer.from('fake|0|nonce|9999999999999|badsig').toString('base64url');
      expect(() => service.validate(tampered, 0)).toThrow(BadRequestException);
    });

    it('rejects expired tokens', () => {
      const challenge = service.generate();
      const decoded = Buffer.from(challenge.token, 'base64url').toString('utf8');
      const parts = decoded.split('|');
      const correctIdx = Number(parts[1]);
      parts[3] = String(Date.now() - 1000);

      const svc2 = makeService({ JWT_SECRET: 'test-secret-32-chars-long-enough' });
      const payload = `${parts[0]}|${parts[1]}|${parts[2]}|${parts[3]}`;
      const sig = (svc2 as any).sign(payload);
      const newToken = Buffer.from(`${payload}|${sig}`).toString('base64url');

      expect(() => svc2.validate(newToken, correctIdx)).toThrow(/expired/);
    });

    it('rejects null/undefined token', () => {
      expect(() => service.validate(null as any, 0)).toThrow(BadRequestException);
      expect(() => service.validate(undefined as any, 0)).toThrow(BadRequestException);
    });

    it('rejects answer index outside 0-3', () => {
      const challenge = service.generate();
      expect(() => service.validate(challenge.token, -1)).toThrow(BadRequestException);
      expect(() => service.validate(challenge.token, 5)).toThrow(BadRequestException);
    });
  });
});

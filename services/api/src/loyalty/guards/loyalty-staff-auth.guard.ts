import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { timingSafeEqual } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { AUTH_COOKIE_NAME } from '../../auth/cookie.utils';

/**
 * Constant-time API key check. Comparing a secret with `Array.includes` leaks a
 * byte-by-byte timing signal; lengths are compared first because timingSafeEqual
 * throws on mismatched buffer lengths. Every candidate is always visited so the
 * work does not depend on which key matched.
 */
function matchesAnyKey(presented: string, validKeys: string[]): boolean {
  const presentedBuf = Buffer.from(presented);
  let matched = false;
  for (const key of validKeys) {
    const keyBuf = Buffer.from(key);
    if (keyBuf.length === presentedBuf.length && timingSafeEqual(keyBuf, presentedBuf)) {
      matched = true;
    }
  }
  return matched;
}

/**
 * Valid X-API-Key (from API_KEYS) OR JWT for an ADMIN / STORE_STAFF user.
 * Accepts Bearer header OR HttpOnly access_token cookie (web sessions).
 * STORE_STAFF must have a storeId assignment.
 */
@Injectable()
export class LoyaltyStaffAuthGuard implements CanActivate {
  constructor(
    private config: ConfigService,
    private jwt: JwtService,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const apiKey = req.headers['x-api-key'] as string | undefined;
    const validKeys = (this.config.get<string>('API_KEYS') || '')
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);
    if (apiKey && matchesAnyKey(apiKey, validKeys)) {
      return true;
    }

    const auth = req.headers.authorization as string | undefined;
    const cookieToken = req.cookies?.[AUTH_COOKIE_NAME] as string | undefined;
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : cookieToken;
    if (!token) {
      throw new UnauthorizedException('API key or staff token required');
    }
    try {
      const secret = this.config.get<string>('JWT_SECRET');
      if (!secret) throw new UnauthorizedException('JWT not configured');
      const payload = await this.jwt.verifyAsync(token, {
        secret,
        algorithms: ['HS256'],
      });
      if (payload.type && payload.type !== 'access') {
        throw new UnauthorizedException('Invalid token');
      }
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, role: true, isActive: true, storeId: true },
      });
      if (!user?.isActive) {
        throw new UnauthorizedException('Staff access required');
      }
      if (user.role === 'ADMIN') {
        req.user = user;
        return true;
      }
      if (user.role === 'STORE_STAFF' && user.storeId) {
        req.user = user;
        req.storeId = user.storeId;
        return true;
      }
      throw new UnauthorizedException('Admin or store staff access required');
    } catch (e) {
      if (e instanceof UnauthorizedException) throw e;
      throw new UnauthorizedException('Invalid token');
    }
  }
}

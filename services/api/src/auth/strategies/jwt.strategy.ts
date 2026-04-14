import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { AUTH_COOKIE_NAME } from '../cookie.utils';

function extractFromCookieOrBearer(req: any): string | null {
  // Try cookie first (HttpOnly secure path)
  if (req?.cookies?.[AUTH_COOKIE_NAME]) {
    return req.cookies[AUTH_COOKIE_NAME];
  }
  // Fall back to Authorization header (API clients, backward compat)
  return ExtractJwt.fromAuthHeaderAsBearerToken()(req);
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: extractFromCookieOrBearer,
      ignoreExpiration: false,
      algorithms: ['HS256'],
      secretOrKey:
        configService.get<string>('JWT_SECRET', { infer: true }) ||
        (() => {
          throw new Error('JWT_SECRET environment variable is required');
        })(),
    });
  }

  async validate(payload: any) {
    if (payload.type && payload.type !== 'access') {
      throw new UnauthorizedException('Invalid token type');
    }

    try {
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          permissionRoleId: true,
          avatar: true,
          createdAt: true,
          updatedAt: true,
          defaultTenantId: true,
          tenantMemberships: {
            where: { isActive: true },
            select: {
              tenantId: true,
              role: true,
              tenant: {
                select: {
                  id: true,
                  name: true,
                  domain: true,
                  subdomain: true,
                  isActive: true,
                },
              },
            },
            orderBy: { joinedAt: 'asc' },
          },
        },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      if (!user.isActive) {
        throw new UnauthorizedException('Account has been deactivated');
      }

      return user;
    } catch (error: any) {
      throw error;
    }
  }
}

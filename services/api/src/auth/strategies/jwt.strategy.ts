import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET', { infer: true }) || (() => { throw new Error('JWT_SECRET environment variable is required'); })(),
    });
  }

  async validate(payload: any) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
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

      return user;
    } catch (error: any) {
      throw error;
    }
  }
}

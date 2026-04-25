import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../database/prisma.service';

/**
 * Valid X-API-Key (from API_KEYS) OR JWT for an ADMIN user.
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
    if (apiKey && validKeys.includes(apiKey)) {
      return true;
    }

    const auth = req.headers.authorization as string | undefined;
    if (!auth?.startsWith('Bearer ')) {
      throw new UnauthorizedException('API key or admin token required');
    }
    try {
      const secret = this.config.get<string>('JWT_SECRET');
      if (!secret) throw new UnauthorizedException('JWT not configured');
      const payload = await this.jwt.verifyAsync(auth.slice(7), {
        secret,
        algorithms: ['HS256'],
      });
      if (payload.type && payload.type !== 'access') {
        throw new UnauthorizedException('Invalid token');
      }
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, role: true, isActive: true },
      });
      if (!user?.isActive || user.role !== 'ADMIN') {
        throw new UnauthorizedException('Admin access required');
      }
      req.user = user;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
}

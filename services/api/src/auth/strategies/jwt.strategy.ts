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
      secretOrKey: configService.get<string>('JWT_SECRET') || 'your-secret-key',
    });
  }

  async validate(payload: any) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/8743deaa-734d-4185-9f60-b0828f74ef5b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'jwt.strategy.ts:20',message:'JWT validate entry',data:{userId:payload?.sub,hasPayload:!!payload},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    try {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/8743deaa-734d-4185-9f60-b0828f74ef5b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'jwt.strategy.ts:23',message:'Before Prisma query',data:{userId:payload?.sub},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
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
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/8743deaa-734d-4185-9f60-b0828f74ef5b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'jwt.strategy.ts:52',message:'After Prisma query',data:{userFound:!!user,hasDefaultTenant:!!user?.defaultTenantId,membershipCount:user?.tenantMemberships?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion

      if (!user) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/8743deaa-734d-4185-9f60-b0828f74ef5b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'jwt.strategy.ts:54',message:'User not found',data:{userId:payload?.sub},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        throw new UnauthorizedException('User not found');
      }

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/8743deaa-734d-4185-9f60-b0828f74ef5b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'jwt.strategy.ts:58',message:'JWT validate success',data:{userId:user.id,email:user.email},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      return user;
    } catch (error: any) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/8743deaa-734d-4185-9f60-b0828f74ef5b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'jwt.strategy.ts:60',message:'JWT validate error',data:{errorMessage:error?.message,errorName:error?.name,errorStack:error?.stack?.substring(0,200)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      throw error;
    }
  }
}



import { Controller, Get, UseGuards, Query, DefaultValuePipe, ParseIntPipe } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import type { ApiResponse, PaginatedResponse } from '@hos-marketplace/shared-types';

@ApiTags('admin')
@ApiBearerAuth('JWT-auth')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminUsersController {
  constructor(private prisma: PrismaService) {}

  @Get('users')
  @ApiOperation({
    summary: 'Get all users (Admin only)',
    description:
      'Retrieves a paginated list of all users sorted by role hierarchy (Admin first). Supports search, role, and status filtering.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 50, max: 100)' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search by email, first name, or last name' })
  @ApiQuery({ name: 'role', required: false, type: String, description: 'Filter by user role' })
  @ApiQuery({ name: 'status', required: false, type: String, description: 'Filter by status: active | inactive' })
  @SwaggerApiResponse({ status: 200, description: 'Users retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  async getAllUsers(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number = 50,
    @Query('search') search?: string,
    @Query('role') role?: string,
    @Query('status') status?: string,
  ): Promise<ApiResponse<PaginatedResponse<any>>> {
    const safePage = Math.max(1, page);
    const take = Math.max(1, Math.min(limit, 100));
    const skip = (safePage - 1) * take;

    const whereParts: Prisma.Sql[] = [];
    if (search?.trim()) {
      const term = `%${search.trim()}%`;
      whereParts.push(
        Prisma.sql`(u.email ILIKE ${term} OR u."firstName" ILIKE ${term} OR u."lastName" ILIKE ${term})`,
      );
    }
    if (role?.trim()) {
      whereParts.push(Prisma.sql`u.role = ${role.trim()}::"UserRole"`);
    }
    if (status === 'active') {
      whereParts.push(Prisma.sql`u."isActive" = true`);
    } else if (status === 'inactive') {
      whereParts.push(Prisma.sql`u."isActive" = false`);
    }

    const whereSql =
      whereParts.length > 0 ? Prisma.join(whereParts, ' AND ') : Prisma.sql`TRUE`;

    // Role hierarchy: admin / internal roles first, then marketplace roles (matches ROLE_PRIORITY).
    const [rows, countResult] = await Promise.all([
      this.prisma.$queryRaw<
        {
          id: string;
          email: string;
          firstName: string | null;
          lastName: string | null;
          role: string;
          isActive: boolean;
          avatar: string | null;
          createdAt: Date;
          updatedAt: Date;
        }[]
      >`
        SELECT u.id, u.email, u."firstName", u."lastName", u.role, u."isActive", u.avatar, u."createdAt", u."updatedAt"
        FROM users u
        WHERE ${whereSql}
        ORDER BY
          CASE u.role::text
            WHEN 'ADMIN' THEN 0
            WHEN 'PROCUREMENT' THEN 1
            WHEN 'FULFILLMENT' THEN 2
            WHEN 'CATALOG' THEN 3
            WHEN 'MARKETING' THEN 4
            WHEN 'FINANCE' THEN 5
            WHEN 'SALES' THEN 5.5
            WHEN 'CMS_EDITOR' THEN 6
            WHEN 'B2C_SELLER' THEN 7
            WHEN 'SELLER' THEN 8
            WHEN 'WHOLESALER' THEN 9
            WHEN 'INFLUENCER' THEN 10
            WHEN 'CUSTOMER' THEN 11
            ELSE 99
          END ASC,
          u."createdAt" DESC
        LIMIT ${take} OFFSET ${skip}
      `,
      this.prisma.$queryRaw<{ c: bigint }[]>`
        SELECT COUNT(*)::bigint AS c FROM users u WHERE ${whereSql}
      `,
    ]);

    const total = Number(countResult[0]?.c ?? 0);
    const users = rows;

    return {
      data: {
        data: users,
        pagination: {
          page,
          limit: take,
          total,
          totalPages: Math.ceil(total / take),
        },
      },
      message: 'Users retrieved successfully',
    };
  }
}

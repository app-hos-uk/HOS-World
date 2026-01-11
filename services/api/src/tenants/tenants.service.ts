import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';

@Injectable()
export class TenantsService {
  constructor(private prisma: PrismaService) {}

  async create(createDto: CreateTenantDto) {
    // Validate domain/subdomain uniqueness
    if (createDto.domain) {
      const existing = await this.prisma.tenant.findUnique({
        where: { domain: createDto.domain },
      });
      if (existing) {
        throw new BadRequestException('Domain already in use');
      }
    }

    if (createDto.subdomain) {
      const existing = await this.prisma.tenant.findUnique({
        where: { subdomain: createDto.subdomain },
      });
      if (existing) {
        throw new BadRequestException('Subdomain already in use');
      }
    }

    return this.prisma.tenant.create({
      data: {
        name: createDto.name,
        domain: createDto.domain,
        subdomain: createDto.subdomain,
        isActive: createDto.isActive ?? true,
        config: createDto.config || {},
        metadata: createDto.metadata || {},
      },
    });
  }

  async findAll() {
    return this.prisma.tenant.findMany({
      where: { isActive: true },
      include: {
        _count: {
          select: {
            stores: true,
            tenantUsers: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        stores: true,
        tenantUsers: {
          where: { isActive: true },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
              },
            },
          },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return tenant;
  }

  async update(id: string, updateDto: UpdateTenantDto) {
    await this.findOne(id); // Verify exists

    // Check domain/subdomain uniqueness if being updated
    if (updateDto.domain) {
      const existing = await this.prisma.tenant.findFirst({
        where: {
          domain: updateDto.domain,
          id: { not: id },
        },
      });
      if (existing) {
        throw new BadRequestException('Domain already in use');
      }
    }

    if (updateDto.subdomain) {
      const existing = await this.prisma.tenant.findFirst({
        where: {
          subdomain: updateDto.subdomain,
          id: { not: id },
        },
      });
      if (existing) {
        throw new BadRequestException('Subdomain already in use');
      }
    }

    return this.prisma.tenant.update({
      where: { id },
      data: {
        name: updateDto.name,
        domain: updateDto.domain,
        subdomain: updateDto.subdomain,
        isActive: updateDto.isActive,
        config: updateDto.config,
        metadata: updateDto.metadata,
      },
    });
  }

  async addUser(tenantId: string, userId: string, role: string) {
    const tenant = await this.findOne(tenantId);

    const existing = await this.prisma.tenantUser.findUnique({
      where: {
        tenantId_userId: { tenantId, userId },
      },
    });

    if (existing) {
      throw new BadRequestException('User already belongs to this tenant');
    }

    // Verify user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.tenantUser.create({
      data: {
        tenantId,
        userId,
        role,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
        tenant: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async removeUser(tenantId: string, userId: string) {
    const membership = await this.prisma.tenantUser.findUnique({
      where: {
        tenantId_userId: { tenantId, userId },
      },
    });

    if (!membership) {
      throw new NotFoundException('User is not a member of this tenant');
    }

    await this.prisma.tenantUser.delete({
      where: {
        tenantId_userId: { tenantId, userId },
      },
    });

    return { message: 'User removed from tenant successfully' };
  }

  async updateUserRole(tenantId: string, userId: string, role: string) {
    const membership = await this.prisma.tenantUser.findUnique({
      where: {
        tenantId_userId: { tenantId, userId },
      },
    });

    if (!membership) {
      throw new NotFoundException('User is not a member of this tenant');
    }

    return this.prisma.tenantUser.update({
      where: {
        tenantId_userId: { tenantId, userId },
      },
      data: { role },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
    });
  }

  async resolveTenant(domain?: string, subdomain?: string): Promise<string | null> {
    if (domain) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { domain },
      });
      return tenant?.id || null;
    }

    if (subdomain) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { subdomain },
      });
      return tenant?.id || null;
    }

    // Default to platform tenant (create if doesn't exist)
    let platformTenant = await this.prisma.tenant.findUnique({
      where: { id: 'platform' },
    });

    if (!platformTenant) {
      platformTenant = await this.prisma.tenant.create({
        data: {
          id: 'platform',
          name: 'Platform',
          subdomain: 'platform',
          isActive: true,
        },
      });
    }

    return platformTenant.id;
  }

  async getUserTenants(userId: string) {
    return this.prisma.tenantUser.findMany({
      where: {
        userId,
        isActive: true,
      },
      include: {
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
    });
  }
}

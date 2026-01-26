import { Controller, Post Version,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
} from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../database/prisma.service';
import { UserRole } from '@prisma/client';
import type { ApiResponse } from '@hos-marketplace/shared-types';
import * as bcrypt from 'bcrypt';

const teamUsers = [
  {
    email: 'admin@hos.test',
    firstName: 'Admin',
    lastName: 'User',
    role: UserRole.ADMIN,
  },
  {
    email: 'procurement@hos.test',
    firstName: 'Procurement',
    lastName: 'Manager',
    role: UserRole.PROCUREMENT,
  },
  {
    email: 'fulfillment@hos.test',
    firstName: 'Fulfillment',
    lastName: 'Staff',
    role: UserRole.FULFILLMENT,
  },
  {
    email: 'catalog@hos.test',
    firstName: 'Catalog',
    lastName: 'Editor',
    role: UserRole.CATALOG,
  },
  {
    email: 'marketing@hos.test',
    firstName: 'Marketing',
    lastName: 'Manager',
    role: UserRole.MARKETING,
  },
  {
    email: 'finance@hos.test',
    firstName: 'Finance',
    lastName: 'Manager',
    role: UserRole.FINANCE,
  },
  {
    email: 'cms@hos.test',
    firstName: 'CMS',
    lastName: 'Editor',
    role: UserRole.CMS_EDITOR,
  },
];

@ApiTags('admin')
@Version('1')
@Controller('admin')
export class CreateTeamUsersController {
  constructor(private prisma: PrismaService) {}

  @Public()
  @Post('create-team-users')
  @ApiOperation({ summary: 'Create team users', description: 'Creates or updates team users (Admin, Procurement, Fulfillment, Catalog, Marketing, Finance, CMS Editor) with default password. Public endpoint for development/testing.' })
  @SwaggerApiResponse({ status: 201, description: 'Team users created/updated successfully' })
  async createTeamUsers(): Promise<ApiResponse<any>> {
    // Generate password hash for "Test123!"
    const password = 'Test123!';
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    
    const results = [];

    for (const userData of teamUsers) {
      try {
        const existingUser = await this.prisma.user.findUnique({
          where: { email: userData.email },
        });

        if (existingUser) {
          await this.prisma.user.update({
            where: { id: existingUser.id },
            data: {
              password: passwordHash,
              role: userData.role,
              firstName: userData.firstName,
              lastName: userData.lastName,
            },
          });
          results.push({ email: userData.email, status: 'updated', role: userData.role });
        } else {
          await this.prisma.user.create({
            data: {
              email: userData.email,
              password: passwordHash,
              firstName: userData.firstName,
              lastName: userData.lastName,
              role: userData.role,
            },
          });
          results.push({ email: userData.email, status: 'created', role: userData.role });
        }
      } catch (error: any) {
        results.push({ email: userData.email, status: 'error', error: error.message });
      }
    }

    return {
      data: {
        users: results,
        totalCreated: results.filter((r) => r.status === 'created').length,
        totalUpdated: results.filter((r) => r.status === 'updated').length,
      },
      message: 'Team users creation completed',
    };
  }

  @Public()
  @Post('create-business-users')
  @ApiOperation({ summary: 'Create business users', description: 'Creates or updates business users (Seller, B2C Seller, Wholesaler, Customer) with default password. Public endpoint for development/testing.' })
  @SwaggerApiResponse({ status: 201, description: 'Business users created/updated successfully' })
  async createBusinessUsers(): Promise<ApiResponse<any>> {
    // Generate password hash for "Test123!"
    const password = 'Test123!';
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    
    const businessUsers = [
      {
        email: 'seller@hos.test',
        firstName: 'Seller',
        lastName: 'User',
        role: UserRole.SELLER,
        storeName: 'Test Seller Store',
      },
      {
        email: 'b2c-seller@hos.test',
        firstName: 'B2C',
        lastName: 'Seller',
        role: UserRole.B2C_SELLER,
        storeName: 'B2C Seller Store',
      },
      {
        email: 'wholesaler@hos.test',
        firstName: 'Wholesaler',
        lastName: 'User',
        role: UserRole.WHOLESALER,
        storeName: 'Wholesaler Store',
      },
      {
        email: 'customer@hos.test',
        firstName: 'Customer',
        lastName: 'User',
        role: UserRole.CUSTOMER,
      },
    ];

    const results = [];

    for (const userData of businessUsers) {
      try {
        const existingUser = await this.prisma.user.findUnique({
          where: { email: userData.email },
          include: { sellerProfile: true },
        });

        if (existingUser) {
          // Update existing user
          await this.prisma.user.update({
            where: { id: existingUser.id },
            data: {
              password: passwordHash,
              role: userData.role,
              firstName: userData.firstName,
              lastName: userData.lastName,
            },
          });

          // Create or update seller profile if needed
          if (userData.role === UserRole.SELLER || userData.role === UserRole.B2C_SELLER || userData.role === UserRole.WHOLESALER) {
            if (existingUser.sellerProfile) {
              await this.prisma.seller.update({
                where: { userId: existingUser.id },
                data: {
                  storeName: userData.storeName,
                  sellerType: userData.role === UserRole.WHOLESALER ? 'WHOLESALER' : userData.role === UserRole.B2C_SELLER ? 'B2C_SELLER' : 'B2C_SELLER',
                },
              });
            } else {
              // Create seller profile
              const slug = userData.storeName!.toLowerCase().replace(/\s+/g, '-');
              await this.prisma.seller.create({
                data: {
                  userId: existingUser.id,
                  storeName: userData.storeName!,
                  slug,
                  country: 'US',
                  timezone: 'UTC',
                  sellerType: userData.role === UserRole.WHOLESALER ? 'WHOLESALER' : userData.role === UserRole.B2C_SELLER ? 'B2C_SELLER' : 'B2C_SELLER',
                  logisticsOption: 'HOS_LOGISTICS',
                },
              });
            }
          }

          results.push({ email: userData.email, status: 'updated', role: userData.role });
        } else {
          // Create new user
          const newUser = await this.prisma.user.create({
            data: {
              email: userData.email,
              password: passwordHash,
              firstName: userData.firstName,
              lastName: userData.lastName,
              role: userData.role,
            },
          });

          // Create seller profile if needed
          if (userData.role === UserRole.SELLER || userData.role === UserRole.B2C_SELLER || userData.role === UserRole.WHOLESALER) {
            const slug = userData.storeName!.toLowerCase().replace(/\s+/g, '-');
            await this.prisma.seller.create({
              data: {
                userId: newUser.id,
                storeName: userData.storeName!,
                slug,
                country: 'US',
                timezone: 'UTC',
                sellerType: userData.role === UserRole.WHOLESALER ? 'WHOLESALER' : userData.role === UserRole.B2C_SELLER ? 'B2C_SELLER' : 'B2C_SELLER',
                logisticsOption: 'HOS_LOGISTICS',
              },
            });
          }

          // Create customer profile if needed
          if (userData.role === UserRole.CUSTOMER) {
            await this.prisma.customer.create({
              data: {
                userId: newUser.id,
              },
            });
          }

          results.push({ email: userData.email, status: 'created', role: userData.role });
        }
      } catch (error: any) {
        results.push({ email: userData.email, status: 'error', error: error.message });
      }
    }

    return {
      data: {
        users: results,
        totalCreated: results.filter((r) => r.status === 'created').length,
        totalUpdated: results.filter((r) => r.status === 'updated').length,
      },
      message: 'Business users creation completed',
    };
  }
}


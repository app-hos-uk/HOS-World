import { Controller, Post } from '@nestjs/common';
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

@Controller('admin')
export class CreateTeamUsersController {
  constructor(private prisma: PrismaService) {}

  @Public()
  @Post('create-team-users')
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
}


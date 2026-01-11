import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateCustomerGroupDto } from './dto/create-customer-group.dto';
import { CustomerGroupType } from '@prisma/client';

@Injectable()
export class CustomerGroupsService {
  private readonly logger = new Logger(CustomerGroupsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Create a new customer group
   */
  async create(createDto: CreateCustomerGroupDto) {
    // Check if name already exists
    const existing = await this.prisma.customerGroup.findUnique({
      where: { name: createDto.name },
    });

    if (existing) {
      throw new BadRequestException('Customer group name already exists');
    }

    return this.prisma.customerGroup.create({
      data: {
        name: createDto.name,
        description: createDto.description,
        type: createDto.type,
        isActive: createDto.isActive ?? true,
      },
    });
  }

  /**
   * Get all customer groups
   */
  async findAll(includeInactive = false) {
    return this.prisma.customerGroup.findMany({
      where: includeInactive ? {} : { isActive: true },
      include: {
        customers: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
          take: 10, // Limit for preview
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get customer group by ID
   */
  async findOne(id: string) {
    const group = await this.prisma.customerGroup.findUnique({
      where: { id },
      include: {
        customers: {
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

    if (!group) {
      throw new NotFoundException('Customer group not found');
    }

    return group;
  }

  /**
   * Update customer group
   */
  async update(id: string, updateDto: Partial<CreateCustomerGroupDto>) {
    await this.findOne(id);

    return this.prisma.customerGroup.update({
      where: { id },
      data: updateDto,
    });
  }

  /**
   * Add customer to group
   */
  async addCustomerToGroup(groupId: string, userId: string) {
    const group = await this.findOne(groupId);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        customerGroupId: groupId,
      },
    });
  }

  /**
   * Remove customer from group
   */
  async removeCustomerFromGroup(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        customerGroupId: null,
      },
    });
  }

  /**
   * Get customer's group
   */
  async getCustomerGroup(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        customerGroup: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user.customerGroup;
  }
}

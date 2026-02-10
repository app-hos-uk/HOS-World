import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { UserPrismaService } from '../database/prisma.service';

@Injectable()
export class CustomerGroupsService {
  constructor(private prisma: UserPrismaService) {}

  async create(data: { name: string; description?: string; type?: string; isActive?: boolean }) {
    const existing = await this.prisma.customerGroup.findUnique({ where: { name: data.name } });
    if (existing) throw new BadRequestException('Customer group name already exists');
    return this.prisma.customerGroup.create({ data: { name: data.name, description: data.description, type: data.type || 'MANUAL', isActive: data.isActive ?? true } });
  }

  async findAll(includeInactive = false) {
    return this.prisma.customerGroup.findMany({ where: includeInactive ? {} : { isActive: true }, orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string) {
    const group = await this.prisma.customerGroup.findUnique({ where: { id } });
    if (!group) throw new NotFoundException('Customer group not found');
    return group;
  }

  async update(id: string, data: any) {
    await this.findOne(id);
    return this.prisma.customerGroup.update({ where: { id }, data });
  }

  async addCustomerToGroup(groupId: string, userId: string) {
    await this.findOne(groupId);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return this.prisma.user.update({ where: { id: userId }, data: { customerGroupId: groupId } });
  }

  async removeCustomerFromGroup(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return this.prisma.user.update({ where: { id: userId }, data: { customerGroupId: null } });
  }
}

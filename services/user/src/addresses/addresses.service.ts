import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { UserPrismaService } from '../database/prisma.service';
import { CreateAddressDto, UpdateAddressDto } from './dto/create-address.dto';

@Injectable()
export class AddressesService {
  private readonly logger = new Logger(AddressesService.name);
  constructor(private prisma: UserPrismaService) {}

  async create(userId: string, dto: CreateAddressDto) {
    if (dto.isDefault) {
      await this.prisma.address.updateMany({ where: { userId }, data: { isDefault: false } });
    }
    return this.prisma.address.create({ data: { userId, ...dto, isDefault: dto.isDefault || false } });
  }

  async findAll(userId: string) {
    return this.prisma.address.findMany({ where: { userId }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }] });
  }

  async findOne(id: string, userId: string) {
    const addr = await this.prisma.address.findFirst({ where: { id, userId } });
    if (!addr) throw new NotFoundException('Address not found');
    return addr;
  }

  async update(id: string, userId: string, dto: UpdateAddressDto) {
    await this.findOne(id, userId);
    if (dto.isDefault === true) {
      await this.prisma.address.updateMany({ where: { userId, id: { not: id } }, data: { isDefault: false } });
    }
    return this.prisma.address.update({ where: { id }, data: dto });
  }

  async delete(id: string, userId: string) {
    const addr = await this.findOne(id, userId);
    await this.prisma.address.delete({ where: { id } });
    if (addr.isDefault) {
      const mostRecent = await this.prisma.address.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } });
      if (mostRecent) await this.prisma.address.update({ where: { id: mostRecent.id }, data: { isDefault: true } });
    }
  }

  async setDefault(id: string, userId: string) {
    await this.findOne(id, userId);
    await this.prisma.address.updateMany({ where: { userId, id: { not: id } }, data: { isDefault: false } });
    return this.prisma.address.update({ where: { id }, data: { isDefault: true } });
  }
}

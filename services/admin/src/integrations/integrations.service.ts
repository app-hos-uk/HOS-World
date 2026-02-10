import { Injectable, NotFoundException } from '@nestjs/common';
import { AdminPrismaService } from '../database/prisma.service';

@Injectable()
export class IntegrationsService {
  constructor(private prisma: AdminPrismaService) {}

  async create(data: any) { return this.prisma.integrationConfig.create({ data }); }

  async findAll() { return this.prisma.integrationConfig.findMany({ orderBy: { createdAt: 'desc' } }); }

  async findOne(id: string) {
    const config = await this.prisma.integrationConfig.findUnique({ where: { id }, include: { logs: { take: 20, orderBy: { createdAt: 'desc' } } } });
    if (!config) throw new NotFoundException('Integration not found');
    return config;
  }

  async update(id: string, data: any) { await this.findOne(id); return this.prisma.integrationConfig.update({ where: { id }, data }); }
  async delete(id: string) { await this.findOne(id); return this.prisma.integrationConfig.delete({ where: { id } }); }
}

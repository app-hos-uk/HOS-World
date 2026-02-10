import { Injectable, NotFoundException } from '@nestjs/common';
import { ContentPrismaService } from '../database/prisma.service';

@Injectable()
export class FandomsService {
  constructor(private prisma: ContentPrismaService) {}

  async findAll() { return this.prisma.fandom.findMany({ where: { isActive: true }, include: { characters: true }, orderBy: { name: 'asc' } }); }
  async findBySlug(slug: string) {
    const fandom = await this.prisma.fandom.findUnique({ where: { slug }, include: { characters: { where: { isActive: true } } } });
    if (!fandom) throw new NotFoundException('Fandom not found');
    return fandom;
  }
  async getCharacters(fandomId: string) { return this.prisma.character.findMany({ where: { fandomId, isActive: true } }); }
  async getCharacterBySlug(slug: string) {
    const char = await this.prisma.character.findUnique({ where: { slug }, include: { fandom: true } });
    if (!char) throw new NotFoundException('Character not found');
    return char;
  }
}

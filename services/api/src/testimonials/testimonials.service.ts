import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

interface CreateTestimonialDto {
  quote: string;
  author: string;
  city?: string;
  rating?: number;
  verified?: boolean;
  order?: number;
  isActive?: boolean;
}

interface UpdateTestimonialDto {
  quote?: string;
  author?: string;
  city?: string;
  rating?: number;
  verified?: boolean;
  order?: number;
  isActive?: boolean;
}

@Injectable()
export class TestimonialsService {
  private readonly logger = new Logger(TestimonialsService.name);

  constructor(private prisma: PrismaService) {}

  async findActive() {
    return this.prisma.testimonial.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
    });
  }

  async findAll() {
    return this.prisma.testimonial.findMany({
      orderBy: { order: 'asc' },
    });
  }

  async findOne(id: string) {
    const item = await this.prisma.testimonial.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Testimonial not found');
    return item;
  }

  async create(dto: CreateTestimonialDto) {
    return this.prisma.testimonial.create({
      data: {
        quote: dto.quote,
        author: dto.author,
        city: dto.city,
        rating: dto.rating ?? 5,
        verified: dto.verified ?? true,
        order: dto.order ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(id: string, dto: UpdateTestimonialDto) {
    await this.findOne(id);
    return this.prisma.testimonial.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.testimonial.delete({ where: { id } });
  }
}

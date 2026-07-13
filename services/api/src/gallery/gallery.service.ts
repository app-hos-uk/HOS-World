import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { slugify } from '@hos-marketplace/utils';
import { CreateGalleryAlbumDto } from './dto/create-gallery-album.dto';
import { UpdateGalleryAlbumDto } from './dto/update-gallery-album.dto';
import { CreateGalleryImageDto } from './dto/create-gallery-image.dto';
import { UpdateGalleryImageDto } from './dto/update-gallery-image.dto';
import { buildGalleryUploadFolder } from './gallery-folder.util';

type AlbumWithImages = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  eventDate: Date | null;
  location: string | null;
  countryCode: string | null;
  outletSlug: string | null;
  coverUrl: string | null;
  order: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  images?: Array<{
    id: string;
    albumId: string;
    url: string;
    alt: string | null;
    caption: string | null;
    order: number;
    createdAt: Date;
  }>;
  _count?: { images: number };
};

@Injectable()
export class GalleryService {
  constructor(private readonly prisma: PrismaService) {}

  private serializeAlbum(album: AlbumWithImages) {
    const imageCount = album._count?.images ?? album.images?.length ?? 0;
    const cover =
      album.coverUrl ||
      album.images?.find((img) => img.order === 0)?.url ||
      album.images?.[0]?.url ||
      null;

    return {
      id: album.id,
      title: album.title,
      slug: album.slug,
      description: album.description,
      eventDate: album.eventDate,
      location: album.location,
      countryCode: album.countryCode,
      outletSlug: album.outletSlug,
      uploadFolder: buildGalleryUploadFolder(album),
      coverUrl: cover,
      order: album.order,
      isActive: album.isActive,
      imageCount,
      images: album.images
        ? album.images.map((img) => ({
            id: img.id,
            albumId: img.albumId,
            url: img.url,
            alt: img.alt,
            caption: img.caption,
            order: img.order,
            createdAt: img.createdAt,
          }))
        : undefined,
      createdAt: album.createdAt,
      updatedAt: album.updatedAt,
    };
  }

  private async generateUniqueSlug(title: string, excludeId?: string): Promise<string> {
    const baseSlug = slugify(title);
    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const existing = await this.prisma.galleryAlbum.findUnique({ where: { slug } });
      if (!existing || existing.id === excludeId) break;
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }

  private async getNextAlbumOrder(): Promise<number> {
    const max = await this.prisma.galleryAlbum.aggregate({ _max: { order: true } });
    return (max._max.order ?? -1) + 1;
  }

  private async getNextImageOrder(albumId: string): Promise<number> {
    const max = await this.prisma.galleryImage.aggregate({
      where: { albumId },
      _max: { order: true },
    });
    return (max._max.order ?? -1) + 1;
  }

  async findActiveAlbums() {
    const rows = await this.prisma.galleryAlbum.findMany({
      where: { isActive: true },
      orderBy: [{ order: 'asc' }, { eventDate: 'desc' }, { createdAt: 'desc' }],
      include: {
        images: { orderBy: { order: 'asc' }, take: 1 },
        _count: { select: { images: true } },
      },
    });
    return rows.map((row) => this.serializeAlbum(row));
  }

  async findAlbumBySlug(slug: string) {
    const album = await this.prisma.galleryAlbum.findFirst({
      where: { slug, isActive: true },
      include: { images: { orderBy: { order: 'asc' } } },
    });
    if (!album) throw new NotFoundException('Gallery album not found');
    return this.serializeAlbum(album);
  }

  async findAllAlbums() {
    const rows = await this.prisma.galleryAlbum.findMany({
      orderBy: [{ order: 'asc' }, { eventDate: 'desc' }, { createdAt: 'desc' }],
      include: {
        images: { orderBy: { order: 'asc' } },
        _count: { select: { images: true } },
      },
    });
    return rows.map((row) => this.serializeAlbum(row));
  }

  async findAlbumById(id: string) {
    const album = await this.prisma.galleryAlbum.findUnique({
      where: { id },
      include: { images: { orderBy: { order: 'asc' } }, _count: { select: { images: true } } },
    });
    if (!album) throw new NotFoundException('Gallery album not found');
    return this.serializeAlbum(album);
  }

  async createAlbum(dto: CreateGalleryAlbumDto) {
    const slug = await this.generateUniqueSlug(dto.title);
    const order = dto.order ?? (await this.getNextAlbumOrder());
    const album = await this.prisma.galleryAlbum.create({
      data: {
        title: dto.title.trim(),
        slug,
        description: dto.description?.trim() || null,
        eventDate: dto.eventDate ? new Date(dto.eventDate) : null,
        location: dto.location?.trim() || null,
        countryCode: dto.countryCode?.trim() || null,
        outletSlug: dto.outletSlug?.trim() || null,
        coverUrl: dto.coverUrl || null,
        order,
        isActive: dto.isActive ?? true,
      },
      include: { images: true, _count: { select: { images: true } } },
    });
    return this.serializeAlbum(album);
  }

  async updateAlbum(id: string, dto: UpdateGalleryAlbumDto) {
    const existing = await this.prisma.galleryAlbum.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Gallery album not found');

    let slug = existing.slug;
    if (dto.title && dto.title.trim() !== existing.title) {
      slug = await this.generateUniqueSlug(dto.title, id);
    }

    const album = await this.prisma.galleryAlbum.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
        ...(dto.eventDate !== undefined
          ? { eventDate: dto.eventDate ? new Date(dto.eventDate) : null }
          : {}),
        ...(dto.location !== undefined ? { location: dto.location?.trim() || null } : {}),
        ...(dto.countryCode !== undefined ? { countryCode: dto.countryCode?.trim() || null } : {}),
        ...(dto.outletSlug !== undefined ? { outletSlug: dto.outletSlug?.trim() || null } : {}),
        ...(dto.coverUrl !== undefined ? { coverUrl: dto.coverUrl || null } : {}),
        ...(dto.order !== undefined ? { order: dto.order } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        slug,
      },
      include: { images: { orderBy: { order: 'asc' } }, _count: { select: { images: true } } },
    });
    return this.serializeAlbum(album);
  }

  async deleteAlbum(id: string) {
    const existing = await this.prisma.galleryAlbum.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Gallery album not found');
    await this.prisma.galleryAlbum.delete({ where: { id } });
  }

  async addImage(albumId: string, dto: CreateGalleryImageDto) {
    const album = await this.prisma.galleryAlbum.findUnique({ where: { id: albumId } });
    if (!album) throw new NotFoundException('Gallery album not found');

    const order = dto.order ?? (await this.getNextImageOrder(albumId));
    const image = await this.prisma.galleryImage.create({
      data: {
        albumId,
        url: dto.url,
        alt: dto.alt?.trim() || null,
        caption: dto.caption?.trim() || null,
        order,
      },
    });

    if (!album.coverUrl) {
      await this.prisma.galleryAlbum.update({
        where: { id: albumId },
        data: { coverUrl: image.url },
      });
    }

    return image;
  }

  async addImages(albumId: string, images: CreateGalleryImageDto[]) {
    const results = [];
    for (const dto of images) {
      results.push(await this.addImage(albumId, dto));
    }
    return results;
  }

  async updateImage(id: string, dto: UpdateGalleryImageDto) {
    const existing = await this.prisma.galleryImage.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Gallery image not found');

    return this.prisma.galleryImage.update({
      where: { id },
      data: {
        ...(dto.url !== undefined ? { url: dto.url } : {}),
        ...(dto.alt !== undefined ? { alt: dto.alt?.trim() || null } : {}),
        ...(dto.caption !== undefined ? { caption: dto.caption?.trim() || null } : {}),
        ...(dto.order !== undefined ? { order: dto.order } : {}),
      },
    });
  }

  async deleteImage(id: string) {
    const existing = await this.prisma.galleryImage.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Gallery image not found');

    const album = await this.prisma.galleryAlbum.findUnique({
      where: { id: existing.albumId },
      include: { images: { orderBy: { order: 'asc' } } },
    });

    await this.prisma.galleryImage.delete({ where: { id } });

    if (album?.coverUrl === existing.url) {
      const nextCover =
        album.images.find((img) => img.id !== id && img.url !== existing.url)?.url || null;
      await this.prisma.galleryAlbum.update({
        where: { id: album.id },
        data: { coverUrl: nextCover },
      });
    }
  }

  async reorderImages(albumId: string, orderedIds: string[]) {
    const album = await this.prisma.galleryAlbum.findUnique({ where: { id: albumId } });
    if (!album) throw new NotFoundException('Gallery album not found');

    await this.prisma.$transaction(
      orderedIds.map((id, index) =>
        this.prisma.galleryImage.update({
          where: { id },
          data: { order: index },
        }),
      ),
    );

    return this.findAlbumById(albumId);
  }
}

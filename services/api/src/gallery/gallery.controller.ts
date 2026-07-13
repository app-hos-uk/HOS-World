import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { GalleryService } from './gallery.service';
import { Public } from '../common/decorators/public.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateGalleryAlbumDto } from './dto/create-gallery-album.dto';
import { UpdateGalleryAlbumDto } from './dto/update-gallery-album.dto';
import { CreateGalleryImageDto } from './dto/create-gallery-image.dto';
import { UpdateGalleryImageDto } from './dto/update-gallery-image.dto';
import { ReorderGalleryImagesDto } from './dto/reorder-gallery-images.dto';

@ApiTags('gallery')
@Controller('gallery')
export class GalleryController {
  constructor(private readonly service: GalleryService) {}

  @Get('albums')
  @Public()
  @ApiOperation({ summary: 'List active gallery albums (public)' })
  async getActiveAlbums() {
    const data = await this.service.findActiveAlbums();
    return { data, message: 'OK' };
  }

  @Get('albums/:slug')
  @Public()
  @ApiOperation({ summary: 'Get gallery album with images by slug (public)' })
  async getAlbumBySlug(@Param('slug') slug: string) {
    const data = await this.service.findAlbumBySlug(slug);
    return { data, message: 'OK' };
  }

  @Get('admin/albums')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'List all gallery albums (admin)' })
  async getAllAlbums() {
    const data = await this.service.findAllAlbums();
    return { data, message: 'OK' };
  }

  @Get('admin/albums/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get gallery album by id (admin)' })
  async getAlbumById(@Param('id') id: string) {
    const data = await this.service.findAlbumById(id);
    return { data, message: 'OK' };
  }

  @Post('albums')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create gallery album' })
  async createAlbum(@Body() body: CreateGalleryAlbumDto) {
    const data = await this.service.createAlbum(body);
    return { data, message: 'Gallery album created' };
  }

  @Put('albums/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update gallery album' })
  async updateAlbum(@Param('id') id: string, @Body() body: UpdateGalleryAlbumDto) {
    const data = await this.service.updateAlbum(id, body);
    return { data, message: 'Gallery album updated' };
  }

  @Delete('albums/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Delete gallery album' })
  async deleteAlbum(@Param('id') id: string) {
    await this.service.deleteAlbum(id);
    return { data: null, message: 'Gallery album deleted' };
  }

  @Post('albums/:id/images')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Add image to gallery album' })
  async addImage(@Param('id') id: string, @Body() body: CreateGalleryImageDto) {
    const data = await this.service.addImage(id, body);
    return { data, message: 'Image added' };
  }

  @Post('albums/:id/images/bulk')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Add multiple images to gallery album' })
  async addImages(@Param('id') id: string, @Body() body: CreateGalleryImageDto[]) {
    const data = await this.service.addImages(id, body);
    return { data, message: 'Images added' };
  }

  @Put('images/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update gallery image' })
  async updateImage(@Param('id') id: string, @Body() body: UpdateGalleryImageDto) {
    const data = await this.service.updateImage(id, body);
    return { data, message: 'Image updated' };
  }

  @Delete('images/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Delete gallery image' })
  async deleteImage(@Param('id') id: string) {
    await this.service.deleteImage(id);
    return { data: null, message: 'Image deleted' };
  }

  @Put('albums/:id/images/reorder')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Reorder gallery images' })
  async reorderImages(@Param('id') id: string, @Body() body: ReorderGalleryImagesDto) {
    const data = await this.service.reorderImages(id, body.orderedIds);
    return { data, message: 'Images reordered' };
  }
}

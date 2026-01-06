import {
  Controller,
  Post,
  Delete,
  Get,
  Body,
  UseGuards,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
  Param,
  Res,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { UploadsService } from './uploads.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { Response } from 'express';
import { existsSync, mkdirSync } from 'fs';

// Create storage configuration (reads from env directly since decorators evaluate before constructor)
function createStorage() {
  const uploadBasePath = process.env.UPLOAD_BASE_PATH || '/data/uploads';
  
  return diskStorage({
    destination: (req, file, cb) => {
      // Get folder from body or default to 'uploads'
      const folder = (req.body?.folder as string) || 'uploads';
      // Sanitize folder name
      const safeFolder = folder.replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 50) || 'uploads';
      const destPath = join(uploadBasePath, safeFolder);
      
      // Ensure directory exists
      if (!existsSync(destPath)) {
        mkdirSync(destPath, { recursive: true });
      }
      
      cb(null, destPath);
    },
    filename: (req, file, cb) => {
      // Generate UUID-based filename
      const ext = extname(file.originalname).toLowerCase();
      const filename = `${randomUUID()}${ext}`;
      cb(null, filename);
    },
  });
}

@Controller('uploads')
export class UploadsController {
  constructor(
    private readonly uploadsService: UploadsService,
    private readonly configService: ConfigService,
  ) {}

  @Post('single')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file', { 
    storage: createStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } 
  }))
  async uploadSingle(
    @UploadedFile() file: Express.Multer.File,
    @Body('folder') folder?: string,
  ): Promise<ApiResponse<{ url: string }>> {
    const result = await this.uploadsService.uploadFile(file, folder || 'uploads');
    return {
      data: { url: result.url },
      message: 'File uploaded successfully',
    };
  }

  @Post('multiple')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FilesInterceptor('files', 10, { 
    storage: createStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } 
  }))
  async uploadMultiple(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('folder') folder?: string,
  ): Promise<ApiResponse<{ urls: string[] }>> {
    const results = await this.uploadsService.uploadMultipleFiles(files, folder || 'uploads');
    return {
      data: { urls: results.map((r) => r.url) },
      message: 'Files uploaded successfully',
    };
  }

  @Get(':folder/:filename')
  async serveFile(
    @Param('folder') folder: string,
    @Param('filename') filename: string,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const filePath = this.uploadsService.getFileForServing(folder, filename);
      
      // Set caching headers (1 year for images)
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('Content-Type', this.getContentType(filename));
      
      res.sendFile(filePath);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new NotFoundException('File not found');
    }
  }

  @Delete(':url')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SELLER', 'ADMIN')
  async deleteFile(@Param('url') url: string): Promise<ApiResponse<{ message: string }>> {
    await this.uploadsService.deleteFile(decodeURIComponent(url));
    return {
      data: { message: 'File deleted successfully' },
      message: 'File deleted successfully',
    };
  }

  /**
   * Get content type based on file extension
   */
  private getContentType(filename: string): string {
    const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
    const contentTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
    };
    return contentTypes[ext] || 'application/octet-stream';
  }
}


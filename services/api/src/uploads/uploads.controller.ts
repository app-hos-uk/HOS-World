import {
  Controller,
  Post,
  Delete,
  Get,
  Body,
  Query,
  UseGuards,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
  Param,
  Res,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiParam,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { UploadsService } from './uploads.service';
import { StorageService } from '../storage/storage.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';
import { diskStorage, memoryStorage } from 'multer';
import { extname, join } from 'path';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { Response } from 'express';
import { existsSync, mkdirSync } from 'fs';
import { StorageProvider } from '../storage/storage.service';

// Determine storage provider at module load time
const storageProvider = process.env.STORAGE_PROVIDER || 'local';
const useCloudStorage = ['cloudinary', 's3', 'minio'].includes(storageProvider);

// Create storage configuration based on provider
function createStorage() {
  // For cloud storage (Cloudinary, S3, MinIO), use memory storage to get buffer
  if (useCloudStorage) {
    return memoryStorage();
  }

  // For local storage, use disk storage
  const uploadBasePath = process.env.UPLOAD_BASE_PATH || '/data/uploads';

  return diskStorage({
    destination: (req, file, cb) => {
      const folder = (req.body?.folder as string) || 'uploads';
      const safeFolder = folder.replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 50) || 'uploads';
      const destPath = join(uploadBasePath, safeFolder);

      if (!existsSync(destPath)) {
        mkdirSync(destPath, { recursive: true });
      }

      cb(null, destPath);
    },
    filename: (req, file, cb) => {
      const ext = extname(file.originalname).toLowerCase();
      const filename = `${randomUUID()}${ext}`;
      cb(null, filename);
    },
  });
}

@ApiTags('uploads')
@Controller('uploads')
export class UploadsController {
  constructor(
    private readonly uploadsService: UploadsService,
    private readonly storageService: StorageService,
    private readonly configService: ConfigService,
  ) {}

  @Post('single')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: createStorage(),
      limits: { fileSize: 250 * 1024 }, // 250KB limit for product images
    }),
  )
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Upload single file',
    description: 'Uploads a single file. Supports images up to 250KB for product images.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'File to upload',
        },
        folder: {
          type: 'string',
          description: 'Optional folder name (default: uploads)',
        },
      },
    },
  })
  @SwaggerApiResponse({ status: 201, description: 'File uploaded successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid file or file too large' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  async uploadSingle(
    @UploadedFile() file: Express.Multer.File,
    @Body('folder') folder?: string,
  ): Promise<ApiResponse<{ url: string }>> {
    const targetFolder = folder || 'products';

    // Use StorageService for cloud providers (Cloudinary, S3, MinIO)
    if (useCloudStorage) {
      const result = await this.storageService.uploadFile(file, targetFolder);
      return {
        data: { url: result.url },
        message: 'File uploaded successfully',
      };
    }

    // Fallback to local disk storage
    const result = await this.uploadsService.uploadFile(file, targetFolder);
    return {
      data: { url: result.url },
      message: 'File uploaded successfully',
    };
  }

  @Post('multiple')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FilesInterceptor('files', 4, {
      storage: createStorage(),
      limits: { fileSize: 250 * 1024 }, // 250KB limit, max 4 files for product images
    }),
  )
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Upload multiple files',
    description:
      'Uploads multiple files (up to 4). Supports images up to 250KB each for product images.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
          description: 'Files to upload (max 10)',
        },
        folder: {
          type: 'string',
          description: 'Optional folder name (default: uploads)',
        },
      },
    },
  })
  @SwaggerApiResponse({ status: 201, description: 'Files uploaded successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid files or files too large' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  async uploadMultiple(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('folder') folder?: string,
  ): Promise<ApiResponse<{ urls: string[] }>> {
    const targetFolder = folder || 'products';

    // Use StorageService for cloud providers (Cloudinary, S3, MinIO)
    if (useCloudStorage) {
      const results = await this.storageService.uploadMultipleFiles(files, targetFolder);
      return {
        data: { urls: results.map((r) => r.url) },
        message: 'Files uploaded successfully',
      };
    }

    // Fallback to local disk storage
    const results = await this.uploadsService.uploadMultipleFiles(files, targetFolder);
    return {
      data: { urls: results.map((r) => r.url) },
      message: 'Files uploaded successfully',
    };
  }

  @Public()
  @Get(':folder/:filename')
  @ApiOperation({
    summary: 'Serve uploaded file',
    description: 'Serves an uploaded file. Public endpoint, no authentication required.',
  })
  @ApiParam({ name: 'folder', description: 'Folder name', type: String })
  @ApiParam({ name: 'filename', description: 'File name', type: String })
  @SwaggerApiResponse({ status: 200, description: 'File served successfully', type: 'file' })
  @SwaggerApiResponse({ status: 404, description: 'File not found' })
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

  @Get('cloudinary/signature')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get Cloudinary upload signature',
    description:
      'Returns Cloudinary upload signature for direct frontend uploads. Allows frontend to upload directly to Cloudinary without going through backend.',
  })
  @ApiQuery({
    name: 'folder',
    required: false,
    type: String,
    description: 'Upload folder (default: uploads)',
  })
  @SwaggerApiResponse({ status: 200, description: 'Upload signature retrieved successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Cloudinary not configured' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  async getCloudinarySignature(@Query('folder') folder?: string): Promise<
    ApiResponse<{
      signature: string;
      timestamp: number;
      apiKey: string;
      cloudName: string;
      folder: string;
    }>
  > {
    const signature = await this.storageService.getCloudinaryUploadSignature(folder || 'uploads');
    return {
      data: signature,
      message: 'Upload signature retrieved successfully',
    };
  }

  @Delete(':url')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SELLER', 'B2C_SELLER', 'WHOLESALER', 'ADMIN')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Delete uploaded file (Seller/Admin only)',
    description: 'Deletes an uploaded file. Seller and Admin access required.',
  })
  @ApiParam({ name: 'url', description: 'File URL (URL encoded)', type: String })
  @SwaggerApiResponse({ status: 200, description: 'File deleted successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Seller/Admin access required' })
  @SwaggerApiResponse({ status: 404, description: 'File not found' })
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

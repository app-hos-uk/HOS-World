import {
  Controller,
  Post,
  Delete,
  Body,
  UseGuards,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { UploadsService } from './uploads.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';
import { diskStorage } from 'multer';
import { extname } from 'path';

const storage = diskStorage({
  destination: './uploads',
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
  },
});

@Controller('uploads')
@UseGuards(JwtAuthGuard)
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('single')
  @UseInterceptors(FileInterceptor('file', { storage, limits: { fileSize: 10 * 1024 * 1024 } }))
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
  @UseInterceptors(FilesInterceptor('files', 10, { storage, limits: { fileSize: 10 * 1024 * 1024 } }))
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

  @Delete(':url')
  @UseGuards(RolesGuard)
  @Roles('SELLER', 'ADMIN')
  async deleteFile(@Param('url') url: string): Promise<ApiResponse<{ message: string }>> {
    await this.uploadsService.deleteFile(decodeURIComponent(url));
    return {
      data: { message: 'File deleted successfully' },
      message: 'File deleted successfully',
    };
  }
}


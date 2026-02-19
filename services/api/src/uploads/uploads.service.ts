import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, unlinkSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

interface UploadResult {
  url: string;
  key?: string;
  publicId?: string;
}

@Injectable()
export class UploadsService {
  private readonly uploadBasePath: string;
  private readonly apiBaseUrl: string;

  constructor(private configService: ConfigService) {
    // Railway Volume path (configurable via env, defaults to /data/uploads)
    this.uploadBasePath = this.configService.get<string>('UPLOAD_BASE_PATH') || '/data/uploads';

    // API base URL for constructing absolute URLs
    // Priority: API_URL env var > construct from PORT > fallback to production URL
    const apiUrl = this.configService.get<string>('API_URL');
    if (apiUrl) {
      this.apiBaseUrl = apiUrl.endsWith('/api') ? apiUrl : `${apiUrl}/api`;
    } else {
      const port = this.configService.get<string>('PORT') || '3001';
      const host =
        process.env.RAILWAY_PUBLIC_DOMAIN || process.env.RAILWAY_ENVIRONMENT_NAME
          ? `https://hos-marketplaceapi-production.up.railway.app`
          : `http://localhost:${port}`;
      this.apiBaseUrl = `${host}/api`;
    }
  }

  /**
   * Sanitize folder name to prevent path traversal
   */
  private sanitizeFolder(folder: string): string {
    // Remove path traversal attempts, keep only alphanumeric, dash, underscore
    return folder.replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 50) || 'uploads';
  }

  /**
   * Sanitize filename and generate UUID-based name
   */
  private sanitizeFilename(originalname: string): string {
    // Get file extension
    const ext = originalname.substring(originalname.lastIndexOf('.')).toLowerCase();
    // Generate UUID filename
    return `${randomUUID()}${ext}`;
  }

  /**
   * Get full file path on disk
   */
  private getFilePath(folder: string, filename: string): string {
    const safeFolder = this.sanitizeFolder(folder);
    const fullPath = join(this.uploadBasePath, safeFolder);
    // Ensure directory exists
    if (!existsSync(fullPath)) {
      mkdirSync(fullPath, { recursive: true });
    }
    return join(fullPath, filename);
  }

  /**
   * Get public URL for a file
   */
  private getPublicUrl(folder: string, filename: string): string {
    const safeFolder = this.sanitizeFolder(folder);
    return `${this.apiBaseUrl}/uploads/${safeFolder}/${filename}`;
  }

  /**
   * Validate file content by magic bytes (prevents MIME spoofing)
   */
  private validateFileContent(buffer: Buffer): boolean {
    if (!buffer || buffer.length < 12) return false;
    // JPEG: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return true;
    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return true;
    // GIF: GIF87a or GIF89a
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) return true;
    // WebP: RIFF....WEBP
    if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
        buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) return true;
    // SVG: <?xml or <svg
    const start = buffer.slice(0, 200).toString('utf8').trim().toLowerCase();
    if (start.startsWith('<?xml') || start.startsWith('<svg')) return true;
    return false;
  }

  async uploadFile(file: Express.Multer.File, folder: string = 'uploads'): Promise<UploadResult> {
    // Validate file
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Validate file type (client-provided)
    const allowedMimeTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Invalid file type. Only images are allowed.');
    }

    // Validate actual file content (magic bytes) to prevent MIME spoofing
    const buffer = file.buffer || (file.path ? readFileSync(file.path) : null);
    if (buffer && !this.validateFileContent(buffer)) {
      throw new BadRequestException('File content does not match declared type. Invalid or unsupported image.');
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new BadRequestException('File size exceeds 10MB limit');
    }

    // Sanitize folder - multer already saved the file with UUID filename
    const safeFolder = this.sanitizeFolder(folder);
    // Use the filename that multer generated (already UUID-based)
    const savedFilename = file.filename;

    if (!savedFilename) {
      throw new BadRequestException('File was not saved properly');
    }

    // Construct public URL using the saved filename
    const publicUrl = this.getPublicUrl(safeFolder, savedFilename);

    return {
      url: publicUrl,
      key: `${safeFolder}/${savedFilename}`,
    };
  }

  async uploadMultipleFiles(
    files: Express.Multer.File[],
    folder: string = 'uploads',
  ): Promise<UploadResult[]> {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided');
    }

    if (files.length > 10) {
      throw new BadRequestException('Maximum 10 files allowed');
    }

    const uploadPromises = files.map((file) => this.uploadFile(file, folder));
    return Promise.all(uploadPromises);
  }

  /**
   * Get file path for serving
   */
  getFileForServing(folder: string, filename: string): string {
    // Explicit path traversal prevention
    if (folder.includes('..') || filename.includes('..')) {
      throw new BadRequestException('Invalid path');
    }
    const safeFolder = this.sanitizeFolder(folder);
    const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '').substring(0, 255);
    if (!safeFilename) {
      throw new BadRequestException('Invalid filename');
    }
    const filePath = join(this.uploadBasePath, safeFolder, safeFilename);

    if (!existsSync(filePath)) {
      throw new NotFoundException('File not found');
    }

    return filePath;
  }

  async deleteFile(url: string): Promise<void> {
    try {
      // Extract folder and filename from URL
      // URL format: /api/uploads/{folder}/{filename}
      const urlMatch = url.match(/\/uploads\/([^/]+)\/([^/]+)$/);
      if (!urlMatch) {
        throw new BadRequestException('Invalid file URL format');
      }

      const [, folder, filename] = urlMatch;
      const filePath = this.getFilePath(folder, filename);

      if (existsSync(filePath)) {
        unlinkSync(filePath);
      }
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      console.error('Error deleting file:', error);
      throw new BadRequestException('Failed to delete file');
    }
  }
}

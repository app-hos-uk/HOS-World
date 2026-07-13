import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, unlinkSync, mkdirSync, readFileSync } from 'fs';
import { join, parse as parsePath, resolve } from 'path';
import { randomUUID } from 'crypto';
import { QueueService, JobType } from '../queue/queue.service';
import {
  parseUploadRelativePath,
  resolveUploadFilePath,
  sanitizeUploadFolder,
} from '../common/utils/sanitize-upload-folder';

let sharp: any;
try {
  sharp = require('sharp');
} catch {
  sharp = null;
}

interface UploadResult {
  url: string;
  key?: string;
  publicId?: string;
}

interface ImageSizes {
  original: string;
  thumbnail?: string;
  medium?: string;
  large?: string;
}

const IMAGE_SIZE_CONFIGS = [
  { suffix: '-thumb', width: 150, height: 150 },
  { suffix: '-medium', width: 600, height: 600 },
  { suffix: '-large', width: 1200, height: 1200 },
] as const;

@Injectable()
export class UploadsService implements OnModuleInit {
  private readonly logger = new Logger(UploadsService.name);
  private readonly uploadBasePath: string;
  private readonly apiBaseUrl: string;

  constructor(
    private configService: ConfigService,
    private queueService: QueueService,
  ) {
    this.uploadBasePath = this.resolveUploadBasePath();

    // API base URL for constructing absolute URLs
    // Priority: API_URL env var > construct from PORT > fallback to production URL
    const apiUrl = this.configService.get<string>('API_URL');
    if (apiUrl) {
      this.apiBaseUrl = apiUrl.endsWith('/api') ? apiUrl : `${apiUrl}/api`;
    } else {
      const port = this.configService.get<string>('PORT') || '3001';
      const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN?.trim();
      const host = railwayDomain
        ? `https://${railwayDomain.replace(/^https?:\/\//, '')}`
        : `http://localhost:${port}`;
      this.apiBaseUrl = `${host}/api`;
    }
  }

  private resolveUploadBasePath(): string {
    const explicit = this.configService.get<string>('UPLOAD_BASE_PATH');
    if (explicit) return explicit;
    try {
      const target = '/data/uploads';
      if (!existsSync('/data')) mkdirSync('/data', { recursive: true });
      if (!existsSync(target)) mkdirSync(target, { recursive: true });
      return target;
    } catch {
      const fallback = resolve(process.cwd(), 'uploads');
      if (!existsSync(fallback)) mkdirSync(fallback, { recursive: true });
      this.logger.warn(`Using local uploads directory: ${fallback}`);
      return fallback;
    }
  }

  async onModuleInit() {
    if (!sharp) {
      this.logger.log('sharp not available — image processing pipeline disabled');
      return;
    }

    this.queueService.registerProcessor(JobType.IMAGE_PROCESSING, async (job) => {
      const { imageUrl, transformations } = job.data;
      return this.processImage(imageUrl, transformations);
    });

    this.logger.log('Registered IMAGE_PROCESSING job processor');
  }

  /**
   * Process an uploaded image into multiple sizes using sharp.
   * Reads from the local upload path, writes resized variants alongside the original.
   */
  async processImage(imageUrl: string, _transformations?: any): Promise<ImageSizes> {
    if (!sharp) {
      this.logger.warn('sharp is not available — skipping image processing');
      return { original: imageUrl };
    }

    const urlMatch = imageUrl.match(/\/uploads\/(.+)$/);
    if (!urlMatch) {
      this.logger.warn(`Cannot parse image URL for processing: ${imageUrl}`);
      return { original: imageUrl };
    }

    const { folder, filename } = parseUploadRelativePath(urlMatch[1]);
    const filePath = resolveUploadFilePath(this.uploadBasePath, folder, filename);

    if (!existsSync(filePath)) {
      this.logger.warn(`Source file not found for processing: ${filePath}`);
      return { original: imageUrl };
    }

    const { name: baseName, ext } = parsePath(filename);
    const result: ImageSizes = { original: imageUrl };
    const safeFolder = sanitizeUploadFolder(folder);

    for (const config of IMAGE_SIZE_CONFIGS) {
      try {
        const resizedFilename = `${baseName}${config.suffix}${ext}`;
        const outputPath = resolveUploadFilePath(this.uploadBasePath, safeFolder, resizedFilename);

        await sharp(filePath)
          .resize(config.width, config.height, { fit: 'inside', withoutEnlargement: true })
          .toFile(outputPath);

        const key = config.suffix.replace('-', '') as 'thumb' | 'medium' | 'large';
        const sizeKey = key === 'thumb' ? 'thumbnail' : key;
        result[sizeKey] = this.getPublicUrl(safeFolder, resizedFilename);
      } catch (err: any) {
        this.logger.error(`Failed to generate ${config.suffix} for ${filename}: ${err.message}`);
      }
    }

    return result;
  }

  /**
   * Get full file path on disk (creates nested directories as needed).
   */
  private getFilePath(folder: string, filename: string): string {
    const safeFolder = sanitizeUploadFolder(folder);
    const dirPath = join(this.uploadBasePath, ...safeFolder.split('/'));
    if (!existsSync(dirPath)) {
      mkdirSync(dirPath, { recursive: true });
    }
    return join(dirPath, filename);
  }

  /**
   * Get public URL for a file
   */
  private getPublicUrl(folder: string, filename: string): string {
    const safeFolder = sanitizeUploadFolder(folder);
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
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47)
      return true;
    // GIF: GIF87a or GIF89a
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) return true;
    // WebP: RIFF....WEBP
    if (
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46 &&
      buffer[8] === 0x57 &&
      buffer[9] === 0x45 &&
      buffer[10] === 0x42 &&
      buffer[11] === 0x50
    )
      return true;
    // SVG is intentionally NOT accepted: SVG files can embed scripts and are a stored-XSS
    // vector when served inline from a trusted origin.
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
      'application/pdf',
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Invalid file type. Only images (JPEG, PNG, GIF, WebP) and PDF documents are allowed.',
      );
    }

    // Validate actual file content (magic bytes) to prevent MIME spoofing.
    const isPdf = file.mimetype === 'application/pdf';
    const buffer = file.buffer || (file.path ? readFileSync(file.path) : null);
    if (buffer) {
      if (isPdf) {
        // PDF files must start with %PDF
        const header = buffer.subarray(0, 5).toString('ascii');
        if (!header.startsWith('%PDF')) {
          throw new BadRequestException(
            'File content does not match declared type. Invalid PDF document.',
          );
        }
      } else if (!this.validateFileContent(buffer)) {
        throw new BadRequestException(
          'File content does not match declared type. Invalid or unsupported image.',
        );
      }
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new BadRequestException('File size exceeds 10MB limit');
    }

    // Sanitize folder - multer already saved the file with UUID filename
    const safeFolder = sanitizeUploadFolder(folder);
    // Use the filename that multer generated (already UUID-based)
    const savedFilename = file.filename;

    if (!savedFilename) {
      throw new BadRequestException('File was not saved properly');
    }

    // Construct public URL using the saved filename
    const publicUrl = this.getPublicUrl(safeFolder, savedFilename);

    // Queue background image processing if sharp is available
    if (sharp) {
      try {
        await this.queueService.queueImageProcessing(publicUrl, {});
      } catch (err: any) {
        this.logger.warn(`Failed to queue image processing: ${err.message}`);
      }
    }

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
    const filePath = resolveUploadFilePath(this.uploadBasePath, folder, filename);

    if (!existsSync(filePath)) {
      throw new NotFoundException('File not found');
    }

    return filePath;
  }

  async deleteFile(url: string): Promise<void> {
    try {
      const urlMatch = url.match(/\/uploads\/(.+)$/);
      if (!urlMatch) {
        throw new BadRequestException('Invalid file URL format');
      }

      const { folder, filename } = parseUploadRelativePath(urlMatch[1]);
      const filePath = this.getFilePath(folder, filename);

      if (existsSync(filePath)) {
        unlinkSync(filePath);
      }
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Error deleting file: ${(error as Error)?.message}`);
      throw new BadRequestException('Failed to delete file');
    }
  }
}

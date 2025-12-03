import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import { v2 as cloudinary } from 'cloudinary';

export enum StorageProvider {
  LOCAL = 'local',
  S3 = 's3',
  MINIO = 'minio',
  CLOUDINARY = 'cloudinary',
}

export interface UploadResult {
  url: string;
  key?: string;
  publicId?: string;
  provider: StorageProvider;
}

@Injectable()
export class StorageService {
  private provider: StorageProvider;
  private readonly logger = new Logger(StorageService.name);

  constructor(private configService: ConfigService) {
    this.provider = (this.configService.get('STORAGE_PROVIDER') || 'local') as StorageProvider;
    
    // Initialize Cloudinary if configured
    if (this.provider === StorageProvider.CLOUDINARY) {
      const cloudName = this.configService.get<string>('CLOUDINARY_CLOUD_NAME');
      const apiKey = this.configService.get<string>('CLOUDINARY_API_KEY');
      const apiSecret = this.configService.get<string>('CLOUDINARY_API_SECRET');
      
      if (cloudName && apiKey && apiSecret) {
        cloudinary.config({
          cloud_name: cloudName,
          api_key: apiKey,
          api_secret: apiSecret,
        });
        this.logger.log('Cloudinary initialized successfully');
      } else {
        this.logger.warn('Cloudinary credentials missing - using placeholder');
      }
    }
  }

  async uploadFile(
    file: Express.Multer.File,
    folder: string = 'uploads',
    options?: { optimize?: boolean; resize?: { width?: number; height?: number } },
  ): Promise<UploadResult> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    switch (this.provider) {
      case StorageProvider.S3:
        return this.uploadToS3(file, folder, options);
      case StorageProvider.MINIO:
        return this.uploadToMinIO(file, folder, options);
      case StorageProvider.CLOUDINARY:
        return this.uploadToCloudinary(file, folder, options);
      default:
        return this.uploadLocal(file, folder);
    }
  }

  async uploadMultipleFiles(
    files: Express.Multer.File[],
    folder: string = 'uploads',
    options?: { optimize?: boolean },
  ): Promise<UploadResult[]> {
    const uploadPromises = files.map((file) => this.uploadFile(file, folder, options));
    return Promise.all(uploadPromises);
  }

  async deleteFile(url: string): Promise<void> {
    // Extract provider from URL or detect
    if (url.includes('cloudinary.com')) {
      await this.deleteFromCloudinary(url);
    } else if (url.includes('s3.') || url.includes('amazonaws.com')) {
      await this.deleteFromS3(url);
    } else if (url.includes('minio') || url.includes('storage')) {
      await this.deleteFromMinIO(url);
    } else {
      await this.deleteLocal(url);
    }
  }

  private async uploadToS3(
    file: Express.Multer.File,
    folder: string,
    options?: any,
  ): Promise<UploadResult> {
    // TODO: Implement S3 upload using AWS SDK
    // const s3 = new AWS.S3({ ... });
    // const key = `${folder}/${Date.now()}-${file.originalname}`;
    // const result = await s3.upload({ Bucket: ..., Key: key, Body: file.buffer }).promise();
    // return { url: result.Location, key, provider: StorageProvider.S3 };

    // Placeholder
    const key = `${folder}/${Date.now()}-${file.originalname}`;
    return {
      url: `https://s3.amazonaws.com/${this.configService.get('AWS_S3_BUCKET')}/${key}`,
      key,
      provider: StorageProvider.S3,
    };
  }

  private async uploadToMinIO(
    file: Express.Multer.File,
    folder: string,
    options?: any,
  ): Promise<UploadResult> {
    // TODO: Implement MinIO upload
    // Similar to S3 but using MinIO client
    const key = `${folder}/${Date.now()}-${file.originalname}`;
    return {
      url: `${this.configService.get('MINIO_ENDPOINT')}/${this.configService.get('MINIO_BUCKET')}/${key}`,
      key,
      provider: StorageProvider.MINIO,
    };
  }

  private async uploadToCloudinary(
    file: Express.Multer.File,
    folder: string,
    options?: { optimize?: boolean; resize?: { width?: number; height?: number } },
  ): Promise<UploadResult> {
    try {
      const cloudName = this.configService.get<string>('CLOUDINARY_CLOUD_NAME');
      const apiKey = this.configService.get<string>('CLOUDINARY_API_KEY');
      const apiSecret = this.configService.get<string>('CLOUDINARY_API_SECRET');

      if (!cloudName || !apiKey || !apiSecret) {
        throw new BadRequestException('Cloudinary credentials not configured');
      }

      // Convert buffer to base64 data URI for Cloudinary
      const base64Data = file.buffer.toString('base64');
      const dataUri = `data:${file.mimetype};base64,${base64Data}`;

      // Build upload options
      const uploadOptions: any = {
        folder: folder,
        resource_type: 'auto', // Auto-detect image, video, raw
        use_filename: true,
        unique_filename: true,
      };

      // Add optimization if requested
      if (options?.optimize) {
        uploadOptions.quality = 'auto';
        uploadOptions.fetch_format = 'auto';
      }

      // Add resize if requested
      if (options?.resize) {
        uploadOptions.width = options.resize.width;
        uploadOptions.height = options.resize.height;
        uploadOptions.crop = 'limit'; // Maintain aspect ratio
      }

      // Upload to Cloudinary
      const result = await cloudinary.uploader.upload(dataUri, uploadOptions);

      this.logger.log(`File uploaded to Cloudinary: ${result.public_id}`);

      return {
        url: result.secure_url,
        publicId: result.public_id,
        provider: StorageProvider.CLOUDINARY,
      };
    } catch (error) {
      this.logger.error('Cloudinary upload failed:', error);
      throw new BadRequestException(`Failed to upload file to Cloudinary: ${error.message}`);
    }
  }

  private async uploadLocal(file: Express.Multer.File, folder: string): Promise<UploadResult> {
    // Local file system upload (for development)
    const path = `/uploads/${folder}/${Date.now()}-${file.originalname}`;
    return {
      url: path,
      provider: StorageProvider.LOCAL,
    };
  }

  private async deleteFromS3(url: string): Promise<void> {
    // TODO: Implement S3 deletion
  }

  private async deleteFromMinIO(url: string): Promise<void> {
    // TODO: Implement MinIO deletion
  }

  private async deleteFromCloudinary(url: string): Promise<void> {
    try {
      // Extract public_id from Cloudinary URL
      // URL format: https://res.cloudinary.com/{cloud_name}/{resource_type}/upload/{public_id}.{format}
      const urlParts = url.split('/upload/');
      if (urlParts.length < 2) {
        this.logger.warn(`Invalid Cloudinary URL format: ${url}`);
        return;
      }

      // Get public_id (remove file extension)
      let publicId = urlParts[1];
      // Remove query parameters if any
      publicId = publicId.split('?')[0];
      // Remove file extension
      publicId = publicId.replace(/\.[^/.]+$/, '');

      // Delete from Cloudinary
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: 'auto', // Auto-detect resource type
      });

      if (result.result === 'ok') {
        this.logger.log(`File deleted from Cloudinary: ${publicId}`);
      } else {
        this.logger.warn(`Cloudinary deletion result: ${result.result} for ${publicId}`);
      }
    } catch (error) {
      this.logger.error('Cloudinary deletion failed:', error);
      // Don't throw - allow deletion to fail silently in some cases
    }
  }

  private async deleteLocal(url: string): Promise<void> {
    // TODO: Implement local file deletion
    try {
      await fs.unlink(`./${url}`);
    } catch (error) {
      console.error('Error deleting local file:', error);
    }
  }
}


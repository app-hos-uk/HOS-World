import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import { v2 as cloudinary } from 'cloudinary';
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';

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
  private s3Client: S3Client | null = null;
  private minioClient: S3Client | null = null;

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

    // Initialize S3 client if configured
    if (this.provider === StorageProvider.S3) {
      this.initializeS3Client();
    }

    // Initialize MinIO client if configured
    if (this.provider === StorageProvider.MINIO) {
      this.initializeMinIOClient();
    }
  }

  private initializeS3Client() {
    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>('AWS_SECRET_ACCESS_KEY');
    const region = this.configService.get<string>('AWS_REGION') || 'us-east-1';

    if (accessKeyId && secretAccessKey) {
      this.s3Client = new S3Client({
        region,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });
      this.logger.log('S3 client initialized successfully');
    } else {
      this.logger.warn('AWS credentials missing - S3 uploads will fail');
    }
  }

  private initializeMinIOClient() {
    const endpoint = this.configService.get<string>('MINIO_ENDPOINT') || 'http://localhost:9000';
    const accessKeyId = this.configService.get<string>('MINIO_ACCESS_KEY');
    const secretAccessKey = this.configService.get<string>('MINIO_SECRET_KEY');
    const region = this.configService.get<string>('MINIO_REGION') || 'us-east-1';

    if (accessKeyId && secretAccessKey) {
      this.minioClient = new S3Client({
        region,
        endpoint,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
        forcePathStyle: true, // Required for MinIO
      });
      this.logger.log('MinIO client initialized successfully');
    } else {
      this.logger.warn('MinIO credentials missing - MinIO uploads will fail');
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
    if (!this.s3Client) {
      throw new BadRequestException('S3 client not initialized. Check AWS credentials.');
    }

    const bucket = this.configService.get<string>('AWS_S3_BUCKET');
    if (!bucket) {
      throw new BadRequestException('AWS_S3_BUCKET not configured');
    }

    const key = `${folder}/${Date.now()}-${file.originalname}`;
    const contentType = file.mimetype || 'application/octet-stream';

    try {
      // Use Upload for better handling of large files
      const upload = new Upload({
        client: this.s3Client,
        params: {
          Bucket: bucket,
          Key: key,
          Body: file.buffer,
          ContentType: contentType,
          ACL: 'public-read', // Make file publicly accessible
        },
      });

      const result = await upload.done();

      // Construct public URL
      const region = this.configService.get<string>('AWS_REGION') || 'us-east-1';
      const url = result.Location || `https://${bucket}.s3.${region}.amazonaws.com/${key}`;

      this.logger.log(`File uploaded to S3: ${key}`);

      return {
        url,
        key,
        provider: StorageProvider.S3,
      };
    } catch (error: any) {
      this.logger.error(`S3 upload failed: ${error?.message}`);
      throw new BadRequestException(`Failed to upload file to S3: ${error?.message}`);
    }
  }

  private async uploadToMinIO(
    file: Express.Multer.File,
    folder: string,
    options?: any,
  ): Promise<UploadResult> {
    if (!this.minioClient) {
      throw new BadRequestException('MinIO client not initialized. Check MinIO credentials.');
    }

    const bucket = this.configService.get<string>('MINIO_BUCKET');
    if (!bucket) {
      throw new BadRequestException('MINIO_BUCKET not configured');
    }

    const endpoint = this.configService.get<string>('MINIO_ENDPOINT') || 'http://localhost:9000';
    const key = `${folder}/${Date.now()}-${file.originalname}`;
    const contentType = file.mimetype || 'application/octet-stream';

    try {
      // Use Upload for better handling of large files
      const upload = new Upload({
        client: this.minioClient,
        params: {
          Bucket: bucket,
          Key: key,
          Body: file.buffer,
          ContentType: contentType,
          ACL: 'public-read', // Make file publicly accessible
        },
      });

      await upload.done();

      // Construct public URL
      const url = `${endpoint}/${bucket}/${key}`;

      this.logger.log(`File uploaded to MinIO: ${key}`);

      return {
        url,
        key,
        provider: StorageProvider.MINIO,
      };
    } catch (error: any) {
      this.logger.error(`MinIO upload failed: ${error?.message}`);
      throw new BadRequestException(`Failed to upload file to MinIO: ${error?.message}`);
    }
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

  /**
   * Get Cloudinary upload signature for direct frontend uploads
   * This allows the frontend to upload directly to Cloudinary without going through the backend
   */
  async getCloudinaryUploadSignature(
    folder: string = 'uploads',
    options?: { timestamp?: number; eager?: string },
  ): Promise<{ signature: string; timestamp: number; apiKey: string; cloudName: string; folder: string }> {
    if (this.provider !== StorageProvider.CLOUDINARY) {
      throw new BadRequestException('Cloudinary is not configured as the storage provider');
    }

    const cloudName = this.configService.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.configService.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.configService.get<string>('CLOUDINARY_API_SECRET');

    if (!cloudName || !apiKey || !apiSecret) {
      throw new BadRequestException('Cloudinary credentials not configured');
    }

    const timestamp = options?.timestamp || Math.round(new Date().getTime() / 1000);
    const params: Record<string, any> = {
      timestamp,
      folder,
    };

    if (options?.eager) {
      params.eager = options.eager;
    }

    // Generate signature
    const paramsString = Object.keys(params)
      .sort()
      .map((key) => `${key}=${params[key]}`)
      .join('&');

    const signature = cloudinary.utils.api_sign_request(
      { ...params, timestamp },
      apiSecret,
    );

    return {
      signature,
      timestamp,
      apiKey,
      cloudName,
      folder,
    };
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
    if (!this.s3Client) {
      this.logger.warn('S3 client not initialized - cannot delete file');
      return;
    }

    const bucket = this.configService.get<string>('AWS_S3_BUCKET');
    if (!bucket) {
      this.logger.warn('AWS_S3_BUCKET not configured - cannot delete file');
      return;
    }

    try {
      // Extract key from URL
      // URL format: https://bucket.s3.region.amazonaws.com/key or https://s3.region.amazonaws.com/bucket/key
      let key = url;
      if (url.includes('.s3.') || url.includes('amazonaws.com')) {
        const parts = url.split('/');
        // Find the bucket name and get everything after it
        const bucketIndex = parts.findIndex((part) => part.includes(bucket));
        if (bucketIndex >= 0 && bucketIndex < parts.length - 1) {
          key = parts.slice(bucketIndex + 1).join('/');
        } else {
          // Try alternative format
          const match = url.match(new RegExp(`${bucket}/(.+)$`));
          if (match) {
            key = match[1];
          }
        }
      }

      // Remove query parameters if any
      key = key.split('?')[0];

      const command = new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      });

      await this.s3Client.send(command);
      this.logger.log(`File deleted from S3: ${key}`);
    } catch (error: any) {
      this.logger.error(`S3 deletion failed for ${url}: ${error?.message}`);
      // Don't throw - allow deletion to fail silently in some cases
    }
  }

  private async deleteFromMinIO(url: string): Promise<void> {
    if (!this.minioClient) {
      this.logger.warn('MinIO client not initialized - cannot delete file');
      return;
    }

    const bucket = this.configService.get<string>('MINIO_BUCKET');
    if (!bucket) {
      this.logger.warn('MINIO_BUCKET not configured - cannot delete file');
      return;
    }

    try {
      // Extract key from URL
      // URL format: http://endpoint/bucket/key
      let key = url;
      const endpoint = this.configService.get<string>('MINIO_ENDPOINT') || 'http://localhost:9000';
      
      if (url.includes(endpoint)) {
        const parts = url.replace(endpoint, '').split('/').filter(Boolean);
        const bucketIndex = parts.findIndex((part) => part === bucket);
        if (bucketIndex >= 0 && bucketIndex < parts.length - 1) {
          key = parts.slice(bucketIndex + 1).join('/');
        }
      }

      // Remove query parameters if any
      key = key.split('?')[0];

      const command = new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      });

      await this.minioClient.send(command);
      this.logger.log(`File deleted from MinIO: ${key}`);
    } catch (error: any) {
      this.logger.error(`MinIO deletion failed for ${url}: ${error?.message}`);
      // Don't throw - allow deletion to fail silently in some cases
    }
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
    try {
      // Extract file path from URL
      // URLs can be: /uploads/file.jpg, ./uploads/file.jpg, or full paths
      let filePath = url;
      
      // Remove protocol and domain if present
      if (url.startsWith('http://') || url.startsWith('https://')) {
        const urlObj = new URL(url);
        filePath = urlObj.pathname;
      }
      
      // Remove leading slash or ./ if present
      filePath = filePath.replace(/^\.?\//, '');
      
      // Ensure we're within uploads directory for security
      if (!filePath.startsWith('uploads/') && !filePath.startsWith('public/')) {
        this.logger.warn(`Attempted to delete file outside uploads directory: ${filePath}`);
        return;
      }
      
      // Try to delete the file
      await fs.unlink(filePath);
      this.logger.log(`Local file deleted: ${filePath}`);
    } catch (error: any) {
      // File might not exist, which is okay
      if (error.code === 'ENOENT') {
        this.logger.debug(`File not found (may already be deleted): ${url}`);
      } else {
        this.logger.error(`Error deleting local file ${url}: ${error.message}`);
        // Don't throw - allow deletion to fail silently in some cases
      }
    }
  }
}


import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface UploadResult {
  url: string;
  key?: string;
  publicId?: string;
}

@Injectable()
export class UploadsService {
  constructor(private configService: ConfigService) {}

  async uploadFile(file: Express.Multer.File, folder: string = 'uploads'): Promise<UploadResult> {
    // Validate file
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Validate file type
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

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new BadRequestException('File size exceeds 10MB limit');
    }

    // TODO: Implement actual upload to S3 or Cloudinary
    // For now, return placeholder structure
    
    // Example: Upload to S3
    // const s3Url = await this.uploadToS3(file, folder);
    
    // Example: Upload to Cloudinary
    // const cloudinaryUrl = await this.uploadToCloudinary(file, folder);

    // Placeholder response - will be implemented with actual storage service
    return {
      url: `/uploads/${folder}/${Date.now()}-${file.originalname}`,
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

  async deleteFile(url: string): Promise<void> {
    // TODO: Implement file deletion from storage
    // Extract file key/ID from URL and delete from S3/Cloudinary
    console.log('Delete file:', url);
  }

  // TODO: Implement actual S3 upload
  // private async uploadToS3(file: Express.Multer.File, folder: string): Promise<string> {
  //   // AWS S3 upload logic
  // }

  // TODO: Implement actual Cloudinary upload
  // private async uploadToCloudinary(file: Express.Multer.File, folder: string): Promise<string> {
  //   // Cloudinary upload logic
  // }
}



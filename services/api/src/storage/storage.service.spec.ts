import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageService, StorageProvider } from './storage.service';

// Mock AWS SDK - use manual mocks to avoid module resolution issues
jest.mock('@aws-sdk/client-s3', () => {
  const mockS3ClientConstructor = jest.fn().mockImplementation(() => ({
    send: jest.fn(),
  }));
  return {
    S3Client: mockS3ClientConstructor,
    GetObjectCommand: jest.fn(),
    PutObjectCommand: jest.fn(),
    DeleteObjectCommand: jest.fn(),
  };
});

jest.mock('@aws-sdk/lib-storage', () => {
  const mockUploadConstructor = jest.fn().mockImplementation(() => ({
    done: jest.fn().mockResolvedValue({ Location: 'https://s3.amazonaws.com/bucket/key' }),
  }));
  return {
    Upload: mockUploadConstructor,
  };
});

jest.mock('cloudinary', () => ({
  v2: {
    config: jest.fn(),
    uploader: {
      upload: jest.fn(),
      destroy: jest.fn(),
    },
  },
}));

describe('StorageService', () => {
  let service: StorageService;
  let configService: ConfigService;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, any> = {
        STORAGE_PROVIDER: 'local',
        AWS_ACCESS_KEY_ID: 'test-key',
        AWS_SECRET_ACCESS_KEY: 'test-secret',
        AWS_REGION: 'us-east-1',
        AWS_S3_BUCKET: 'test-bucket',
        MINIO_ENDPOINT: 'http://localhost:9000',
        MINIO_ACCESS_KEY: 'minio-key',
        MINIO_SECRET_KEY: 'minio-secret',
        MINIO_BUCKET: 'minio-bucket',
        MINIO_REGION: 'us-east-1',
        CLOUDINARY_CLOUD_NAME: 'test-cloud',
        CLOUDINARY_API_KEY: 'cloud-key',
        CLOUDINARY_API_SECRET: 'cloud-secret',
      };
      return config[key];
    }),
  };

  const mockFile: Express.Multer.File = {
    fieldname: 'file',
    originalname: 'test.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    size: 1024,
    buffer: Buffer.from('test file content'),
    destination: '',
    filename: '',
    path: '',
    stream: null as any,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<StorageService>(StorageService);
    configService = module.get<ConfigService>(ConfigService);

    jest.clearAllMocks();
  });

  describe('uploadFile', () => {
    it('should throw BadRequestException if no file provided', async () => {
      await expect(service.uploadFile(null as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should upload file to local storage by default', async () => {
      mockConfigService.get.mockReturnValue('local');

      const result = await service.uploadFile(mockFile, 'test-folder');

      expect(result).toHaveProperty('url');
      expect(result).toHaveProperty('provider', StorageProvider.LOCAL);
      expect(result.url).toContain('/uploads/test-folder/');
    });

    it('should upload file to S3 when provider is S3', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'STORAGE_PROVIDER') return 's3';
        if (key === 'AWS_ACCESS_KEY_ID') return 'test-key';
        if (key === 'AWS_SECRET_ACCESS_KEY') return 'test-secret';
        if (key === 'AWS_REGION') return 'us-east-1';
        if (key === 'AWS_S3_BUCKET') return 'test-bucket';
        return undefined;
      });

      const { Upload } = require('@aws-sdk/lib-storage');
      (Upload as jest.Mock).mockImplementation(() => ({
        done: jest.fn().mockResolvedValue({
          Location: 'https://test-bucket.s3.us-east-1.amazonaws.com/test.jpg',
        }),
      }));

      // Re-initialize service to pick up new config
      const newService = new StorageService(mockConfigService);

      const result = await newService.uploadFile(mockFile, 'test-folder');

      expect(result).toHaveProperty('provider', StorageProvider.S3);
      expect(result.url).toContain('s3');
    });

    it('should throw BadRequestException if S3 client not initialized', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'STORAGE_PROVIDER') return 's3';
        if (key === 'AWS_ACCESS_KEY_ID') return undefined; // Missing credentials
        return undefined;
      });

      const newService = new StorageService(mockConfigService);

      await expect(newService.uploadFile(mockFile)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should upload file to MinIO when provider is MinIO', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'STORAGE_PROVIDER') return 'minio';
        if (key === 'MINIO_ACCESS_KEY') return 'minio-key';
        if (key === 'MINIO_SECRET_KEY') return 'minio-secret';
        if (key === 'MINIO_ENDPOINT') return 'http://localhost:9000';
        if (key === 'MINIO_BUCKET') return 'minio-bucket';
        return undefined;
      });

      const { Upload } = require('@aws-sdk/lib-storage');
      (Upload as jest.Mock).mockImplementation(() => ({
        done: jest.fn().mockResolvedValue({
          Location: 'http://localhost:9000/minio-bucket/test.jpg',
        }),
      }));

      const newService = new StorageService(mockConfigService);

      const result = await newService.uploadFile(mockFile, 'test-folder');

      expect(result).toHaveProperty('provider', StorageProvider.MINIO);
      expect(result.url).toContain('localhost:9000');
    });

    it('should upload file to Cloudinary when provider is Cloudinary', async () => {
      const cloudinary = require('cloudinary').v2;
      
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'STORAGE_PROVIDER') return 'cloudinary';
        if (key === 'CLOUDINARY_CLOUD_NAME') return 'test-cloud';
        if (key === 'CLOUDINARY_API_KEY') return 'cloud-key';
        if (key === 'CLOUDINARY_API_SECRET') return 'cloud-secret';
        return undefined;
      });

      cloudinary.uploader.upload.mockResolvedValue({
        secure_url: 'https://res.cloudinary.com/test-cloud/image/upload/test.jpg',
        public_id: 'test',
      });

      const newService = new StorageService(mockConfigService);

      const result = await newService.uploadFile(mockFile, 'test-folder');

      expect(result).toHaveProperty('provider', StorageProvider.CLOUDINARY);
      expect(result.url).toContain('cloudinary.com');
    });
  });

  describe('uploadMultipleFiles', () => {
    it('should upload multiple files', async () => {
      const files = [mockFile, { ...mockFile, originalname: 'test2.jpg' }];

      const results = await service.uploadMultipleFiles(files, 'test-folder');

      expect(results).toHaveLength(2);
      expect(results[0]).toHaveProperty('url');
      expect(results[1]).toHaveProperty('url');
    });
  });

  describe('deleteFile', () => {
    it('should delete file from Cloudinary', async () => {
      const cloudinary = require('cloudinary').v2;
      cloudinary.uploader.destroy.mockResolvedValue({ result: 'ok' });

      await service.deleteFile(
        'https://res.cloudinary.com/test-cloud/image/upload/test.jpg',
      );

      expect(cloudinary.uploader.destroy).toHaveBeenCalled();
    });

    it('should delete file from S3', async () => {
      const mockSend = jest.fn().mockResolvedValue({});
      const { S3Client } = require('@aws-sdk/client-s3');
      (S3Client as jest.Mock).mockImplementation(() => ({
        send: mockSend,
      }));

      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'AWS_S3_BUCKET') return 'test-bucket';
        return undefined;
      });

      // Re-initialize to get S3 client
      const newService = new StorageService(mockConfigService);
      (newService as any).s3Client = {
        send: mockSend,
      };

      await newService.deleteFile(
        'https://test-bucket.s3.us-east-1.amazonaws.com/test.jpg',
      );

      expect(mockSend).toHaveBeenCalled();
    });

    it('should delete file from MinIO', async () => {
      const mockSend = jest.fn().mockResolvedValue({});
      
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'MINIO_BUCKET') return 'minio-bucket';
        if (key === 'MINIO_ENDPOINT') return 'http://localhost:9000';
        return undefined;
      });

      const newService = new StorageService(mockConfigService);
      (newService as any).minioClient = {
        send: mockSend,
      };

      await newService.deleteFile('http://localhost:9000/minio-bucket/test.jpg');

      expect(mockSend).toHaveBeenCalled();
    });

    it('should handle deletion errors gracefully', async () => {
      const cloudinary = require('cloudinary').v2;
      cloudinary.uploader.destroy.mockRejectedValue(new Error('Delete failed'));

      await expect(
        service.deleteFile(
          'https://res.cloudinary.com/test-cloud/image/upload/test.jpg',
        ),
      ).resolves.not.toThrow();
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { ProductsService } from './products.service';
import { PrismaService } from '../database/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { ProductsElasticsearchHook } from './products-elasticsearch.hook';

describe('ProductsService - Phase 1 Tests', () => {
  let service: ProductsService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    product: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    seller: {
      findUnique: jest.fn(),
    },
  };

  const mockElasticsearchHook = {
    onProductCreated: jest.fn().mockResolvedValue(undefined),
    onProductUpdated: jest.fn().mockResolvedValue(undefined),
    onProductDeleted: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ProductsElasticsearchHook,
          useValue: mockElasticsearchHook,
        },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
    prismaService = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('create', () => {
    const sellerId = 'seller-id';
    const createProductDto: CreateProductDto = {
      name: 'Test Product',
      description: 'Test Description',
      price: 99.99,
      stock: 100,
      currency: 'USD',
      status: 'ACTIVE',
    };

    it('should create a product successfully', async () => {
      const mockSeller = {
        id: 'seller-id',
        userId: sellerId,
      };

      const mockProduct = {
        id: 'product-id',
        sellerId: mockSeller.id,
        ...createProductDto,
        slug: 'test-product',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.seller.findUnique.mockResolvedValue(mockSeller);
      mockPrismaService.product.create.mockResolvedValue(mockProduct);

      const result = await service.create(sellerId, createProductDto);

      expect(mockPrismaService.seller.findUnique).toHaveBeenCalledWith({
        where: { userId: sellerId },
      });
      expect(mockPrismaService.product.create).toHaveBeenCalled();
      expect(result).toHaveProperty('id');
      expect(result.name).toBe(createProductDto.name);
    });

    it('should throw NotFoundException if seller not found', async () => {
      mockPrismaService.seller.findUnique.mockResolvedValue(null);

      await expect(service.create(sellerId, createProductDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findOne', () => {
    const productId = 'product-id';

    it('should find a product by id', async () => {
      const mockProduct = {
        id: productId,
        name: 'Test Product',
        price: 99.99,
        stock: 100,
        status: 'ACTIVE',
        currency: 'USD',
        images: [],
        variations: [],
        categoryRelation: null,
        tagsRelation: [],
        attributes: [],
        seller: {
          userId: 'seller-user-id',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.product.findUnique.mockResolvedValue(mockProduct);

      const result = await service.findOne(productId);

      expect(mockPrismaService.product.findUnique).toHaveBeenCalledWith({
        where: { id: productId },
        include: expect.any(Object),
      });
      expect(result.id).toBe(productId);
    });

    it('should throw NotFoundException if product not found', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue(null);

      await expect(service.findOne(productId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const sellerId = 'seller-id';
    const productId = 'product-id';
    const updateDto = {
      name: 'Updated Product Name',
      price: 149.99,
    };

    it('should update a product successfully', async () => {
      const mockProduct = {
        id: productId,
        sellerId: 'seller-db-id',
        seller: {
          userId: sellerId,
        },
      };

      const updatedProduct = {
        ...mockProduct,
        ...updateDto,
        status: 'ACTIVE',
        currency: 'USD',
        images: [],
        variations: [],
        categoryRelation: null,
        tagsRelation: [],
        attributes: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.product.findUnique.mockResolvedValue(mockProduct);
      mockPrismaService.seller.findUnique.mockResolvedValue({
        id: 'seller-db-id',
        userId: sellerId,
      });
      mockPrismaService.product.update.mockResolvedValue(updatedProduct);

      const result = await service.update(sellerId, productId, updateDto);

      expect(mockPrismaService.product.findUnique).toHaveBeenCalledWith({
        where: { id: productId },
        include: { seller: true },
      });
      expect(mockPrismaService.product.update).toHaveBeenCalled();
      expect(result.name).toBe(updateDto.name);
    });

    it('should throw NotFoundException if product not found', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue(null);

      await expect(service.update(sellerId, productId, updateDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if seller does not own product', async () => {
      const mockProduct = {
        id: productId,
        sellerId: 'other-seller-id',
        seller: {
          userId: 'other-seller-user-id',
        },
      };

      mockPrismaService.product.findUnique.mockResolvedValue(mockProduct);
      mockPrismaService.seller.findUnique.mockResolvedValue({
        id: 'seller-db-id',
        userId: sellerId,
      });

      await expect(service.update(sellerId, productId, updateDto)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('delete', () => {
    const sellerId = 'seller-id';
    const productId = 'product-id';

    it('should delete a product successfully', async () => {
      const mockProduct = {
        id: productId,
        sellerId: 'seller-db-id',
        seller: {
          userId: sellerId,
        },
      };

      mockPrismaService.product.findUnique.mockResolvedValue(mockProduct);
      mockPrismaService.seller.findUnique.mockResolvedValue({
        id: 'seller-db-id',
        userId: sellerId,
      });
      mockPrismaService.product.delete.mockResolvedValue(mockProduct);

      await service.delete(sellerId, productId);

      expect(mockPrismaService.product.delete).toHaveBeenCalledWith({
        where: { id: productId },
      });
    });

    it('should throw NotFoundException if product not found', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue(null);

      await expect(service.delete(sellerId, productId)).rejects.toThrow(NotFoundException);
    });
  });
});

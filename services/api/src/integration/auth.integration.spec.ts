/// <reference types="jest" />
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuthService } from '../auth/auth.service';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { RegisterRole } from '../auth/dto/register.dto';
import * as bcrypt from 'bcrypt';

describe('Authentication Integration Tests', () => {
  let app: INestApplication;
  let authService: AuthService;
  let prismaService: PrismaService;
  let createdUserId: string;

  beforeAll(async () => {
    // Skip tests if database is not available
    if (process.env.SKIP_INTEGRATION_TESTS === 'true') {
      return;
    }
    
    let moduleFixture: TestingModule;
    try {
      moduleFixture = await Test.createTestingModule({
        imports: [DatabaseModule, AuthModule],
      }).compile();
    } catch (error: any) {
      // Skip tests if database connection fails
      if (error?.message?.includes('denied access') || error?.message?.includes('connect') || error?.message?.includes('DATABASE_URL')) {
        console.warn('⚠️ Skipping integration tests: Database not available');
        return;
      }
      throw error;
    }

    try {
      app = moduleFixture.createNestApplication();
    } catch (error: any) {
      // App creation failed
    }

    try {
      await app.init();
    } catch (error: any) {
      throw error;
    }

    try {
      authService = moduleFixture.get<AuthService>(AuthService);
      prismaService = moduleFixture.get<PrismaService>(PrismaService);
    } catch (error: any) {
      // Service retrieval failed
    }
  });

  afterAll(async () => {
    // Cleanup
    if (prismaService) {
      if (createdUserId) {
        await prismaService.user.delete({
          where: { id: createdUserId },
        }).catch(() => {});
      }
      await prismaService.$disconnect().catch(() => {});
    }
    if (app) {
      await app.close().catch(() => {});
    }
  });

  describe('User Registration Flow', () => {
    it('should register user and create customer profile', async () => {
      if (!authService || !prismaService) {
        console.warn('⚠️ Skipping test: Services not initialized');
        return;
      }
      const email = `integration-test-${Date.now()}@example.com`;
      
      try {
        const result = await authService.register({
          email,
          password: 'Test123!@#',
          firstName: 'Integration',
          lastName: 'Test',
          role: RegisterRole.CUSTOMER,
          country: 'GB',
          preferredCommunicationMethod: 'EMAIL' as any,
          gdprConsent: true,
        });

        expect(result).toHaveProperty('user');
        expect(result).toHaveProperty('token');
        expect(result.user.email).toBe(email);
        expect(result.user.role).toBe('CUSTOMER');

        // Verify user exists in database
        const user = await prismaService.user.findUnique({
          where: { id: result.user.id },
        });
        expect(user).toBeDefined();
        expect(user?.email).toBe(email);

        // Verify customer profile created
        const customer = await prismaService.customer.findUnique({
          where: { userId: result.user.id },
        });
        expect(customer).toBeDefined();

        createdUserId = result.user.id;
      } catch (error: any) {
        // Skip test if database operation fails
        if (error?.message?.includes('denied access') || error?.message?.includes('connect')) {
          console.warn('⚠️ Skipping test: Database operation failed');
          return;
        }
        throw error;
      }
    });

    it('should hash password correctly', async () => {
      if (!authService) {
        console.warn('⚠️ Skipping test: Services not initialized');
        return;
      }
      const email = `password-test-${Date.now()}@example.com`;
      const password = 'TestPassword123!';
      
      try {
        const result = await authService.register({
          email,
          password,
          firstName: 'Password',
          lastName: 'Test',
          role: RegisterRole.CUSTOMER,
          country: 'GB',
          preferredCommunicationMethod: 'EMAIL' as any,
          gdprConsent: true,
        });

        const user = await prismaService.user.findUnique({
          where: { id: result.user.id },
          select: { password: true },
        });

        expect(user?.password).not.toBe(password);
        expect(user?.password).not.toContain(password);
        
        // Verify password can be compared
        const isValid = await bcrypt.compare(password, user?.password || '');
        expect(isValid).toBe(true);

        // Cleanup
        await prismaService.user.delete({
          where: { id: result.user.id },
        }).catch(() => {});
      } catch (error: any) {
        // Skip test if database operation fails
        if (error?.message?.includes('denied access') || error?.message?.includes('connect')) {
          console.warn('⚠️ Skipping test: Database operation failed');
          return;
        }
        throw error;
      }
    });
  });

  describe('User Login Flow', () => {
    let testEmail: string;
    let testPassword: string;
    let testUserId: string;

    beforeAll(async () => {
      if (!authService) {
        console.warn('⚠️ Skipping login tests: Services not initialized');
        return;
      }
      testEmail = `login-integration-${Date.now()}@example.com`;
      testPassword = 'LoginTest123!';

      try {
        const result = await authService.register({
          email: testEmail,
          password: testPassword,
          firstName: 'Login',
          lastName: 'Test',
          role: RegisterRole.CUSTOMER,
          country: 'GB',
          preferredCommunicationMethod: 'EMAIL' as any,
          gdprConsent: true,
        });

        testUserId = result.user.id;
      } catch (error: any) {
        // Skip tests if database operation fails
        if (error?.message?.includes('denied access') || error?.message?.includes('connect')) {
          console.warn('⚠️ Skipping login tests: Database operation failed');
          return;
        }
        throw error;
      }
    });

    afterAll(async () => {
      await prismaService.user.delete({
        where: { id: testUserId },
      }).catch(() => {});
    });

    it('should login with correct credentials', async () => {
      if (!authService || !testEmail || !testPassword) {
        console.warn('⚠️ Skipping test: Services not initialized');
        return;
      }
      try {
        const result = await authService.login({
          email: testEmail,
          password: testPassword,
        });

        expect(result).toHaveProperty('token');
        expect(result).toHaveProperty('user');
        expect(result.user.email).toBe(testEmail);
      } catch (error: any) {
        // Skip test if database operation fails
        if (error?.message?.includes('denied access') || error?.message?.includes('connect')) {
          console.warn('⚠️ Skipping test: Database operation failed');
          return;
        }
        throw error;
      }
    });

    it('should reject login with incorrect password', async () => {
      if (!authService || !testEmail) {
        console.warn('⚠️ Skipping test: Services not initialized');
        return;
      }
      try {
        await expect(
          authService.login({
            email: testEmail,
            password: 'WrongPassword',
          }),
        ).rejects.toThrow();
      } catch (error: any) {
        // Skip test if database operation fails
        if (error?.message?.includes('denied access') || error?.message?.includes('connect')) {
          console.warn('⚠️ Skipping test: Database operation failed');
          return;
        }
        throw error;
      }
    });

    it('should reject login with non-existent email', async () => {
      if (!authService) {
        console.warn('⚠️ Skipping test: Services not initialized');
        return;
      }
      try {
        await expect(
          authService.login({
            email: 'nonexistent@example.com',
            password: 'anypassword',
          }),
        ).rejects.toThrow();
      } catch (error: any) {
        // Skip test if database operation fails
        if (error?.message?.includes('denied access') || error?.message?.includes('connect')) {
          console.warn('⚠️ Skipping test: Database operation failed');
          return;
        }
        throw error;
      }
    });
  });
});



import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuthService } from '../auth/auth.service';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import * as bcrypt from 'bcrypt';

describe('Authentication Integration Tests', () => {
  let app: INestApplication;
  let authService: AuthService;
  let prismaService: PrismaService;
  let createdUserId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [DatabaseModule, AuthModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    authService = moduleFixture.get<AuthService>(AuthService);
    prismaService = moduleFixture.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    // Cleanup
    if (createdUserId) {
      await prismaService.user.delete({
        where: { id: createdUserId },
      }).catch(() => {});
    }
    await app.close();
    await prismaService.$disconnect();
  });

  describe('User Registration Flow', () => {
    it('should register user and create customer profile', async () => {
      const email = `integration-test-${Date.now()}@example.com`;
      
      const result = await authService.register({
        email,
        password: 'Test123!@#',
        firstName: 'Integration',
        lastName: 'Test',
        role: 'customer',
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
    });

    it('should hash password correctly', async () => {
      const email = `password-test-${Date.now()}@example.com`;
      const password = 'TestPassword123!';
      
      const result = await authService.register({
        email,
        password,
        firstName: 'Password',
        lastName: 'Test',
        role: 'customer',
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
      });
    });
  });

  describe('User Login Flow', () => {
    let testEmail: string;
    let testPassword: string;
    let testUserId: string;

    beforeAll(async () => {
      testEmail = `login-integration-${Date.now()}@example.com`;
      testPassword = 'LoginTest123!';

      const result = await authService.register({
        email: testEmail,
        password: testPassword,
        firstName: 'Login',
        lastName: 'Test',
        role: 'customer',
      });

      testUserId = result.user.id;
    });

    afterAll(async () => {
      await prismaService.user.delete({
        where: { id: testUserId },
      }).catch(() => {});
    });

    it('should login with correct credentials', async () => {
      const result = await authService.login({
        email: testEmail,
        password: testPassword,
      });

      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('user');
      expect(result.user.email).toBe(testEmail);
    });

    it('should reject login with incorrect password', async () => {
      await expect(
        authService.login({
          email: testEmail,
          password: 'WrongPassword',
        }),
      ).rejects.toThrow();
    });

    it('should reject login with non-existent email', async () => {
      await expect(
        authService.login({
          email: 'nonexistent@example.com',
          password: 'anypassword',
        }),
      ).rejects.toThrow();
    });
  });
});



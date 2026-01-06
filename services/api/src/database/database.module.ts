import { Global, Module, OnModuleInit } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class DatabaseModule implements OnModuleInit {
  async onModuleInit() {
    // Early check: Verify Prisma client has RefreshToken before any modules use it
    try {
      const { PrismaClient } = require('@prisma/client');
      const testClient = new PrismaClient();
      const hasRefreshToken = typeof testClient.refreshToken !== 'undefined';
      const hasUser = typeof testClient.user !== 'undefined';
      
      console.log('═══════════════════════════════════════════════════════════');
      console.log('[DatabaseModule] Prisma Client Verification');
      console.log('═══════════════════════════════════════════════════════════');
      console.log(`  user model: ${hasUser ? 'YES ✅' : 'NO ❌'}`);
      console.log(`  refreshToken model: ${hasRefreshToken ? 'YES ✅' : 'NO ❌'}`);
      
      if (!hasUser) {
        console.error('❌ CRITICAL: Basic Prisma models missing!');
        await testClient.$disconnect();
        throw new Error('Prisma client missing basic models - generation failed');
      }
      
      if (!hasRefreshToken) {
        console.error('⚠️  WARNING: RefreshToken model missing from Prisma client!');
        console.error('  Auth refresh functionality will be limited.');
        console.error('  Solution: Regenerate Prisma client with: pnpm db:generate');
      } else {
        console.log('✅ All required models found');
      }
      console.log('═══════════════════════════════════════════════════════════');
      
      await testClient.$disconnect();
    } catch (error: any) {
      console.error('[DatabaseModule] Error verifying Prisma client:', error?.message);
      // Don't throw - allow service to start with warnings
    }
  }
}



// IMMEDIATE LOG - This should appear first if script runs at all
console.log('═══════════════════════════════════════════════════════════');
console.log('📝 main.ts LOADED');
console.log('Timestamp:', new Date().toISOString());
console.log('Node version:', process.version);
console.log('═══════════════════════════════════════════════════════════');

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  // Immediate log to verify script is running
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🚀 BOOTSTRAP STARTED');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('Timestamp:', new Date().toISOString());
  console.log('Node version:', process.version);
  console.log('Working directory:', process.cwd());
  console.log('dist/main.js exists:', require('fs').existsSync('./dist/main.js'));
  console.log('═══════════════════════════════════════════════════════════');
  
  try {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/315c2d74-b9bb-430e-9c51-123c9436e40e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.ts:6',message:'Bootstrap started',data:{nodeVersion:process.version,workingDir:process.cwd(),hasMainJs:require('fs').existsSync('./dist/main.js'),hasDbUrl:!!process.env.DATABASE_URL,port:process.env.PORT},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    console.log('🚀 Starting API server...');
    console.log('[DEBUG] Hypothesis A: Checking Prisma client availability...');
    console.log('[DEBUG] Hypothesis B: About to initialize AppModule...');
    console.log('[DEBUG] Hypothesis C: Database connection will be tested...');
    console.log('[DEBUG] Hypothesis D: Error handler ready...');
    
    // Pre-flight check: Verify Prisma client can be imported and has RefreshToken
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🔍 PRE-FLIGHT CHECK: Verifying Prisma Client');
    console.log('═══════════════════════════════════════════════════════════');
    try {
      console.log('[1/4] Importing PrismaClient...');
      const { PrismaClient } = require('@prisma/client');
      console.log('[2/4] Creating PrismaClient instance...');
      const testClient = new PrismaClient();
      
      console.log('[3/4] Checking for models...');
      const hasRefreshToken = typeof testClient.refreshToken !== 'undefined';
      const hasUser = typeof testClient.user !== 'undefined';
      const hasProduct = typeof testClient.product !== 'undefined';
      
      console.log(`    ✓ user model: ${hasUser ? 'YES ✅' : 'NO ❌'}`);
      console.log(`    ✓ product model: ${hasProduct ? 'YES ✅' : 'NO ❌'}`);
      console.log(`    ✓ refreshToken model: ${hasRefreshToken ? 'YES ✅' : 'NO ❌'}`);
      
      if (!hasUser || !hasProduct) {
        console.error('❌ CRITICAL: Basic Prisma models missing! Prisma client generation failed.');
        console.error('Available properties:', Object.keys(testClient).filter(k => !k.startsWith('$') && !k.startsWith('_')).slice(0, 20).join(', '));
        await testClient.$disconnect();
        throw new Error('Prisma client missing basic models - generation failed');
      }
      
      if (!hasRefreshToken) {
        console.error('═══════════════════════════════════════════════════════════');
        console.error('❌ CRITICAL ERROR: RefreshToken model missing from PrismaClient!');
        console.error('═══════════════════════════════════════════════════════════');
        console.error('This will cause the service to crash when auth methods are called.');
        console.error('');
        console.error('Available models:', Object.keys(testClient).filter(k => !k.startsWith('$') && !k.startsWith('_')).slice(0, 20).join(', '));
        console.error('');
        console.error('SOLUTION:');
        console.error('1. Verify schema.prisma contains: model RefreshToken');
        console.error('2. Regenerate Prisma client: pnpm db:generate');
        console.error('3. Verify the generated client includes refreshToken');
        console.error('═══════════════════════════════════════════════════════════');
        await testClient.$disconnect();
        // Continue to let NestJS initialization show the error, but log it clearly
      } else {
        console.log('[4/4] ✅ Pre-flight check PASSED - All models found');
        console.log('═══════════════════════════════════════════════════════════');
        await testClient.$disconnect();
      }
    } catch (preflightError: any) {
      console.error('═══════════════════════════════════════════════════════════');
      console.error('❌ PRE-FLIGHT CHECK FAILED');
      console.error('═══════════════════════════════════════════════════════════');
      console.error('Error:', preflightError?.message);
      console.error('Stack:', preflightError?.stack);
      console.error('═══════════════════════════════════════════════════════════');
      // Continue anyway - let module initialization show the real error
    }
    console.log('Environment:', {
      NODE_ENV: process.env.NODE_ENV,
      PORT: process.env.PORT,
      DATABASE_URL: process.env.DATABASE_URL ? '***set***' : '***missing***',
    });
    console.log('Node version:', process.version);
    console.log('Working directory:', process.cwd());
    console.log('Checking dist/main.js exists:', require('fs').existsSync('./dist/main.js'));

    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/315c2d74-b9bb-430e-9c51-123c9436e40e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.ts:17',message:'Before NestFactory.create',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    console.log('[DEBUG] Hypothesis B: Creating NestFactory with AppModule...');
    try {
      const app = await NestFactory.create(AppModule, {
        cors: true, // Enable CORS at NestJS level first
      });
      console.log('[DEBUG] Hypothesis B: ✅ AppModule initialized successfully');
      
      // Verify Prisma client has RefreshToken model after module initialization
      try {
        const prismaService = app.get('PrismaService', { strict: false });
        if (prismaService) {
          const hasRefreshToken = typeof (prismaService as any).refreshToken !== 'undefined';
          console.log(`[DEBUG] Hypothesis A: After AppModule init - RefreshToken available: ${hasRefreshToken ? 'YES ✅' : 'NO ❌'}`);
          if (!hasRefreshToken) {
            console.error('[DEBUG] Hypothesis A: ❌ CRITICAL: RefreshToken model missing from Prisma client!');
            console.error('[DEBUG] Hypothesis A: This will cause crashes. Prisma client needs regeneration.');
            console.error('[DEBUG] Hypothesis A: Available models:', Object.keys(prismaService).filter(k => !k.startsWith('$') && !k.startsWith('_') && k !== 'logger').slice(0, 10).join(', '));
          }
        } else {
          console.warn('[DEBUG] Hypothesis A: ⚠️ PrismaService not found in app context');
        }
      } catch (checkError: any) {
        console.warn('[DEBUG] Hypothesis A: ⚠️ Could not verify RefreshToken model:', checkError?.message);
      }
    } catch (moduleError: any) {
      console.error('[DEBUG] Hypothesis B: ❌ AppModule initialization failed!');
      console.error('[DEBUG] Hypothesis B: Error:', moduleError?.message);
      console.error('[DEBUG] Hypothesis B: Stack:', moduleError?.stack);
      throw moduleError; // Re-throw to be caught by outer try-catch
    }
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/315c2d74-b9bb-430e-9c51-123c9436e40e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.ts:20',message:'After NestFactory.create - AppModule initialized',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion

    // Define allowed origins - MUST be before any middleware
    const allowedOrigins = [
      process.env.FRONTEND_URL,
      'https://hos-marketplaceweb-production.up.railway.app',
      'http://localhost:3000',
      'http://localhost:3001',
    ].filter(Boolean); // Remove undefined values

    console.log('🌐 CORS allowed origins:', allowedOrigins);

    // CRITICAL: Handle OPTIONS requests FIRST - before any other middleware
    // This ensures preflight requests are handled even if the app has errors
    app.use((req: any, res: any, next: any) => {
      // Handle preflight OPTIONS requests immediately
      if (req.method === 'OPTIONS') {
        const origin = req.headers.origin;
        
        // Check if origin is allowed
        const isAllowed = !origin || allowedOrigins.some(allowed => {
          if (!allowed) return false;
          return origin === allowed || origin.startsWith(allowed);
        });
        
        if (isAllowed || !origin) {
          console.log(`✅ CORS Preflight: Allowing ${origin || 'no-origin'} for ${req.path}`);
          res.header('Access-Control-Allow-Origin', origin || '*');
          res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD');
          res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, X-API-Key, Access-Control-Request-Method, Access-Control-Request-Headers');
          res.header('Access-Control-Allow-Credentials', 'true');
          res.header('Access-Control-Max-Age', '86400');
          return res.status(204).send();
        } else {
          console.warn(`⚠️  CORS Preflight blocked: ${origin}`);
          return res.status(403).json({ error: 'CORS not allowed' });
        }
      }
      next();
    });

    // Enhanced CORS configuration for all other requests
    app.enableCors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) {
          console.log('✅ CORS: Allowing request with no origin');
          return callback(null, true);
        }
        
        // Check if origin is in allowed list
        const isAllowed = allowedOrigins.some(allowed => {
          if (!allowed) return false;
          if (origin === allowed) return true;
          // Also allow if origin starts with allowed (for subdomains)
          if (origin.startsWith(allowed)) return true;
          return false;
        });
        
        if (isAllowed) {
          console.log(`✅ CORS: Allowing origin: ${origin}`);
          callback(null, true);
        } else {
          console.warn(`⚠️  CORS blocked origin: ${origin}`);
          console.warn(`⚠️  Allowed origins: ${allowedOrigins.join(', ')}`);
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'Accept',
        'Origin',
        'Access-Control-Request-Method',
        'Access-Control-Request-Headers',
        'X-API-Key',
      ],
      exposedHeaders: ['Authorization', 'Content-Type'],
      preflightContinue: false,
      optionsSuccessStatus: 204,
      maxAge: 86400, // 24 hours
    });

    // Add CORS headers to all responses (safety net)
    app.use((req: any, res: any, next: any) => {
      const origin = req.headers.origin;
      const isAllowed = !origin || allowedOrigins.some(allowed => {
        if (!allowed) return false;
        return origin === allowed || origin.startsWith(allowed);
      });
      
      if (isAllowed || !origin) {
        res.header('Access-Control-Allow-Origin', origin || '*');
        res.header('Access-Control-Allow-Credentials', 'true');
      }
      next();
    });

    // Add root route handler via middleware BEFORE setting global prefix
    app.use('/', (req: any, res: any, next: any) => {
      if (req.path === '/' && req.method === 'GET') {
        return res.json({
          message: 'House of Spells Marketplace API',
          version: '1.0.0',
          status: 'running',
          endpoints: {
            api: '/api',
            health: '/api/health',
            products: '/api/products',
            auth: '/api/auth',
          },
          documentation: 'API documentation coming soon',
        });
      }
      next();
    });

    // Global prefix for all routes
    app.setGlobalPrefix('api');

    // Global validation pipe
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    const port = process.env.PORT || 3001;
    console.log(`📡 About to listen on port: ${port}`);
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/315c2d74-b9bb-430e-9c51-123c9436e40e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.ts:151',message:'Before app.listen',data:{port},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    
    // Use app.listen() to ensure all routes are properly registered
    await app.listen(port, '0.0.0.0');
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/315c2d74-b9bb-430e-9c51-123c9436e40e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.ts:155',message:'After app.listen - Server started successfully',data:{port},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    
    console.log(`✅ Server is listening on port ${port}`);
    console.log(`✅ API server is running on: http://0.0.0.0:${port}/api`);
    console.log(`✅ Health check available at: http://0.0.0.0:${port}/api/health`);
    console.log(`✅ Root endpoint available at: http://0.0.0.0:${port}/`);
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/315c2d74-b9bb-430e-9c51-123c9436e40e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.ts:161',message:'Bootstrap error caught',data:{errorName:error?.name,errorMessage:error?.message,errorStack:error?.stack?.substring(0,500),hasDbUrl:!!process.env.DATABASE_URL},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    console.error('═══════════════════════════════════════════════════════════');
    console.error('❌ CRITICAL ERROR: Failed to start API server');
    console.error('═══════════════════════════════════════════════════════════');
    console.error('Error name:', error?.name || 'Unknown');
    console.error('Error message:', error?.message || 'Unknown error');
    console.error('');
    console.error('Full error object:');
    console.error(JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    console.error('');
    console.error('Error stack:');
    console.error(error?.stack || 'No stack trace available');
    console.error('');
    console.error('Environment:');
    console.error('  NODE_ENV:', process.env.NODE_ENV);
    console.error('  PORT:', process.env.PORT);
    console.error('  DATABASE_URL:', process.env.DATABASE_URL ? '***set***' : '***missing***');
    console.error('  Working directory:', process.cwd());
    console.error('═══════════════════════════════════════════════════════════');
    // Give Railway time to capture logs before exiting
    setTimeout(() => {
      process.exit(1);
    }, 5000);
  }
}

// Add unhandled error handlers to catch any errors outside bootstrap
process.on('uncaughtException', (error) => {
  console.error('═══════════════════════════════════════════════════════════');
  console.error('❌ UNCAUGHT EXCEPTION');
  console.error('═══════════════════════════════════════════════════════════');
  console.error('Error:', error.message);
  console.error('Stack:', error.stack);
  console.error('═══════════════════════════════════════════════════════════');
  setTimeout(() => process.exit(1), 5000);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('═══════════════════════════════════════════════════════════');
  console.error('❌ UNHANDLED REJECTION');
  console.error('═══════════════════════════════════════════════════════════');
  console.error('Reason:', reason);
  console.error('Promise:', promise);
  console.error('═══════════════════════════════════════════════════════════');
});

// IMMEDIATE LOG - Before bootstrap call
console.log('═══════════════════════════════════════════════════════════');
console.log('📝 About to call bootstrap()');
console.log('Timestamp:', new Date().toISOString());
console.log('═══════════════════════════════════════════════════════════');

bootstrap().catch((error) => {
  console.error('═══════════════════════════════════════════════════════════');
  console.error('❌ BOOTSTRAP PROMISE REJECTED');
  console.error('═══════════════════════════════════════════════════════════');
  console.error('Error:', error?.message);
  console.error('Stack:', error?.stack);
  console.error('═══════════════════════════════════════════════════════════');
  setTimeout(() => process.exit(1), 5000);
});



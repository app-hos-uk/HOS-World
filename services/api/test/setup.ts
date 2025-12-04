// Global test setup
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';
process.env.JWT_EXPIRES_IN = '1h';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';

// Set all required environment variables for tests
process.env.ELASTICSEARCH_NODE = 'http://localhost:9200';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.CLOUDINARY_CLOUD_NAME = 'test';
process.env.CLOUDINARY_API_KEY = 'test';
process.env.CLOUDINARY_API_SECRET = 'test';
process.env.FRONTEND_URL = 'http://localhost:3000';
process.env.PORT = '3001';



import 'dotenv/config';

function getJwtSecret(): string {
  const secret = process.env['JWT_SECRET'];
  if (!secret && process.env['NODE_ENV'] === 'production') {
    throw new Error('JWT_SECRET is required in production mode. Set it via environment variable.');
  }
  return secret || 'dev-secret-change-in-production';
}

function getJwtRefreshSecret(): string {
  const secret = process.env['JWT_REFRESH_SECRET'];
  if (!secret && process.env['NODE_ENV'] === 'production') {
    throw new Error('JWT_REFRESH_SECRET is required in production mode. Set it via environment variable.');
  }
  return secret || 'dev-refresh-secret-change-in-production';
}

export const config = {
  port: parseInt(process.env['PORT'] || '3994'),
  nodeEnv: process.env['NODE_ENV'] || 'development',
  
  database: {
    host: process.env['DB_HOST'] || 'localhost',
    port: parseInt(process.env['DB_PORT'] || '3306'),
    user: process.env['DB_USER'] || 'root',
    password: process.env['DB_PASSWORD'] || '',
    database: process.env['DB_NAME'] || 'repair_calc',
    poolLimit: parseInt(process.env['DB_POOL_LIMIT'] || '10'),
    charset: process.env['DB_CHARSET'] || 'utf8mb4',
    collation: process.env['DB_COLLATION'] || 'utf8mb4_unicode_ci',
    timezone: process.env['DB_TIMEZONE'] || '+00:00',
  },
  
  jwt: {
    secret: getJwtSecret(),
    expiresIn: process.env['JWT_EXPIRES_IN'] || '15m',
    refreshSecret: getJwtRefreshSecret(),
    refreshExpiresIn: process.env['JWT_REFRESH_EXPIRES_IN'] || '7d',
  },
  
  ai: {
    geminiApiKey: process.env['GEMINI_API_KEY'] || '',
    mistralApiKey: process.env['MISTRAL_API_KEY'] || '',
  },
  
  logging: {
    level: process.env['LOG_LEVEL'] || 'info',
  },
} as const;

export type Config = typeof config;
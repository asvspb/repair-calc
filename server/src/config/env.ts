import 'dotenv/config';

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
  },
  
  jwt: {
    secret: process.env['JWT_SECRET'] || 'dev-secret-change-in-production',
    expiresIn: process.env['JWT_EXPIRES_IN'] || '15m',
    refreshSecret: process.env['JWT_REFRESH_SECRET'] || 'dev-refresh-secret-change-in-production',
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
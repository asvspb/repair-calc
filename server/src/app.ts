import express from 'express';
import cors from 'cors';
import { config } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { logger } from './middleware/logger.js';
import { rateLimiter } from './middleware/rateLimiter.js';
import { router } from './routes/index.js';

export function createApp(): express.Application {
  const app = express();

  // Middleware
  const allowedOrigins = [
    'http://localhost:3993',
    'http://127.0.0.1:3993',
    'http://localhost:3980',
    'http://127.0.0.1:3980',
  ];
  
  app.use(cors({
    origin: config.nodeEnv === 'development' 
      ? allowedOrigins
      : (origin, callback) => {
          // Разрешаем запросы без origin (например, от мобильных приложений)
          // или от разрешённых origins
          if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
          } else {
            callback(new Error('Not allowed by CORS'));
          }
        },
    credentials: true,
  }));
  
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  
  // Request logging
  app.use(logger);

  // Rate limiting
  app.use(rateLimiter);

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  // API routes
  app.use('/api', router);

  // Error handler
  app.use(errorHandler);

  return app;
}
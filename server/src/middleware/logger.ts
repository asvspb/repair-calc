import type { Request, Response, NextFunction } from 'express';
import winston from 'winston';
import { config } from '../config/env.js';
import fs from 'fs';
import path from 'path';

let appVersion = process.env.APP_VERSION || 'unknown';
try {
  // Попытка прочитать версию из package.json в корне или в server
  const packagePath = fs.existsSync(path.join(process.cwd(), 'package.json'))
    ? path.join(process.cwd(), 'package.json')
    : path.join(process.cwd(), '..', 'package.json');

  if (fs.existsSync(packagePath)) {
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    if (pkg.version) appVersion = pkg.version;
  }
} catch (e) {
  // Игнорируем ошибки при чтении
}

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf(({ level, message, timestamp, stack, version, ...meta }) => {
  const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 0) : '';
  const stackStr = stack ? `\n${stack}` : '';
  const vStr = version ? `[v${version}]` : '';
  return `${timestamp} ${vStr} [${level}]: ${message} ${metaStr}${stackStr}`;
});

export const winstonLogger = winston.createLogger({
  level: config.logging.level,
  defaultMeta: { version: appVersion },
  format: combine(errors({ stack: true }), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), logFormat),
  transports: [
    new winston.transports.Console({
      format: combine(
        errors({ stack: true }),
        colorize(),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        logFormat,
      ),
    }),
  ],
});

export function logger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const message = `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`;

    if (res.statusCode >= 400) {
      winstonLogger.warn(message, {
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });
    } else {
      winstonLogger.info(message);
    }
  });

  next();
}

import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../types/index.js';
import { winstonLogger } from './logger.js';
import { forbidden } from './errorHandler.js';

export function adminGuard(req: AuthRequest, res: Response, next: NextFunction): void {
  // Check if user exists (should be set by auth middleware)
  if (!req.user) {
    winstonLogger.warn('adminGuard: No user on request', { path: req.path });
    return next(forbidden('Authentication required'));
  }

  // Check if user has admin role
  const role = req.user.role;

  if (role !== 'admin') {
    winstonLogger.warn('forbidden_admin_access', {
      userId: req.user.id,
      path: req.path,
      role,
    });
    return next(forbidden('admin_only'));
  }

  next();
}

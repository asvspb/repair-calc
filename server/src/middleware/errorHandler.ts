import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export interface ApiError {
  status: number;
  message: string;
  errors?: unknown[];
}

export class AppError extends Error {
  status: number;
  errors?: unknown[];

  constructor(status: number, message: string, errors?: unknown[]) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

export function errorHandler(
  err: Error | AppError | ZodError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('Error:', err);

  if (err instanceof ZodError) {
    res.status(400).json({
      status: 'error',
      message: 'Validation error',
      errors: err.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.status).json({
      status: 'error',
      message: err.message,
      errors: err.errors,
    });
    return;
  }

  // MySQL errors
  if ('code' in err && typeof err.code === 'string') {
    const mysqlError = err as Error & { code: string; errno: number };
    
    if (mysqlError.code === 'ER_DUP_ENTRY') {
      res.status(409).json({
        status: 'error',
        message: 'Record already exists',
      });
      return;
    }

    if (mysqlError.code === 'ER_NO_REFERENCED_ROW_2') {
      res.status(400).json({
        status: 'error',
        message: 'Referenced record not found',
      });
      return;
    }
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    res.status(401).json({
      status: 'error',
      message: 'Invalid token',
    });
    return;
  }

  if (err.name === 'TokenExpiredError') {
    res.status(401).json({
      status: 'error',
      message: 'Token expired',
    });
    return;
  }

  // Default error
  res.status(500).json({
    status: 'error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
  });
}

// Helper functions for common errors
export const badRequest = (message: string, errors?: unknown[]): AppError => 
  new AppError(400, message, errors);

export const unauthorized = (message: string = 'Unauthorized'): AppError => 
  new AppError(401, message);

export const forbidden = (message: string = 'Forbidden'): AppError => 
  new AppError(403, message);

export const notFound = (message: string = 'Not found'): AppError => 
  new AppError(404, message);

export const conflict = (message: string): AppError => 
  new AppError(409, message);
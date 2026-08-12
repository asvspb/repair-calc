import type { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import type { AuthRequest, TokenPayload } from '../types/index.js';
import { unauthorized } from './errorHandler.js';
import { UserRepository } from '../db/repositories/user.repo.js';

/** Minimal user shape available after authentication (no DB lookup) */
interface AuthenticatedUser {
  id: string;
  email: string;
}

export async function authenticate(
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    next(unauthorized('No token provided'));
    return;
  }

  const token = authHeader.substring(7);

  try {
    const payload = jwt.verify(token, config.jwt.secret) as TokenPayload;

    // Attach only what's in the token + role from db if available
    const user = await UserRepository.findByEmail(payload.email);

    req.user = {
      id: payload.userId,
      email: payload.email,
      role: user?.role || payload.role,
    } as AuthenticatedUser;

    next();
  } catch {
    next(unauthorized('Invalid or expired token'));
  }
}

export function generateTokens(
  userId: string,
  email: string,
  role?: 'admin' | 'user',
): { token: string; refreshToken: string } {
  const token = jwt.sign({ userId, email, role }, config.jwt.secret, { expiresIn: '15m' });

  const refreshToken = jwt.sign({ userId, email, role }, config.jwt.refreshSecret, {
    expiresIn: '7d',
  });

  return { token, refreshToken };
}

export function verifyRefreshToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, config.jwt.refreshSecret) as TokenPayload;
  } catch {
    return null;
  }
}

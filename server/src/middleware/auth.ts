import type { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import type { AuthRequest, TokenPayload } from '../types/index.js';
import { unauthorized } from './errorHandler.js';

/** Minimal user shape available after authentication (no DB lookup) */
interface AuthenticatedUser {
  id: string;
  email: string;
}

export function authenticate(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    next(unauthorized('No token provided'));
    return;
  }

  const token = authHeader.substring(7);

  try {
    const payload = jwt.verify(token, config.jwt.secret) as TokenPayload;

    // Attach only what's in the token — no fake data
    req.user = {
      id: payload.userId,
      email: payload.email,
    } as AuthenticatedUser;

    next();
  } catch {
    next(unauthorized('Invalid or expired token'));
  }
}

export function generateTokens(userId: string, email: string): { token: string; refreshToken: string } {
  const token = jwt.sign(
    { userId, email },
    config.jwt.secret,
    { expiresIn: '15m' }
  );

  const refreshToken = jwt.sign(
    { userId, email },
    config.jwt.refreshSecret,
    { expiresIn: '7d' }
  );

  return { token, refreshToken };
}

export function verifyRefreshToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, config.jwt.refreshSecret) as TokenPayload;
  } catch {
    return null;
  }
}
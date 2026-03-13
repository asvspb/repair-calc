import { Router } from 'express';
import { registerSchema, loginSchema, refreshSchema } from '../middleware/validation.js';
import { authRateLimiter } from '../middleware/rateLimiter.js';
import { UserRepository } from '../db/repositories/user.repo.js';
import { authenticate, generateTokens, verifyRefreshToken } from '../middleware/auth.js';
import { badRequest, unauthorized } from '../middleware/errorHandler.js';
import type { AuthRequest } from '../types/index.js';

const router = Router();

// POST /api/auth/register
router.post('/register', authRateLimiter, async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);
    
    // Check if user exists
    const existing = await UserRepository.findByEmail(data.email);
    if (existing) {
      throw badRequest('Email already registered');
    }
    
    const user = await UserRepository.create(data.email, data.password, data.name);
    const tokens = generateTokens(user.id, user.email);
    
    res.status(201).json({
      status: 'success',
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
        ...tokens,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/login
router.post('/login', authRateLimiter, async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);
    
    const user = await UserRepository.findByEmail(data.email);
    if (!user) {
      throw unauthorized('Invalid email or password');
    }
    
    const isValid = await UserRepository.verifyPassword(user, data.password);
    if (!isValid) {
      throw unauthorized('Invalid email or password');
    }
    
    const tokens = generateTokens(user.id, user.email);
    
    res.json({
      status: 'success',
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
        ...tokens,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res, next) => {
  try {
    const data = refreshSchema.parse(req.body);
    
    const payload = verifyRefreshToken(data.refreshToken);
    if (!payload) {
      throw unauthorized('Invalid refresh token');
    }
    
    const user = await UserRepository.findById(payload.userId);
    if (!user) {
      throw unauthorized('User not found');
    }
    
    const tokens = generateTokens(user.id, user.email);
    
    res.json({
      status: 'success',
      data: tokens,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req: AuthRequest, res, next) => {
  try {
    res.json({
      status: 'success',
      data: {
        id: req.user!.id,
        email: req.user!.email,
        name: req.user!.name,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/logout
router.post('/logout', authenticate, (_req, res) => {
  // In a production app, you would invalidate the refresh token
  res.json({
    status: 'success',
    message: 'Logged out successfully',
  });
});

export default router;
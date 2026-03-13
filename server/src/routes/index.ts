import { Router } from 'express';
import authRoutes from './auth.js';
import projectsRoutes from './projects.js';
import roomsRoutes from './rooms.js';
import worksRoutes from './works.js';
import syncRoutes from './sync.js';
import aiRoutes from './ai.js';

export const router = Router();

// Auth routes (no auth required)
router.use('/auth', authRoutes);

// Protected routes (auth required)
router.use('/projects', projectsRoutes);
router.use('/rooms', roomsRoutes);
router.use('/works', worksRoutes);
router.use('/sync', syncRoutes);
router.use('/ai', aiRoutes);
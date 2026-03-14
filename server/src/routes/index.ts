import { Router } from 'express';
import authRoutes from './auth.js';
import projectsRoutes from './projects.js';
import roomsRoutes from './rooms.js';
import worksRoutes from './works.js';
import geometryRoutes from './geometry.js';
import syncRoutes from './sync.js';
import aiRoutes from './ai.js';

export const router = Router();

// Auth routes (no auth required)
router.use('/auth', authRoutes);

// Protected routes (auth required)
router.use('/projects', projectsRoutes);
router.use('/rooms', roomsRoutes);
router.use('/works', worksRoutes);
router.use('/', geometryRoutes);  // geometry routes use various paths
router.use('/sync', syncRoutes);
router.use('/ai', aiRoutes);

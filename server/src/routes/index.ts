import { Router } from 'express';
import authRoutes from './auth.js';
import projectsRoutes from './projects.js';
import roomsRoutes from './rooms.js';
import worksRoutes from './works.js';
import geometryRoutes from './geometry.js';
import syncRoutes from './sync.js';
import aiRoutes from './ai.js';
import updateRoutes from './update.js';
import totalsRoutes from './totals.js';
import objectsRoutes from './objects.js';
import usersRoutes from './users.js';

export const router = Router();

// Auth routes (no auth required)
router.use('/auth', authRoutes);

// Protected routes (auth required)
router.use('/users', usersRoutes);  // User profile
router.use('/objects', objectsRoutes);  // Objects CRUD
router.use('/projects', projectsRoutes);
router.use('/', roomsRoutes);  // rooms routes include both /projects/:id/rooms and /rooms/:id
router.use('/works', worksRoutes);
router.use('/', geometryRoutes);  // geometry routes use various paths
router.use('/sync', syncRoutes);
router.use('/ai', aiRoutes);
router.use('/update', updateRoutes);  // Update Service API
router.use('/prices', updateRoutes);  // Prices API (alias for /update/prices)
router.use('/totals', totalsRoutes);  // Calculated totals API

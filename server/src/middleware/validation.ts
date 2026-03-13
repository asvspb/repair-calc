import { z } from 'zod';

// Password validation
export const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Must contain uppercase letter')
  .regex(/[a-z]/, 'Must contain lowercase letter')
  .regex(/[0-9]/, 'Must contain number');

// Auth schemas
export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: passwordSchema,
  name: z.string().min(1).max(255).optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

// Project schemas
export const createProjectSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  city: z.string().max(100).optional(),
  use_ai_pricing: z.boolean().optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  city: z.string().max(100).optional(),
  use_ai_pricing: z.boolean().optional(),
  last_ai_price_update: z.string().datetime().optional().nullable(),
  version: z.number().int().positive().optional(),
});

// Room schemas
export const createRoomSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  geometry_mode: z.enum(['simple', 'extended', 'advanced']).optional(),
  length: z.number().min(0).optional(),
  width: z.number().min(0).optional(),
  height: z.number().min(0).optional(),
});

export const updateRoomSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  geometry_mode: z.enum(['simple', 'extended', 'advanced']).optional(),
  length: z.number().min(0).optional(),
  width: z.number().min(0).optional(),
  height: z.number().min(0).optional(),
  version: z.number().int().positive().optional(),
});

export const reorderRoomsSchema = z.object({
  roomIds: z.array(z.string().uuid()).min(1),
});

// Work schemas
export const createWorkSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  unit: z.string().max(36).optional(),
  enabled: z.boolean().optional(),
  work_unit_price: z.number().min(0).optional(),
  calculation_type: z.enum(['floorArea', 'netWallArea', 'skirtingLength', 'customCount']).optional(),
  count: z.number().int().positive().optional().nullable(),
  manual_qty: z.number().min(0).optional().nullable(),
  use_manual_qty: z.boolean().optional(),
  is_custom: z.boolean().optional(),
});

export const updateWorkSchema = createWorkSchema.partial();

// Opening schemas
export const createOpeningSchema = z.object({
  type: z.enum(['window', 'door']),
  width: z.number().positive('Width must be positive'),
  height: z.number().positive('Height must be positive'),
  comment: z.string().max(500).optional(),
  subsection_id: z.string().uuid().optional().nullable(),
});

export const updateOpeningSchema = z.object({
  type: z.enum(['window', 'door']).optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  comment: z.string().max(500).optional().nullable(),
});

// Material schemas
export const createMaterialSchema = z.object({
  name: z.string().max(255),
  quantity: z.number().min(0).optional(),
  unit: z.string().max(36).optional(),
  price_per_unit: z.number().min(0).optional(),
  coverage_per_unit: z.number().min(0).optional().nullable(),
  consumption_rate: z.number().min(0).optional().nullable(),
  layers: z.number().int().positive().optional(),
  pieces_per_unit: z.number().int().positive().optional().nullable(),
  waste_percent: z.number().min(0).max(100).optional(),
  package_size: z.number().min(0).optional().nullable(),
  is_perimeter: z.boolean().optional(),
  multiplier: z.number().min(0).optional(),
  auto_calc_enabled: z.boolean().optional(),
});

export const updateMaterialSchema = createMaterialSchema.partial();

// Tool schemas
export const createToolSchema = z.object({
  name: z.string().max(255),
  quantity: z.number().int().positive().optional(),
  price: z.number().min(0).optional(),
  is_rent: z.boolean().optional(),
  rent_period: z.number().int().positive().optional().nullable(),
});

export const updateToolSchema = createToolSchema.partial();

// Sync schemas
export const syncPushSchema = z.object({
  changes: z.array(z.object({
    id: z.string().uuid(),
    timestamp: z.number(),
    operation: z.enum(['create', 'update', 'delete']),
    entity: z.enum(['project', 'room', 'work', 'material', 'tool', 'opening', 'subsection', 'segment', 'obstacle', 'wall_section']),
    entityId: z.string().uuid(),
    data: z.any(),
  })),
});

// ID parameter validation
export const idParamSchema = z.object({
  id: z.string().uuid('Invalid ID format'),
});

export const projectIdParamSchema = z.object({
  projectId: z.string().uuid('Invalid project ID format'),
});

export const roomIdParamSchema = z.object({
  roomId: z.string().uuid('Invalid room ID format'),
});

export const workIdParamSchema = z.object({
  workId: z.string().uuid('Invalid work ID format'),
});
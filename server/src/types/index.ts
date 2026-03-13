import type { Request } from 'express';

// User types
export interface User {
  id: string;
  email: string;
  name: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface UserWithPassword extends User {
  password_hash: string;
}

// Project types
export interface Project {
  id: string;
  user_id: string;
  name: string;
  city: string | null;
  use_ai_pricing: boolean;
  last_ai_price_update: Date | null;
  version: number;
  created_at: Date;
  updated_at: Date;
}

export interface ProjectWithRooms extends Project {
  rooms: Room[];
}

// Room types
export interface Room {
  id: string;
  project_id: string;
  name: string;
  geometry_mode: 'simple' | 'extended' | 'advanced';
  length: number;
  width: number;
  height: number;
  version: number;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}

// Opening types
export interface Opening {
  id: string;
  room_id: string;
  subsection_id: string | null;
  type: 'window' | 'door';
  width: number;
  height: number;
  comment: string | null;
  sort_order: number;
}

// Work types
export interface Work {
  id: string;
  room_id: string;
  name: string;
  unit: string;
  enabled: boolean;
  work_unit_price: number;
  calculation_type: 'floorArea' | 'netWallArea' | 'skirtingLength' | 'customCount';
  count: number | null;
  manual_qty: number | null;
  use_manual_qty: boolean;
  is_custom: boolean;
  version: number;
  sort_order: number;
}

// Material types
export interface Material {
  id: string;
  work_id: string;
  name: string;
  quantity: number;
  unit: string;
  price_per_unit: number;
  coverage_per_unit: number | null;
  consumption_rate: number | null;
  layers: number;
  pieces_per_unit: number | null;
  waste_percent: number;
  package_size: number | null;
  is_perimeter: boolean;
  multiplier: number;
  auto_calc_enabled: boolean;
  version: number;
  sort_order: number;
}

// Tool types
export interface Tool {
  id: string;
  work_id: string;
  name: string;
  quantity: number;
  price: number;
  is_rent: boolean;
  rent_period: number | null;
  version: number;
  sort_order: number;
}

// Extended mode geometry types
export interface RoomSubSection {
  id: string;
  room_id: string;
  name: string | null;
  shape: 'rectangle' | 'trapezoid' | 'triangle' | 'parallelogram';
  length: number;
  width: number;
  base1: number | null;
  base2: number | null;
  depth: number | null;
  side1: number | null;
  side2: number | null;
  side_a: number | null;
  side_b: number | null;
  side_c: number | null;
  base: number | null;
  side: number | null;
  version: number;
  sort_order: number;
}

// Advanced mode geometry types
export interface RoomSegment {
  id: string;
  room_id: string;
  name: string | null;
  length: number;
  width: number;
  operation: 'add' | 'subtract';
  version: number;
  sort_order: number;
}

export interface Obstacle {
  id: string;
  room_id: string;
  name: string | null;
  type: 'column' | 'duct' | 'niche' | 'other';
  area: number;
  perimeter: number;
  operation: 'add' | 'subtract';
  version: number;
  sort_order: number;
}

export interface WallSection {
  id: string;
  room_id: string;
  name: string | null;
  length: number;
  height: number;
  version: number;
  sort_order: number;
}

// Auth request extension
export interface AuthRequest extends Request {
  user?: User;
}

// API Response types
export interface ApiResponse<T> {
  status: 'success' | 'error';
  data?: T;
  message?: string;
  errors?: unknown[];
}

// Token types
export interface TokenPayload {
  userId: string;
  email: string;
}

export interface AuthTokens {
  token: string;
  refreshToken: string;
}

// Sync types
export interface ChangeLogEntry {
  id: string;
  timestamp: number;
  operation: 'create' | 'update' | 'delete';
  entity: 'project' | 'room' | 'work' | 'material' | 'tool' | 'opening' | 'subsection' | 'segment' | 'obstacle' | 'wall_section';
  entityId: string;
  data: unknown;
}

export interface Conflict {
  id: string;
  entity: string;
  entityId: string;
  serverVersion: number;
  clientVersion: number;
}
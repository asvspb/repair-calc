import type { Request } from 'express';

// User types
export interface User {
  id: string;
  email: string;
  name: string | null;
  role?: 'admin' | 'user';
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

// DbObject — represents a real-estate property within a project
export interface DbObject {
  id: string;
  project_id: string;
  user_id: string;
  name: string;
  city: string | null;
  address: string | null;
  use_ai_pricing: boolean;
  last_ai_price_update: Date | null;
  version: number;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface ObjectWithRooms extends DbObject {
  rooms: Room[];
}

export interface ProjectWithObjects extends Project {
  objects: ObjectWithRooms[];
}

// Room types
export interface Room {
  id: string;
  object_id: string;
  name: string;
  geometry_mode: 'simple' | 'extended' | 'advanced';
  length: number;
  width: number;
  height: number;
  version: number;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
  segments?: string | null;
  obstacles?: string | null;
  wall_sections?: string | null;
  sub_sections?: string | null;
  windows?: string | null;
  doors?: string | null;
  works?: string | null;
  simple_mode_data?: string | null;
  extended_mode_data?: string | null;
  advanced_mode_data?: string | null;
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

export type PriceCategory = 'work' | 'material' | 'tool';

// Price catalog types
export interface PriceCatalog {
  id: string;
  name: string;
  category: PriceCategory;
  unit: string;
  city: string;
  price_min: number;
  price_avg: number;
  price_max: number;
  currency: string;
  source_id: string | null;
  source_type: string | null;
  confidence_score: number;
  description: string | null;
  metadata: Record<string, unknown> | null;
  valid_from: Date;
  valid_until: Date | null;
  version: number;
  created_at: Date;
  updated_at: Date;
}

export interface PriceSource {
  id: string;
  name: string;
  type: string;
  api_endpoint: string | null;
  is_active: boolean;
  priority: number;
  rate_limit_per_minute: number;
  circuit_breaker_failures: number;
  circuit_breaker_state: 'closed' | 'open' | 'half-open';
  circuit_breaker_last_failure_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface PriceHistory {
  id: string;
  price_catalog_id: string;
  job_id: string | null;
  old_price_min: number | null;
  old_price_avg: number | null;
  old_price_max: number | null;
  new_price_min: number | null;
  new_price_avg: number | null;
  new_price_max: number | null;
  price_change_percent: number | null;
  source_id: string | null;
  confidence_score: number | null;
  requires_review: boolean;
  created_at: Date;
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
  user?: User | { id: string; email: string; role?: 'admin' | 'user' };
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
  role?: 'admin' | 'user';
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
  entity:
    | 'project'
    | 'room'
    | 'work'
    | 'material'
    | 'tool'
    | 'opening'
    | 'subsection'
    | 'segment'
    | 'obstacle'
    | 'wall_section';
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

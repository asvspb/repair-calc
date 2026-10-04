import type { PriceCategory, SourceType } from './priceCatalog.repo.js';

export type { PriceCategory, SourceType };
export type JobType = 'scheduled' | 'manual' | 'incremental';
export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type ItemStatus = 'pending' | 'success' | 'failed' | 'skipped';
export type LogLevel = 'info' | 'debug' | 'warn' | 'error';

export interface UpdateJob {
  id: string;
  type: JobType;
  status: JobStatus;
  city: string | null;
  categories: PriceCategory[] | null;
  sources: SourceType[] | null;
  triggered_by: string | null;
  total_items: number;
  processed_items: number;
  failed_items: number;
  items_created: number;
  items_updated: number;
  items_skipped: number;
  started_at: Date | null;
  completed_at: Date | null;
  duration_ms: number | null;
  error_message: string | null;
  error_details: Record<string, unknown> | null;
  created_at: Date;
}

export interface UpdateJobItem {
  id: string;
  job_id: string;
  item_name: string;
  item_category: PriceCategory;
  city: string;
  status: ItemStatus;
  source: SourceType | null;
  price_catalog_id: string | null;
  price_change: number | null;
  error_message: string | null;
  started_at: Date | null;
  completed_at: Date | null;
  duration_ms: number | null;
  created_at: Date;
}

export interface UpdateJobParam {
  id: string;
  job_id: string;
  param_name: string;
  param_value: unknown;
  created_at: Date;
}

export interface UpdateJobLock {
  id: string;
  job_id: string;
  item_key: string;
  locked_at: Date;
  expires_at: Date | null;
}

export interface UpdateLog {
  id: string;
  job_id: string | null;
  level: LogLevel;
  message: string;
  context: Record<string, unknown> | null;
  created_at: Date;
}

export interface CreateJobInput {
  type: JobType;
  city?: string;
  categories?: PriceCategory[];
  sources?: SourceType[];
  triggered_by?: string;
}

export interface CreateJobItemInput {
  job_id: string;
  item_name: string;
  item_category: PriceCategory;
  city: string;
}

export interface JobFilter {
  status?: JobStatus;
  type?: JobType;
  limit?: number;
  offset?: number;
}

export interface JobProgress {
  total: number;
  processed: number;
  failed: number;
  percent: number;
}

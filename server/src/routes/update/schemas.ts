import { z } from 'zod';

export const runUpdateSchema = z.object({
  city: z.string().max(100).optional(),
  categories: z.array(z.enum(['work', 'material', 'tool'])).optional(),
  sources: z.array(z.enum(['ai_gemini', 'ai_mistral', 'web_scraper', 'api'])).optional(),
  force: z.boolean().default(false),
  priority: z.enum(['high', 'normal', 'low']).default('normal'),
  batchSize: z.number().min(1).max(50).default(10),
});

export const updateScheduleSchema = z.object({
  enabled: z.boolean(),
  cron: z.string().max(100),
  timezone: z.string().max(50),
});

export const createPriceSchema = z.object({
  name: z.string().max(255),
  category: z.enum(['work', 'material', 'tool']),
  unit: z.string().max(36).default('м²'),
  city: z.string().max(100),
  price_min: z.number().min(0).optional(),
  price_avg: z.number().min(0).optional(),
  price_max: z.number().min(0).optional(),
  currency: z.string().length(3).default('RUB'),
  source_type: z.enum(['ai_gemini', 'ai_mistral', 'web_scraper', 'api', 'manual']).optional(),
  confidence_score: z.number().min(0).max(1).default(1),
  description: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const createWebhookSchema = z.object({
  url: z.string().url().max(500),
  events: z
    .array(
      z.enum([
        'job.started',
        'job.completed',
        'job.failed',
        'job.cancelled',
        'job.anomaly_detected',
        'parser.circuit_open',
        'parser.circuit_closed',
      ]),
    )
    .min(1),
  secret: z.string().min(16).max(255),
  active: z.boolean().default(true),
  retry_count: z.number().min(0).max(10).default(3),
  retry_delay_ms: z.number().min(100).max(60000).default(5000),
  timeout_ms: z.number().min(1000).max(30000).default(5000),
});

export const updateWebhookSchema = z.object({
  url: z.string().url().max(500).optional(),
  events: z
    .array(
      z.enum([
        'job.started',
        'job.completed',
        'job.failed',
        'job.cancelled',
        'job.anomaly_detected',
        'parser.circuit_open',
        'parser.circuit_closed',
      ]),
    )
    .min(1)
    .optional(),
  secret: z.string().min(16).max(255).optional(),
  active: z.boolean().optional(),
  retry_count: z.number().min(0).max(10).optional(),
  retry_delay_ms: z.number().min(100).max(60000).optional(),
  timeout_ms: z.number().min(1000).max(30000).optional(),
});

export const createABTestSchema = z.object({
  name: z.string().min(3).max(255),
  description: z.string().max(1000).optional(),
  parser_a: z.enum(['ai_gemini', 'ai_mistral', 'web_scraper', 'api']),
  parser_b: z.enum(['ai_gemini', 'ai_mistral', 'web_scraper', 'api']),
  traffic_split: z.number().min(1).max(99).default(50),
});

export const updateABTestSchema = z.object({
  name: z.string().min(3).max(255).optional(),
  description: z.string().max(1000).optional(),
  traffic_split: z.number().min(1).max(99).optional(),
});

export const completeABTestSchema = z.object({
  winner: z.enum(['parser_a', 'parser_b', 'tie']),
  confidence_level: z.number().min(0).max(1),
});

import type { PriceParser, RateLimit } from './parsers/types.js';
import type { ParserGroup } from '../../db/repositories/abTest.repo.js';
import type { CircuitBreaker } from './parsers/circuitBreaker.js';
import type { RateLimiter } from './parsers/rateLimiter.js';

// ═══════════════════════════════════════════════════════
// ТИПЫ ПАРСЕР-МЕНЕДЖЕРА (вынесено из parserManager.ts)
// ═══════════════════════════════════════════════════════

export type ParserType = 'ai_gemini' | 'ai_mistral' | 'web_scraper' | 'api' | 'manual';

export interface ParserInfo {
  type: ParserType;
  name: string;
  available: boolean;
  circuitBreakerState: 'closed' | 'open' | 'half-open';
  rateLimit: RateLimit;
  lastSuccess: Date | null;
  avgResponseTimeMs: number | null;
}

export interface ABTestConfig {
  enabled: boolean;
  testId: string | null;
  geminiWeight: number; // 0-100, процент запросов к Gemini (legacy)
}

export interface ABTestSelection {
  testId: string;
  parserGroup: ParserGroup;
  parserType: ParserType;
}

export type { PriceParser, CircuitBreaker, RateLimiter };

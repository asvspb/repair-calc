// ═══════════════════════════════════════════════════════
// ТИПЫ A/B ТЕСТИРОВАНИЯ (вынесено из abTest.repo.ts)
// ═══════════════════════════════════════════════════════

export type ParserType = 'ai_gemini' | 'ai_mistral' | 'web_scraper' | 'api';
export type TestStatus = 'draft' | 'running' | 'paused' | 'completed' | 'cancelled';
export type ParserGroup = 'a' | 'b';
export type Winner = 'parser_a' | 'parser_b' | 'tie';

export interface ABTest {
  id: string;
  name: string;
  description: string | null;
  parser_a: ParserType;
  parser_b: ParserType;
  traffic_split: number;
  status: TestStatus;
  started_at: Date | null;
  ended_at: Date | null;
  total_requests_a: number;
  total_requests_b: number;
  success_count_a: number;
  success_count_b: number;
  avg_response_time_a: number;
  avg_response_time_b: number;
  avg_price_a: string | null;
  avg_price_b: string | null;
  winner: Winner | null;
  confidence_level: string | null;
  created_by: string | null;
  completed_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface ABTestResult {
  id: string;
  test_id: string;
  item_name: string;
  city: string;
  category: string;
  parser_group: ParserGroup;
  parser_type: ParserType;
  success: boolean;
  price_min: string | null;
  price_avg: string | null;
  price_max: string | null;
  currency: string;
  confidence_score: string | null;
  response_time_ms: number | null;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
  created_at: Date;
}

export interface ABTestDailyStats {
  id: string;
  test_id: string;
  date: Date;
  requests_a: number;
  success_a: number;
  failures_a: number;
  total_response_time_a: number;
  total_price_a: string;
  requests_b: number;
  success_b: number;
  failures_b: number;
  total_response_time_b: number;
  total_price_b: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateABTestInput {
  name: string;
  description?: string;
  parser_a: ParserType;
  parser_b: ParserType;
  traffic_split?: number;
  created_by?: string;
}

export interface ABTestResultInput {
  test_id: string;
  item_name: string;
  city: string;
  category: string;
  parser_group: ParserGroup;
  parser_type: ParserType;
  success: boolean;
  price_min?: number;
  price_avg?: number;
  price_max?: number;
  currency?: string;
  confidence_score?: number;
  response_time_ms?: number;
  error_message?: string;
  metadata?: Record<string, unknown>;
}

export interface ABTestStats {
  testId: string;
  groupA: {
    requests: number;
    successRate: number;
    avgResponseTime: number;
    avgPrice: number | null;
  };
  groupB: {
    requests: number;
    successRate: number;
    avgResponseTime: number;
    avgPrice: number | null;
  };
  winner: Winner | null;
  confidenceLevel: number | null;
}

/** Данные обновления записи A/B теста. */
export interface ABTestUpdateData {
  name?: string;
  description?: string;
  traffic_split?: number;
  status?: TestStatus;
  started_at?: Date | null;
  ended_at?: Date | null;
  winner?: Winner | null;
  confidence_level?: number | null;
  completed_by?: string | null;
}

/**
 * Часть контракта `this`, нужная методам записи/чтения при разбиении
 * исходного объекта на read/write части (собирается в abTest.repo.ts).
 */
export interface ABTestRepoThis {
  findById(id: string): Promise<ABTest | null>;
  update(id: string, data: ABTestUpdateData): Promise<ABTest | null>;
  updateTestCounters(
    testId: string,
    group: ParserGroup,
    data: { success: boolean; responseTime?: number; price?: number },
  ): Promise<void>;
  updateDailyStats(
    testId: string,
    group: ParserGroup,
    data: { success: boolean; responseTime?: number; price?: number },
  ): Promise<void>;
  calculateWinner(
    groupA: { successRate: number; avgResponseTime: number; avgPrice: number | null },
    groupB: { successRate: number; avgResponseTime: number; avgPrice: number | null },
  ): { winner: Winner; confidenceLevel: number };
}

import { getGeminiParser } from './parsers/gemini.js';
import { getMistralParser } from './parsers/mistral.js';
import { CircuitBreaker } from './parsers/circuitBreaker.js';
import { RateLimiter } from './parsers/rateLimiter.js';
import type { PriceParser } from './parsers/types.js';
import type { ParserInfo, ParserType } from './parserManager.types.js';

// ═══════════════════════════════════════════════════════
// РЕЕСТР ПАРСЕРОВ (вынесено из parserManager.ts):
// регистрации, circuit breaker'ы, rate limiter'ы, метрики отклика
// ═══════════════════════════════════════════════════════

export class ParserRegistry {
  private parsers: Map<ParserType, PriceParser> = new Map();
  private circuitBreakers: Map<ParserType, CircuitBreaker> = new Map();
  private rateLimiters: Map<ParserType, RateLimiter> = new Map();
  private lastSuccess: Map<ParserType, Date> = new Map();
  private responseTimes: Map<ParserType, number[]> = new Map();

  constructor() {
    this.initializeParsers();
  }

  // ─── ИНИЦИАЛИЗАЦИЯ ────────────────────────────────────────

  private initializeParsers(): void {
    // Регистрируем Gemini
    const gemini = getGeminiParser();
    if (gemini) {
      this.register(gemini);
    }

    // Регистрируем Mistral
    const mistral = getMistralParser();
    if (mistral) {
      this.register(mistral);
    }

    // Web scrapers будут добавлены позже
  }

  register(parser: PriceParser): void {
    this.parsers.set(parser.type as ParserType, parser);
    this.circuitBreakers.set(
      parser.type as ParserType,
      new CircuitBreaker(parser.type, {
        threshold: 5,
        resetTimeoutMs: 600000, // 10 минут
        halfOpenMaxRequests: 3,
      }),
    );
    this.rateLimiters.set(
      parser.type as ParserType,
      new RateLimiter({ requestsPerMinute: parser.getRateLimit().requestsPerMinute }),
    );
    this.responseTimes.set(parser.type as ParserType, []);
  }

  // ─── ДОСТУП ────────────────────────────────────────────────

  getParser(type: ParserType): PriceParser | null {
    return this.parsers.get(type) ?? null;
  }

  entries(): [ParserType, PriceParser][] {
    return Array.from(this.parsers.entries());
  }

  getCircuitBreaker(type: ParserType): CircuitBreaker | null {
    return this.circuitBreakers.get(type) ?? null;
  }

  getRateLimiter(type: ParserType): RateLimiter | null {
    return this.rateLimiters.get(type) ?? null;
  }

  /** Проверяет доступность парсера (circuit breaker). */
  isAvailable(type: ParserType): boolean {
    const parser = this.parsers.get(type);
    if (!parser) return false;

    const cb = this.circuitBreakers.get(type);
    if (cb && !cb.isAvailable()) return false;

    return true;
  }

  // ─── МЕТРИКИ ────────────────────────────────────────────────

  /** Записывает успешный результат и время отклика. */
  recordSuccess(type: ParserType, responseTime: number): void {
    this.lastSuccess.set(type, new Date());

    const times = this.responseTimes.get(type) || [];
    times.push(responseTime);

    // Храним последние 100 измерений
    if (times.length > 100) {
      times.shift();
    }

    this.responseTimes.set(type, times);
  }

  /** Получает информацию о всех парсерах. */
  getParsersInfo(): ParserInfo[] {
    const infos: ParserInfo[] = [];

    for (const [type, parser] of this.parsers) {
      const cb = this.circuitBreakers.get(type);
      const cbState = cb?.getState();
      const times = this.responseTimes.get(type) || [];

      infos.push({
        type,
        name: parser.name,
        available: this.isAvailable(type),
        circuitBreakerState: cbState?.state || 'closed',
        rateLimit: parser.getRateLimit(),
        lastSuccess: this.lastSuccess.get(type) || null,
        avgResponseTimeMs:
          times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : null,
      });
    }

    return infos;
  }
}

/**
 * AI Services - экспорт всех AI провайдеров
 * Фаза 7.5: AI-интеграция
 */

export * from './types.js';
export { GeminiAIProvider, getGeminiAIProvider, isGeminiAIEnabled } from './geminiProvider.js';
export { MistralAIProvider, getMistralAIProvider, isMistralAIEnabled } from './mistralProvider.js';
export {
  generatePromptHash,
  findCachedResponse,
  saveCachedResponse,
  getUserAIHistory,
  getAIUsageStats,
  cleanupOldAIRecords,
  shouldUseCache,
  getCacheTTL,
  type CachedAIResponse,
} from './aiCache.js';

import type { AIProvider } from './types.js';
import { getGeminiAIProvider, isGeminiAIEnabled } from './geminiProvider.js';
import { getMistralAIProvider, isMistralAIEnabled } from './mistralProvider.js';

/**
 * Получить доступный AI провайдер
 * Приоритет: Gemini -> Mistral
 */
export function getAvailableAIProvider(): AIProvider | null {
  // Приоритет Gemini
  if (isGeminiAIEnabled()) {
    const gemini = getGeminiAIProvider();
    if (gemini.isAvailable()) {
      return gemini;
    }
  }

  // Fallback на Mistral
  if (isMistralAIEnabled()) {
    const mistral = getMistralAIProvider();
    if (mistral.isAvailable()) {
      return mistral;
    }
  }

  return null;
}

/**
 * Получить все доступные провайдеры
 */
export function getAvailableAIProviders(): AIProvider[] {
  const providers: AIProvider[] = [];

  if (isGeminiAIEnabled()) {
    providers.push(getGeminiAIProvider());
  }

  if (isMistralAIEnabled()) {
    providers.push(getMistralAIProvider());
  }

  return providers;
}

/**
 * Проверить, доступен ли хотя бы один AI провайдер
 */
export function isAIAvailable(): boolean {
  return isGeminiAIEnabled() || isMistralAIEnabled();
}
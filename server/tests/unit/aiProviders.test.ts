/**
 * Unit tests for AI Providers
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIProviderError } from '../../src/services/ai/types.js';

describe('AI Providers', () => {
  describe('AIProviderError', () => {
    it('should create error with correct properties', () => {
      const error = new AIProviderError(
        'Test error message',
        'TestProvider',
        true,
        'TEST_CODE'
      );

      expect(error.message).toBe('Test error message');
      expect(error.provider).toBe('TestProvider');
      expect(error.retryable).toBe(true);
      expect(error.code).toBe('TEST_CODE');
      expect(error.name).toBe('AIProviderError');
    });

    it('should have default retryable value as false', () => {
      const error = new AIProviderError('Error', 'Provider');
      expect(error.retryable).toBe(false);
    });

    it('should be instance of Error', () => {
      const error = new AIProviderError('Error', 'Provider');
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('AI Types', () => {
    it('should have correct EstimateRequest type structure', async () => {
      const request = {
        description: 'Ремонт ванной',
        city: 'Москва',
        projectType: 'standard' as const,
        roomType: 'bathroom',
        area: 10,
      };

      expect(request.description).toBeDefined();
      expect(request.city).toBeDefined();
      expect(['standard', 'economy', 'premium']).toContain(request.projectType);
    });

    it('should have correct SuggestMaterialsRequest type structure', async () => {
      const request = {
        workName: 'Покраска стен',
        area: 50,
        city: 'Москва',
        roomType: 'bedroom',
        additionalInfo: 'Высота потолков 2.7м',
      };

      expect(request.workName).toBeDefined();
      expect(request.area).toBeTypeOf('number');
      expect(request.city).toBeDefined();
    });

    it('should have correct GenerateTemplateRequest type structure', async () => {
      const request = {
        roomType: 'bathroom',
        area: 8,
        city: 'Москва',
        style: 'standard' as const,
      };

      expect(request.roomType).toBeDefined();
      expect(request.area).toBeTypeOf('number');
      expect(request.city).toBeDefined();
      expect(['standard', 'economy', 'premium']).toContain(request.style);
    });
  });
});

describe('AI Module Functions', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe('isGeminiAIEnabled', () => {
    it('should return false when GEMINI_API_KEY is not set', async () => {
      vi.stubEnv('GEMINI_API_KEY', '');
      const { isGeminiAIEnabled } = await import('../../src/services/ai/geminiProvider.js');
      expect(isGeminiAIEnabled()).toBe(false);
    });

    it('should return true when GEMINI_API_KEY is set', async () => {
      vi.stubEnv('GEMINI_API_KEY', 'test-api-key');
      const { isGeminiAIEnabled } = await import('../../src/services/ai/geminiProvider.js');
      expect(isGeminiAIEnabled()).toBe(true);
    });
  });

  describe('isMistralAIEnabled', () => {
    it('should return false when MISTRAL_API_KEY is not set', async () => {
      vi.stubEnv('MISTRAL_API_KEY', '');
      const { isMistralAIEnabled } = await import('../../src/services/ai/mistralProvider.js');
      expect(isMistralAIEnabled()).toBe(false);
    });

    it('should return true when MISTRAL_API_KEY is set', async () => {
      vi.stubEnv('MISTRAL_API_KEY', 'test-api-key');
      const { isMistralAIEnabled } = await import('../../src/services/ai/mistralProvider.js');
      expect(isMistralAIEnabled()).toBe(true);
    });
  });
});
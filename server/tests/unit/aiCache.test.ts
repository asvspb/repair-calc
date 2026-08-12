/**
 * Unit tests for AI Cache Service
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generatePromptHash,
  shouldUseCache,
  getCacheTTL,
} from '../../src/services/ai/aiCache.js';

describe('AI Cache Service', () => {
  describe('generatePromptHash', () => {
    it('should generate consistent hash for same inputs', () => {
      const params = { city: 'Москва', description: 'Ремонт ванной' };
      const hash1 = generatePromptHash('estimate', params);
      const hash2 = generatePromptHash('estimate', params);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 produces 64 hex chars
    });

    it('should generate different hashes for different inputs', () => {
      const params1 = { city: 'Москва', description: 'Ремонт ванной' };
      const params2 = { city: 'Санкт-Петербург', description: 'Ремонт ванной' };

      const hash1 = generatePromptHash('estimate', params1);
      const hash2 = generatePromptHash('estimate', params2);

      expect(hash1).not.toBe(hash2);
    });

    it('should generate same hash regardless of key order', () => {
      const params1 = { a: '1', b: '2', c: '3' };
      const params2 = { c: '3', a: '1', b: '2' };

      const hash1 = generatePromptHash('test', params1);
      const hash2 = generatePromptHash('test', params2);

      expect(hash1).toBe(hash2);
    });

    it('should generate different hashes for different request types', () => {
      const params = { city: 'Москва', area: 20 };

      const hash1 = generatePromptHash('estimate', params);
      const hash2 = generatePromptHash('suggest-materials', params);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('shouldUseCache', () => {
    it('should return true for cacheable request types', () => {
      expect(shouldUseCache('estimate')).toBe(true);
      expect(shouldUseCache('suggest-materials')).toBe(true);
      expect(shouldUseCache('generate-template')).toBe(true);
    });

    it('should return false for non-cacheable request types', () => {
      expect(shouldUseCache('price-search')).toBe(false);
      expect(shouldUseCache('custom-query')).toBe(false);
      expect(shouldUseCache('')).toBe(false);
    });
  });

  describe('getCacheTTL', () => {
    it('should return correct TTL for each request type', () => {
      const hourMs = 60 * 60 * 1000;
      const dayMs = 24 * hourMs;

      expect(getCacheTTL('estimate')).toBe(24 * hourMs); // 24 hours
      expect(getCacheTTL('suggest-materials')).toBe(12 * hourMs); // 12 hours
      expect(getCacheTTL('generate-template')).toBe(7 * dayMs); // 7 days
    });

    it('should return default TTL for unknown request types', () => {
      const defaultTTL = 24 * 60 * 60 * 1000; // 24 hours
      expect(getCacheTTL('unknown-type')).toBe(defaultTTL);
    });
  });
});
/**
 * Тесты для ID Mapper утилиты
 */

import { describe, it, expect } from 'vitest';
import { generateId, mapLocalToServerId, mapServerToLocalId, isServerId } from '../../src/utils/idMapper';

describe('idMapper', () => {
  describe('generateId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      
      expect(id1).not.toBe(id2);
    });

    it('should generate string ID', () => {
      const id = generateId();
      
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });
  });

  describe('isServerId', () => {
    it('should return true for numeric string IDs', () => {
      expect(isServerId('123')).toBe(true);
      expect(isServerId('456789')).toBe(true);
    });

    it('should return false for UUID-like IDs', () => {
      expect(isServerId('abc-123-def')).toBe(false);
      expect(isServerId('room_123')).toBe(false);
      expect(isServerId('temp-456')).toBe(false);
    });
  });

  describe('mapLocalToServerId', () => {
    it('should map local ID to server ID', () => {
      const localId = 'room_123';
      const serverId = 456;
      const mapping = { 'room_123': 456 };
      
      const result = mapLocalToServerId(localId, mapping);
      
      expect(result).toBe(serverId);
    });

    it('should return null for unmapped local ID', () => {
      const mapping = { 'room_123': 456 };
      
      const result = mapLocalToServerId('room_999', mapping);
      
      expect(result).toBeNull();
    });
  });

  describe('mapServerToLocalId', () => {
    it('should map server ID to local ID', () => {
      const localId = 'room_123';
      const serverId = 456;
      const mapping = { 'room_123': 456 };
      
      const result = mapServerToLocalId(serverId, mapping);
      
      expect(result).toBe(localId);
    });

    it('should return null for unmapped server ID', () => {
      const mapping = { 'room_123': 456 };
      
      const result = mapServerToLocalId(999, mapping);
      
      expect(result).toBeNull();
    });
  });
});
/**
 * Тесты для функции syncPull API
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { syncPull, ProjectsApiError } from '../../src/api/projects';

// Mock fetch
const originalFetch = global.fetch;

describe('syncPull API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should call /api/sync/pull endpoint', async () => {
    const mockResponse = {
      status: 'success',
      data: {
        projects: [
          {
            id: 'proj-1',
            user_id: 'user-1',
            name: 'Test Project',
            city: 'Moscow',
            use_ai_pricing: false,
            last_ai_price_update: null,
            version: 1,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
            rooms: [
              {
                id: 'room-1',
                project_id: 'proj-1',
                name: 'Living Room',
                geometry_mode: 'simple',
                length: 5,
                width: 4,
                height: 2.6,
                segments: null,
                obstacles: null,
                wall_sections: null,
                sub_sections: null,
                windows: null,
                doors: null,
                works: null,
                simple_mode_data: null,
                extended_mode_data: null,
                advanced_mode_data: null,
                sort_order: 0,
                created_at: '2024-01-01T00:00:00Z',
                updated_at: '2024-01-01T00:00:00Z',
              },
            ],
            timestamp: Date.now(),
          },
        ],
      },
    };

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    localStorage.setItem('token', 'test-token');

    const result = await syncPull();

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/sync/pull'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
        }),
      })
    );

    expect(result.status).toBe('success');
    expect(result.data.projects).toHaveLength(1);
    expect(result.data.projects[0].rooms).toHaveLength(1);
    expect(result.data.projects[0].rooms[0].name).toBe('Living Room');
  });

  it('should throw ProjectsApiError on failure', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ message: 'Unauthorized' }),
      status: 401,
    });

    localStorage.setItem('token', 'invalid-token');

    await expect(syncPull()).rejects.toThrow(ProjectsApiError);
  });

  it('should include Authorization header when token exists', async () => {
    const mockResponse = {
      status: 'success',
      data: { projects: [], timestamp: Date.now() },
    };

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    localStorage.setItem('token', 'my-auth-token');

    await syncPull();

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer my-auth-token',
        }),
      })
    );
  });

  it('should not include Authorization header when no token', async () => {
    const mockResponse = {
      status: 'success',
      data: { projects: [], timestamp: Date.now() },
    };

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    await syncPull();

    const callArgs = (fetch as any).mock.calls[0][1];
    expect(callArgs.headers.Authorization).toBeUndefined();
  });
});
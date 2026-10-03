/**
 * Unit-тесты middleware депрекейшна (§15.3.2 ТЗ v1.1): заголовки
 * Deprecation/Sunset (RFC 8594) и winston-лог один раз на маршрут.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockLogger } = vi.hoisted(() => ({
  mockLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../src/middleware/logger.js', () => ({
  winstonLogger: mockLogger,
}));

import type { NextFunction, Request, Response } from 'express';
import { deprecate, resetDeprecationLog } from '../../src/middleware/deprecation.js';

function makeReq(method: string, path: string): Request {
  return { method, path, headers: {} } as unknown as Request;
}

function makeRes(): { res: Response; setHeader: ReturnType<typeof vi.fn> } {
  const setHeader = vi.fn();
  return { res: { setHeader } as unknown as Response, setHeader };
}

const next = vi.fn() as unknown as NextFunction;

describe('deprecate middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDeprecationLog();
  });

  it('ставит Deprecation: true и вызывает next', () => {
    const { res, setHeader } = makeRes();

    deprecate('PUT /api/projects/:id/with-rooms')(
      makeReq('PUT', '/api/projects/1/with-rooms'),
      res,
      next,
    );

    expect(setHeader).toHaveBeenCalledWith('Deprecation', 'true');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('ставит Sunset только когда дата передана', () => {
    const sunsetDate = 'Sat, 01 Jun 2026 00:00:00 GMT';
    const { res, setHeader } = makeRes();

    deprecate('route-with-sunset', sunsetDate)(makeReq('GET', '/api/old'), res, next);

    expect(setHeader).toHaveBeenCalledWith('Sunset', sunsetDate);

    const { res: res2, setHeader: setHeader2 } = makeRes();
    deprecate('route-without-sunset')(makeReq('GET', '/api/old'), res2, next);
    expect(setHeader2).not.toHaveBeenCalledWith('Sunset', expect.anything());
  });

  it('логирует WARN один раз на маршрут, а не на каждый запрос', () => {
    const middleware = deprecate('GET /api/legacy');

    middleware(makeReq('GET', '/api/legacy'), makeRes().res, next);
    middleware(makeReq('GET', '/api/legacy'), makeRes().res, next);
    middleware(makeReq('GET', '/api/legacy'), makeRes().res, next);

    expect(mockLogger.warn).toHaveBeenCalledTimes(1);
    expect(mockLogger.warn).toHaveBeenCalledWith('[DEPRECATION] Request to deprecated endpoint', {
      route: 'GET /api/legacy',
      method: 'GET',
      path: '/api/legacy',
    });
  });

  it('разные маршруты логируются независимо; resetDeprecationLog сбрасывает реестр', () => {
    deprecate('route-a')(makeReq('GET', '/a'), makeRes().res, next);
    deprecate('route-b')(makeReq('GET', '/b'), makeRes().res, next);
    expect(mockLogger.warn).toHaveBeenCalledTimes(2);

    resetDeprecationLog();
    deprecate('route-a')(makeReq('GET', '/a'), makeRes().res, next);
    expect(mockLogger.warn).toHaveBeenCalledTimes(3);
  });
});

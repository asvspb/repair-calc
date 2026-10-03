/**
 * Middleware депрекейшна устаревших эндпоинтов (§15.3.2 ТЗ v1.1).
 *
 * Ставит HTTP-заголовки по RFC 8594:
 *   Deprecation: true        — версия "true" (без даты вывода из эксплуатации);
 *   Sunset: <дата>           — только если передан sunset.
 *
 * Плюс winston-лог WARN — один раз на маршрут (не на каждый запрос):
 * простой Set уже отлогированных маршрутов. Без PII: только маршрут/метод/путь.
 *
 * Регистрация на прод-маршруте — отдельное решение архитектора: в коде сейчас
 * нет эндпоинта, помеченного устаревшим; middleware экспортируется и покрыт
 * тестами, к маршрутам не прицеплен (см. devAI/spec/TASK-BATCH-005).
 */

import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { winstonLogger } from './logger.js';

const loggedRoutes = new Set<string>();

/**
 * Фабрика middleware депрекейшна.
 *
 * @param routeName — человекочитаемый идентификатор маршрута (ключ для
 *   «логировать один раз на маршрут», попадает в лог).
 * @param sunset — необязательная дата вывода из эксплуатации (значение
 *   HTTP-заголовка Sunset, например 'Sat, 01 Jun 2026 00:00:00 GMT').
 */
export function deprecate(routeName: string, sunset?: string): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Deprecation', 'true');
    if (sunset !== undefined) {
      res.setHeader('Sunset', sunset);
    }

    if (!loggedRoutes.has(routeName)) {
      loggedRoutes.add(routeName);
      winstonLogger.warn('[DEPRECATION] Request to deprecated endpoint', {
        route: routeName,
        method: req.method,
        path: req.path,
      });
    }

    next();
  };
}

/** Тестовая утилита: сброс реестра «уже отлогированных» маршрутов. */
export function resetDeprecationLog(): void {
  loggedRoutes.clear();
}

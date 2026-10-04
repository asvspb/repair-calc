/**
 * Repository для A/B тестирования парсеров.
 *
 * Реализация разнесена по внутренней связности:
 *  - abTest.types.ts — типы;
 *  - abTest.read.ts  — чтение (поиск, результаты, статистика);
 *  - abTest.write.ts — запись (CRUD, статусы, счётчики).
 *
 * Методы собираются в один объект: `this` в методах указывает на него,
 * как и в исходном монолитном литерале. Публичный контракт не изменён.
 */

import { abTestReadMethods } from './abTest.read.js';
import { abTestWriteMethods } from './abTest.write.js';

export * from './abTest.types.js';

export const ABTestRepository = {
  ...abTestReadMethods,
  ...abTestWriteMethods,
};

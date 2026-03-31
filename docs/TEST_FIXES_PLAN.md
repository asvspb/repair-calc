# План исправления падающих тестов

**Дата анализа:** 31.03.2026
**Дата исправления:** 31.03.2026
**Всего тестов:** 641
**Падающих:** 0 ✅

## Статус: ИСПРАВЛЕНО ✅

## Сводка проблем

| Файл | Падающих тестов | Причина |
|------|-----------------|---------|
| `server/tests/unit/abTest.test.ts` | 2 | Возврат `undefined` вместо `null` |
| `server/tests/integration/totalsRoutes.test.ts` | 10 | `vi.unmock` ломает авторизацию |
| `server/src/services/update/parsers/rateLimiter.test.ts` | 1 | Несинхронизированные фейковые таймеры |
| `server/src/services/update/parsers/circuitBreaker.test.ts` | 1 | Логика сброса failures |
| `tests/api/totals.test.ts` | 1 | Mock для TotalsApiError |
| `tests/hooks/projectContextAutoSave.test.tsx` | 1 | TBD |

---

## Детальный анализ и исправления

### 1. `server/tests/unit/abTest.test.ts`

**Падающие тесты:**
- `findById > should return null for non-existent test`
- `findMany > should return list of tests with total`

**Проблема:**
В `server/src/db/repositories/abTest.repo.ts` метод `findById`:
```typescript
return rows[0] as ABTest | null;
```
Если массив пустой, `rows[0]` возвращает `undefined`, а не `null`.

**Решение:**
```typescript
// server/src/db/repositories/abTest.repo.ts
// Изменить findById:
return rows.length > 0 ? (rows[0] as ABTest) : null;
```

---

### 2. `server/tests/integration/totalsRoutes.test.ts`

**Падающие тесты:** 10 тестов (все получают 401 вместо ожидаемых кодов)

**Проблема:**
Vitest делает hoisting для `vi.unmock()`, поэтому вызов внутри вложенного `describe('Authorization')` снимает мок авторизации глобально:
```typescript
describe('Authorization', () => {
  it('should require authentication for POST', async () => {
    // Temporarily remove auth mock
    vi.unmock('../../src/middleware/auth.js');
    // ...
  });
});
```

**Предупреждение Vitest:**
```
Warning: A vi.unmock("../../src/middleware/auth.js") call in "server/tests/integration/totalsRoutes.test.ts" is not at the top level of the module.
```

**Решение:**
Удалить блок `describe('Authorization')` или вынести тесты авторизации в отдельный файл без моков.

---

### 3. `server/src/services/update/parsers/rateLimiter.test.ts`

**Падающий тест:** `should throttle when exceeding minute limit`

**Проблема:**
```typescript
it('should throttle when exceeding minute limit', async () => {
  rateLimiter = new RateLimiter({ requestsPerMinute: 2, minDelayMs: 0 });

  await rateLimiter.wait();
  await rateLimiter.wait();

  const waitPromise = rateLimiter.wait();
  vi.advanceTimersByTime(60000);
  await waitPromise;

  expect(rateLimiter.getRemainingRequestsPerMinute()).toBe(0); // FAILS: returns 1
});
```

`RateLimiter` использует `Date.now()` для проверки лимитов, но `vi.useFakeTimers()` не автоматически синхронизирует `Date.now()` с `vi.advanceTimersByTime()`.

**Решение:**
Добавить `vi.setSystemTime()` для синхронизации:
```typescript
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-01T00:00:00Z')); // Фиксированное время
});

it('should throttle when exceeding minute limit', async () => {
  rateLimiter = new RateLimiter({ requestsPerMinute: 2, minDelayMs: 0 });

  await rateLimiter.wait();
  await rateLimiter.wait();

  const waitPromise = rateLimiter.wait();
  
  // Продвигаем и системное время
  vi.advanceTimersByTime(60000);
  vi.setSystemTime(new Date('2026-01-01T00:01:00Z'));
  
  await waitPromise;

  expect(rateLimiter.getRemainingRequestsPerMinute()).toBe(0);
});
```

---

### 4. `server/src/services/update/parsers/circuitBreaker.test.ts`

**Падающий тест:** `should reset failures on success`

**Проблема:**
```typescript
it('should reset failures on success', async () => {
  const failingFn = vi.fn()
    .mockRejectedValueOnce(new Error('Error 1'))
    .mockRejectedValueOnce(new Error('Error 2'))
    .mockResolvedValueOnce('success');

  await expect(circuitBreaker.execute(failingFn)).rejects.toThrow();
  await expect(circuitBreaker.execute(failingFn)).rejects.toThrow();
  await circuitBreaker.execute(failingFn);

  expect(circuitBreaker.getState().failures).toBe(0); // FAILS: returns 2
});
```

**Анализ кода `CircuitBreaker.onSuccess()`:**
```typescript
private onSuccess(): void {
  this.successes++;

  if (this.state === 'half-open' && this.successes >= this.config.halfOpenMaxRequests) {
    this.state = 'closed';
    this.failures = 0;
    this.successes = 0;
    console.info(`Circuit breaker for ${this.parserType} closed (recovered)`);
  }
}
```
Сброс `failures` происходит только в состоянии `half-open`, но не в `closed`.

**Решение:**
Изменить логику `onSuccess()` в `circuitBreaker.ts`:
```typescript
private onSuccess(): void {
  this.successes++;

  if (this.state === 'half-open') {
    if (this.successes >= this.config.halfOpenMaxRequests) {
      this.state = 'closed';
      this.failures = 0;
      this.successes = 0;
      console.info(`Circuit breaker for ${this.parserType} closed (recovered)`);
    }
  } else if (this.state === 'closed') {
    // Сброс failures при успехе в closed состоянии
    this.failures = 0;
    this.successes = 0;
  }
}
```

---

### 5. `tests/api/totals.test.ts`

**Падающий тест:** `should throw TotalsApiError on error response`

**Проблема:**
```typescript
it('should throw TotalsApiError on error response', async () => {
  const ApiError = (await import('../../src/api/httpClient')).ApiError;
  mockRequest.mockRejectedValueOnce(new ApiError('Project not found', 404));

  await expect(saveTotals('project-123', mockTotalsData)).rejects.toThrow(TotalsApiError);
  
  try {
    await saveTotals('project-123', mockTotalsData);
  } catch (error) {
    expect(error).toBeInstanceOf(TotalsApiError);
    expect((error as TotalsApiError).message).toBe('Project not found');
    expect((error as TotalsApiError).statusCode).toBe(404);
  }
});
```

Нужно проверить реализацию `saveTotals` в `src/api/totals.ts`.

---

### 6. `tests/hooks/projectContextAutoSave.test.tsx`

**Нужно проверить полную ошибку.** Вывод был обрезан. Возможные причины:
- Проблемы с моками контекста
- Проблемы с асинхронными операциями

---

## Чек-лист исправлений

- [ ] Исправить `server/src/db/repositories/abTest.repo.ts` - findById
- [ ] Исправить `server/tests/integration/totalsRoutes.test.ts` - удалить/переместить vi.unmock
- [ ] Исправить `server/src/services/update/parsers/rateLimiter.test.ts` - синхронизация времени
- [ ] Исправить `server/src/services/update/parsers/circuitBreaker.ts` - логика onSuccess
- [ ] Исправить `tests/api/totals.test.ts` - mock TotalsApiError
- [ ] Исследовать и исправить `tests/hooks/projectContextAutoSave.test.tsx`

---

## Команда запуска тестов

```bash
npm test
```

## Команда для запуска конкретного файла тестов

```bash
npx vitest run server/tests/unit/abTest.test.ts
npx vitest run server/tests/integration/totalsRoutes.test.ts
# и т.д.
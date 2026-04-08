# Техническое задание: Исправление обновления токена авторизации

## Дата: 08.04.2026

## Статус: ✅ Реализовано (08.04.2026)

---

## 1. Описание проблемы

При истечении access токена (через 15 минут бездействия) система не может корректно обновить токен, что приводит к ошибкам 401 Unauthorized и потере доступа к API.

### Симптомы

1. После ~15 минут бездействия запросы к API возвращают 401
2. Попытка обновления токена "успешна" (лог показывает "Токен успешно обновлён")
3. Повторный запрос всё равно возвращает 401
4. В консоли видно множественные попытки refresh с ошибками 400/401

### Пример из логов

```
📋 [15:38:26.804] [API] → GET /api/sync/pull
:3994/api/sync/pull:1  Failed to load resource: 401 (Unauthorized)
🔍 [15:38:26.825] [HTTPClient] Попытка обновления токена
🔍 [15:38:26.832] [HTTPClient] Токен успешно обновлён
🔍 [15:38:26.832] [HTTPClient] Повторный запрос с новым токеном
:3994/api/sync/pull:1  Failed to load resource: 401 (Unauthorized)
```

---

## 2. Корневая причина

### Несоответствие формата ответа сервера и ожиданий клиента

#### Сервер (`server/src/routes/auth.ts`, строки 91-94)

```typescript
res.json({
  status: 'success',
  data: tokens,  // tokens = { token: string, refreshToken: string }
});
```

**Фактический ответ сервера:**
```json
{
  "status": "success",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

#### Клиент (`src/api/httpClient.ts`, строки 99-102)

```typescript
if (refreshResponse.ok) {
  const refreshData = await refreshResponse.json();
  localStorage.setItem('token', refreshData.token);        // undefined!
  localStorage.setItem('refreshToken', refreshData.refreshToken);  // undefined!
  logDebug('HTTPClient', 'Токен успешно обновлён');
  return true;
}
```

**Клиент ожидает:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

### Результат

- `refreshData.token` = `undefined`
- `refreshData.refreshToken` = `undefined`
- В localStorage сохраняется `undefined`, но старый токен НЕ заменяется
- Заголовок `Authorization` остаётся с истёкшим токеном
- Все последующие запросы возвращают 401

---

## 3. Решение

### Изменить `src/api/httpClient.ts` (строки 99-103)

**Было:**
```typescript
if (refreshResponse.ok) {
  const refreshData = await refreshResponse.json();
  localStorage.setItem('token', refreshData.token);
  localStorage.setItem('refreshToken', refreshData.refreshToken);
  logDebug('HTTPClient', 'Токен успешно обновлён');
  return true;
}
```

**Станет:**
```typescript
if (refreshResponse.ok) {
  const refreshData = await refreshResponse.json();
  // Сервер возвращает { status: 'success', data: { token, refreshToken } }
  const tokens = refreshData.data || refreshData;
  localStorage.setItem('token', tokens.token);
  localStorage.setItem('refreshToken', tokens.refreshToken);
  logDebug('HTTPClient', 'Токен успешно обновлён');
  return true;
}
```

### Резервный вариант

Использовать `refreshData.data?.token || refreshData.token` для обратной совместимости:

```typescript
localStorage.setItem('token', refreshData.data?.token || refreshData.token);
localStorage.setItem('refreshToken', refreshData.data?.refreshToken || refreshData.refreshToken);
```

---

## 4. Затронутые файлы

| Файл | Изменение |
|------|-----------|
| `src/api/httpClient.ts` | Исправить извлечение токенов из ответа сервера |

---

## 5. Тестирование

### Шаги воспроизведения

1. Войти в систему
2. Подождать 15 минут (или изменить `expiresIn` на короткое время для теста)
3. Выполнить любое действие, требующее API запрос
4. Проверить, что токен успешно обновился и запрос выполнен

### Ожидаемый результат

- При 401 автоматически вызывается refresh
- Токены корректно сохраняются в localStorage
- Повторный запрос выполняется успешно с новым токеном

### Тест-кейсы

1. **Автообновление токена при 401**
   - Условие: access токен истёк, refresh токен валиден
   - Ожидание: автоматическое обновление и успешный повторный запрос

2. **Истёкший refresh токен**
   - Условие: оба токена истекли (7 дней бездействия)
   - Ожидание: редирект на страницу входа

3. **Параллельные запросы при истёкшем токене**
   - Условие: несколько одновременных запросов возвращают 401
   - Ожидание: только один refresh, остальные запросы ждут

---

## 6. Дополнительные улучшения (опционально)

### Добавить проверку на undefined

```typescript
if (tokens.token && tokens.refreshToken) {
  localStorage.setItem('token', tokens.token);
  localStorage.setItem('refreshToken', tokens.refreshToken);
  logDebug('HTTPClient', 'Токен успешно обновлён');
  return true;
} else {
  logDebug('HTTPClient', 'Некорректный ответ сервера при обновлении токена');
  return false;
}
```

### Унифицировать формат ответа на сервере

Рассмотреть возможность возврата токенов напрямую без обёртки `{ status, data }` для endpoint `/api/auth/refresh`:

```typescript
res.json(tokens);  // вместо res.json({ status: 'success', data: tokens })
```

---

## 7. Приоритет

**Высокий** — критическая ошибка, приводящая к невозможности работы с приложением после 15 минут бездействия.
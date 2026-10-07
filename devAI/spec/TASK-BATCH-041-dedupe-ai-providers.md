# TASK-BATCH-041-dedupe-ai-providers

**Назначено:** coder **Подветка:** общая ветка refactor/monolith-splits-b2 (отдельный коммит)
**Зависит от:** TASK-BATCH-040 **Статус:** ✅

## Цель (проверяемая)

Дедупликация близнецов-провайдеров: 9 побайтово идентичных методов (архитектор
проверил идентичность сравнением) выносятся в общие модули —
`server/src/services/ai/prompts.ts` (buildEstimatePrompt, buildSuggestMaterialsPrompt,
buildGenerateTemplatePrompt) и `server/src/services/ai/responseParsers.ts`
(parseEstimateResponse, parseSuggestMaterialsResponse, parseGenerateTemplateResponse,
parseWorks, parseMaterials, parseTools). Оба провайдера ≤400 строк. Публичный API
классов и `services/ai/index.ts` не меняются.

## Read / Write (write — ЭКСКЛЮЗИВНО)

**Read:** оба провайдера, `server/src/services/ai/types.ts`, `server/src/services/ai/index.ts`, PLAN (B2).

**Write:**

- `server/src/services/ai/prompts.ts` (новый)
- `server/src/services/ai/responseParsers.ts` (новый)
- `server/src/services/ai/geminiProvider.ts` (худеет)
- `server/src/services/ai/mistralProvider.ts` (худеет)

## Алгоритм (псевдокод)

```
prompts.ts / responseParsers.ts: методы становятся экспортируемыми чистыми
функциями; ТЕЛА переносятся байт-в-байт, только: удалить модификаторы
private/async где не нужно, заменить вызовы this.parseX(...) на импортированные
функции, типы параметров/возврата — те же.
Провайдеры: приватные методы-двойники УДАЛЯЮТСЯ, вызовы переключаются на
импорты. Специфичные методы (makeRequest, extractText, parseJsonFromText,
validateConfidence, isAvailable, 4 публичных AIProvider-метода, getApiKey,
singleton-функции) остаются в классах как есть.
ВНИМАНИЕ: parseEstimateResponse и парсеры могут вызывать this.validateConfidence
(различается между провайдерами!) — проверь: если да, передавай результат
валидации параметром ИЛИ оставь такие методы в классах (не выдёргивай
принудительно). Общие — только те, чьи тела полностью идентичны.
```

**Edge-кейсы:** различия validateConfidence/extractText между провайдерами — не
усреднять, не «улучшать»; циклические импорты prompts↔responseParsers↔types
не допускать (обе новых зависимости только от types.ts и, при необходимости,
друг от друга однонаправленно).

**Логирование:** существующие вызовы не менять.

## Запреты

- НЕ менять поведение/строки промптов/форматы парсинга; НЕ трогать index.ts,
  роуты, env-логику, ключи; НЕ создавать новых зависимостей; файлы ≤400 строк.

## DoD

- [ ] gates зелёные; tsc доказывает совместимость типов
- [ ] дифф показывает: удалённые тела === перенесённые тела (ревью архитектора)
- [ ] оба провайдера ≤400 строк; developer_log дописан

## Эскалация: неоднозначность → к архитектору; 2 провала gate → к человеку

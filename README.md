<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Repair Calculator - Калькулятор ремонта

Приложение для расчета стоимости ремонтных работ.

## Особенности

- 💾 **Автосохранение** - данные сохраняются автоматически в localStorage
- 📤 **Экспорт/Импорт** - бэкап и восстановление через JSON
- 📊 **Excel-экспорт** - выгрузка смет в CSV для Excel
- 🐳 **Docker** - готовые конфигурации для dev и prod
- 📱 **Адаптивный дизайн** - работает на мобильных и десктопе

## Run Locally

**Prerequisites:** Node.js 18+

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key

3. Run the app:
   ```bash
   npm run dev
   ```

4. Open http://localhost:3993

## Локальный запуск в Docker

**Предварительные требования:** Docker и Docker Compose

### Запуск dev-режима

```bash
docker compose --profile dev up --build
```

- Открыть http://localhost:3993
- Горячая перезагрузка включена
- Исходный код монтируется с хоста

### Остановка dev-режима

```bash
docker compose --profile dev down
```

### Запуск prod-режима

```bash
docker compose --profile prod up --build -d
```

- Открыть http://localhost:8080
- Оптимизированная production-сборка через nginx

### Остановка prod-режима

```bash
docker compose --profile prod down
```

### Именованные Docker-тома

| Том | Назначение |
|-----|------------|
| `repair-calc-node-modules` | node_modules для dev-режима |
| `repair-calc-logs` | Логи nginx |
| `repair-calc-cache` | Кэш nginx |
| `repair-calc-backups` | Директория для бэкапов |

## ⚠️ Правила внесения изменений

**ВАЖНО: При любом внесении изменений в проект необходимо строго следовать этим правилам:**

### 1. Остановка и удаление всех копий приложения

Перед любыми изменениями необходимо полностью остановить и удалить все запущенные контейнеры:

```bash
# Остановить и удалить все контейнеры проекта
docker compose --profile dev down
docker compose --profile prod down

# Убедиться, что нет запущенных контейнеров
docker ps | grep repair-calc

# При необходимости - удалить все контейнеры принудительно
docker rm -f $(docker ps -aq --filter "name=repair-calc") 2>/dev/null || true
```

### 2. Полная пересборка в Docker с нуля

```bash
# Удалить старые образы и пересобрать
docker compose --profile dev down --rmi local -v
docker compose --profile dev up --build

# Или полная очистка и пересборка (рекомендуется)
docker compose --profile dev down --rmi all --volumes --remove-orphans
docker compose --profile dev up --build
```

### 3. Порт приложения

**Приложение работает ТОЛЬКО на порту 3993**

- Dev-режим: http://localhost:3993
- При запуске проверять, что порт 3993 свободен:
  ```bash
  lsof -i :3993
  # или
  netstat -tlnp | grep 3993
  ```

### 4. Тестирование и проверка логов

После каждого изменения:

```bash
# 1. Запустить тесты
npm test

# 2. Проверить логи сервера на ошибки
docker logs repair-calc-dev 2>&1 | grep -i error
docker logs repair-calc-dev 2>&1 | grep -i warn

# 3. Просмотр логов в реальном времени
docker logs -f repair-calc-dev

# 4. Проверить, что приложение отвечает
curl -I http://localhost:3993
```

### Краткий чек-лист для каждого изменения

- [ ] Остановлены все контейнеры на всех портах
- [ ] Удалены старые контейнеры и образы
- [ ] Приложение пересобрано в Docker с нуля
- [ ] Приложение запущено на порту 3993
- [ ] Пройдены все тесты
- [ ] Проверены логи сервера на ошибки и предупреждения
- [ ] Функциональность проверена в браузере

---

## Управление данными

### Автосохранение
- Данные автоматически сохраняются в localStorage браузера
- Сохранение происходит через 1 секунду после последнего изменения
- При закрытии страницы данные также сохраняются

### Бэкап и восстановление

#### Через UI приложения
1. Нажмите кнопку **"Данные"** в правом верхнем углу
2. Выберите **"Сохранить бэкап (JSON)"** для экспорта
3. Выберите **"Загрузить бэкап (JSON)"** для импорта

#### Экспорт в Excel
- В разделе "Данные" выберите **"Экспорт в Excel (CSV)"**
- Файл CSV можно открыть в Excel или Google Sheets

#### Через скрипты (для Docker)

**Создание бэкапа:**
```bash
./scripts/backup.sh
```

**Восстановление:**
```bash
./scripts/restore.sh backups/repair-calc-backup-20240115-120000.json
```

### Перенос на другой компьютер

1. **Экспортируйте данные** через UI приложения (JSON)
2. **Скопируйте файл** на новый компьютер
3. **Импортируйте данные** через UI на новом компьютере

### Очистка данных
- В разделе "Данные" → "Опасная зона" → "Очистить все данные"
- Или через DevTools браузера: `localStorage.clear()`

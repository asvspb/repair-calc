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

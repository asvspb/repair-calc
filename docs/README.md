# 📚 Документация Repair Calculator

## 🔧 Руководства

| Документ | Описание |
|----------|----------|
| [📋 Логирование](./LOGGING.md) | Полное руководство по логированию сервера |
| [⚡ Шпаргалка по логам](./LOGGING-CHEATSHEET.md) | Быстрый доступ к логам и командам |
| [📡 API](./API.md) | Документация REST API |
| [🗄️ База данных](./DATABASE.md) | Схема базы данных и миграции |
| [🐛 Отладка](./TROUBLESHOOTING.md) | Решение типичных проблем |

---

## 🚀 Быстрый старт

### Просмотр логов

```bash
# Последние 100 строк
docker logs repair-calc-backend --tail 100

# Следить в реальном времени
docker logs repair-calc-backend -f

# Полный дамп
docker logs repair-calc-backend --tail 1000
```

### Проверка состояния

```bash
# Здоровье сервера
curl http://localhost:3994/api/health

# Здоровье фронтенда
curl http://localhost:3993/api/health
```

---

## 📁 Структура документации

```
docs/
├── README.md                      # Этот файл
├── LOGGING.md                     # Руководство по логированию
├── LOGGING-CHEATSHEET.md          # Шпаргалка по логам
├── API.md                         # API документация
├── DATABASE.md                    # Схема БД
└── TROUBLESHOOTING.md             # Отладка
```

---

## 🔗 Связанные документы

- [Главный README](../README.md)
- [Индекс для AI-агентов](../INDEX.md)
- [Правила разработки](../CONTRIBUTING.md)

---

**Версия:** 1.0  
**Обновлено:** 2026-03-31

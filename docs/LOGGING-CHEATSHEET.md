# 📋 Шпаргалка по логированию

## Быстрый доступ к логам

```bash
# Последние 100 строк логов
docker logs repair-calc-backend --tail 100

# Следить в реальном времени
docker logs repair-calc-backend -f

# Найти конкретный проект
docker logs repair-calc-backend 2>&1 | grep "da07594f-"

# Полный дамп (1000 строк)
docker logs repair-calc-backend --tail 1000
```

---

## События для отслеживания

| Событие | Искать в логах |
|---------|---------------|
| Загрузка проектов | `SYNC/PULL` |
| Создание проекта | `POST /projects` |
| Обновление с комнатами | `PUT /projects/:id/with-rooms` |
| Удаление проекта | `DELETE /projects` |
| Ошибка авторизации | `401` или `Invalid or expired token` |
| Конфликт версий | `Конфликт версий` |

---

## Формат данных в логах

### Проект
```
📁 ПРОЕКТ: "Название"
   ID: uuid
   Город: Город
   Комнат: N
   Общая площадь: XX м²
```

### Комната
```
🏠 "Название"
   ID: uuid
   Размеры: L×W×H
   Площадь: XX м²
   Работ: N
   Стоимость: XXXX руб.
```

---

## Типичные проблемы

### ❌ Токен истёк
```
Error: AppError: Invalid or expired token
```
**Решение:** Автоматически обновляется через `/api/auth/refresh`

### ❌ Проект не найден
```
⚠️ Проект не найден: uuid
```
**Причина:** Удалён или неверный ID

### ❌ Конфликт версий
```
⚠️ Конфликт версий (клиент: N, сервер: N)
```
**Решение:** Обновить данные с сервера

---

## Примеры

### 1. Проверить состояние проектов
```bash
docker logs repair-calc-backend --tail 100
```

### 2. Найти все операции с проектом
```bash
docker logs repair-calc-backend 2>&1 | grep "da07594f-"
```

### 3. Найти ошибки
```bash
docker logs repair-calc-backend 2>&1 | grep -E "(❌|Error|401|500)"
```

### 4. Посмотреть детали синхронизации
```bash
docker logs repair-calc-backend 2>&1 | grep "SYNC/PULL" -A 20
```

---

## Ссылки

- 📖 [Полная документация](./LOGGING.md)
- 📡 [API Documentation](./API.md)
- 🐛 [Troubleshooting](./TROUBLESHOOTING.md)

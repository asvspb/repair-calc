#!/bin/bash

# Скрипт для создания бэкапа данных из Docker volume
# Использование: ./scripts/backup.sh [имя_файла]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$PROJECT_DIR/backups"
CONTAINER_NAME="repair-calc-prod"
VOLUME_NAME="repair-calc-backups"

# Создаем директорию для бэкапов если не существует
mkdir -p "$BACKUP_DIR"

# Генерируем имя файла если не указано
if [ -z "$1" ]; then
    BACKUP_FILE="repair-calc-backup-$(date +%Y%m%d-%H%M%S).json"
else
    BACKUP_FILE="$1"
fi

BACKUP_PATH="$BACKUP_DIR/$BACKUP_FILE"

echo "🔧 Repair Calculator - Backup Script"
echo "===================================="
echo ""

# Проверяем запущен ли контейнер
if ! docker ps --format "table {{.Names}}" | grep -q "^${CONTAINER_NAME}$"; then
    echo "❌ Контейнер $CONTAINER_NAME не запущен"
    echo "💡 Запустите приложение: docker compose --profile prod up -d"
    exit 1
fi

echo "📦 Контейнер найден: $CONTAINER_NAME"
echo "💾 Создание бэкапа: $BACKUP_FILE"
echo ""

# Создаем временный контейнер для доступа к volume
docker run --rm \
    --volumes-from "$CONTAINER_NAME" \
    -v "$BACKUP_DIR:/host-backup" \
    alpine:latest \
    sh -c "cp -r /app/backups/* /host-backup/ 2>/dev/null || echo 'No existing backups in container'"

# Экспортируем localStorage через браузер (требуется дополнительная настройка)
echo "⚠️  Важно: localStorage хранится в браузере пользователя"
echo "📋 Для полного бэкапа используйте UI приложения:"
echo "   1. Откройте приложение в браузере"
echo "   2. Нажмите кнопку 'Данные' в правом верхнем углу"
echo "   3. Выберите 'Сохранить бэкап (JSON)'"
echo ""

# Создаем метаданные бэкапа
cat > "$BACKUP_PATH.meta" << EOF
Backup created: $(date -Iseconds)
Container: $CONTAINER_NAME
Volume: $VOLUME_NAME
Method: Docker volume backup
Note: localStorage data must be exported via browser UI
EOF

echo "✅ Метаданные бэкапа сохранены: $BACKUP_FILE.meta"
echo ""
echo "📁 Бэкапы находятся в: $BACKUP_DIR"
echo ""
ls -la "$BACKUP_DIR"

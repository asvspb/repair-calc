#!/bin/bash

# Скрипт для восстановления данных из бэкапа
# Использование: ./scripts/restore.sh <путь_к_файлу_бэкапа>

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
CONTAINER_NAME="repair-calc-prod"

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔧 Repair Calculator - Restore Script${NC}"
echo "======================================"
echo ""

# Проверяем аргументы
if [ -z "$1" ]; then
    echo -e "${RED}❌ Ошибка: Не указан файл бэкапа${NC}"
    echo ""
    echo "Использование:"
    echo "  ./scripts/restore.sh <путь_к_файлу_бэкапа>"
    echo ""
    echo "Примеры:"
    echo "  ./scripts/restore.sh backups/repair-calc-backup-20240115-120000.json"
    echo "  ./scripts/restore.sh /home/user/Downloads/my-backup.json"
    echo ""
    
    # Показываем доступные бэкапы
    if [ -d "$PROJECT_DIR/backups" ]; then
        echo "Доступные бэкапы:"
        ls -1t "$PROJECT_DIR/backups"/*.json 2>/dev/null | head -10 | while read file; do
            echo "  - $(basename "$file")"
        done
    fi
    
    exit 1
fi

BACKUP_FILE="$1"

# Проверяем существование файла
if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}❌ Ошибка: Файл не найден: $BACKUP_FILE${NC}"
    exit 1
fi

echo -e "📁 Файл бэкапа: ${YELLOW}$BACKUP_FILE${NC}"
echo ""

# Проверяем валидность JSON
if ! jq empty "$BACKUP_FILE" 2>/dev/null; then
    echo -e "${RED}❌ Ошибка: Файл не является валидным JSON${NC}"
    exit 1
fi

# Проверяем структуру бэкапа
if ! jq -e '.projects' "$BACKUP_FILE" > /dev/null 2>&1; then
    echo -e "${RED}❌ Ошибка: Неверная структура бэкапа (отсутствует поле 'projects')${NC}"
    exit 1
fi

PROJECTS_COUNT=$(jq '.projects | length' "$BACKUP_FILE")
echo -e "${GREEN}✅ Файл валиден${NC}"
echo "📊 Проектов в бэкапе: $PROJECTS_COUNT"
echo ""

# Проверяем запущен ли контейнер
if docker ps --format "table {{.Names}}" | grep -q "^${CONTAINER_NAME}$"; then
    echo -e "${YELLOW}⚠️  Контейнер $CONTAINER_NAME запущен${NC}"
    echo "💡 Данные будут доступны через UI приложения"
    echo ""
fi

# Копируем файл в директорию бэкапов
BACKUP_DIR="$PROJECT_DIR/backups"
mkdir -p "$BACKUP_DIR"

BACKUP_FILENAME=$(basename "$BACKUP_FILE")
DEST_FILE="$BACKUP_DIR/$BACKUP_FILENAME"

# Копируем если файл не уже в директории бэкапов
if [ "$BACKUP_FILE" != "$DEST_FILE" ]; then
    cp "$BACKUP_FILE" "$DEST_FILE"
    echo -e "${GREEN}✅ Бэкап скопирован в: $DEST_FILE${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Восстановление завершено!${NC}"
echo ""
echo "Следующие шаги:"
echo "1. Откройте приложение в браузере"
echo "2. Нажмите кнопку 'Данные' в правом верхнем углу"
echo "3. Выберите 'Загрузить бэкап (JSON)'"
echo "4. Выберите файл: $BACKUP_FILENAME"
echo ""
echo "Или перезапустите контейнер с монтированием бэкапа:"
echo "  docker compose --profile prod restart"

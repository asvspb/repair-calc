#!/bin/bash

# Скрипт для полного сброса и пересборки приложения repair-calc
# Порт приложения: 3993

set -e

PORT=3993
APP_NAME="repair-calc"
NETWORK_NAME="repair-calc-network"

echo "=========================================="
echo "  REPAIR-CALC REBUILD SCRIPT"
echo "  Target port: $PORT"
echo "=========================================="

# Функция для проверки портов рядом с целевым
check_nearby_ports() {
    echo ""
    echo "[1/5] Проверка портов около $PORT..."
    
    local ports_to_check="3990 3991 3992 3993 3994 3995 3996 3997 3998 3999"
    local found_processes=""
    
    for p in $ports_to_check; do
        # Проверяем процессы слушающие на порту
        local proc=$(lsof -i :$p 2>/dev/null | grep LISTEN || true)
        if [ -n "$proc" ]; then
            found_processes="$found_processes\nPort $p:\n$proc"
        fi
    done
    
    if [ -n "$found_processes" ]; then
        echo "Найдены процессы на портах:"
        echo -e "$found_processes"
    else
        echo "Порты 3990-3999 свободны."
    fi
}

# Функция для остановки и удаления Docker контейнеров
cleanup_docker() {
    echo ""
    echo "[2/5] Очистка Docker контейнеров и образов..."
    
    # Останавливаем и удаляем контейнеры приложения
    echo "  -> Остановка контейнеров..."
    docker stop repair-calc-dev repair-calc-prod 2>/dev/null || true
    
    echo "  -> Удаление контейнеров..."
    docker rm repair-calc-dev repair-calc-prod 2>/dev/null || true
    
    # Удаляем образы приложения
    echo "  -> Удаление образов..."
    local images=$(docker images --format '{{.Repository}}:{{.Tag}}' | grep -E "^repair-calc|^${APP_NAME}" || true)
    if [ -n "$images" ]; then
        echo "$images" | xargs -r docker rmi -f
        echo "  -> Образы удалены."
    else
        echo "  -> Образы не найдены."
    fi
    
    # Удаляем висячие (dangling) образы
    echo "  -> Удаление висячих образов..."
    docker image prune -f 2>/dev/null || true
    
    # Удаляем тома приложения
    echo "  -> Удаление томов..."
    docker volume rm repair-calc-node-modules repair-calc-logs repair-calc-cache repair-calc-backups 2>/dev/null || true
    
    # Удаляем сеть
    echo "  -> Удаление сети..."
    docker network rm $NETWORK_NAME 2>/dev/null || true
    
    echo "  -> Docker очистка завершена."
}

# Функция для очистки локальных файлов
cleanup_local() {
    echo ""
    echo "[3/5] Очистка локальных файлов..."
    
    # Удаляем node_modules и dist
    if [ -d "node_modules" ]; then
        echo "  -> Удаление node_modules..."
        rm -rf node_modules
    fi
    
    if [ -d "dist" ]; then
        echo "  -> Удаление dist..."
        rm -rf dist
    fi
    
    echo "  -> Локальные файлы очищены."
}

# Функция для сборки приложения
build_app() {
    echo ""
    echo "[4/5] Сборка приложения..."
    
    echo "  -> Установка зависимостей..."
    npm install
    
    echo "  -> Проверка сборки..."
    npm run build
    
    echo "  -> Сборка завершена."
}

# Функция для запуска приложения
start_app() {
    echo ""
    echo "[5/5] Запуск приложения..."
    
    echo ""
    echo "Выберите режим запуска:"
    echo "  1) Dev режим (Docker) - с горячей перезагрузкой"
    echo "  2) Prod режим (Docker) - production сборка"
    echo "  3) Выход без запуска"
    echo ""
    read -p "Введите номер [1-3]: " choice
    
    case $choice in
        1)
            echo ""
            echo "Запуск в Dev режиме (Docker) на порту $PORT..."
            docker-compose --profile dev up --build
            ;;
        2)
            echo ""
            echo "Запуск в Prod режиме (Docker) на порту $PORT..."
            docker-compose --profile prod up --build -d
            echo ""
            echo "Приложение запущено на http://localhost:$PORT"
            echo ""
            echo "Для просмотра логов: docker logs -f repair-calc-prod"
            echo "Для остановки: docker-compose --profile prod down"
            ;;
        3)
            echo ""
            echo "Готово! Приложение собрано."
            echo ""
            echo "Для запуска:"
            echo "  docker-compose --profile dev up    - для разработки"
            echo "  docker-compose --profile prod up -d - для production"
            ;;
        *)
            echo "Неверный выбор. Запуск dev режима (Docker)..."
            docker-compose --profile dev up --build
            ;;
    esac
}

# Основной процесс
main() {
    check_nearby_ports
    cleanup_docker
    cleanup_local
    build_app
    start_app
}

# Запуск
main
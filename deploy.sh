#!/bin/bash

# Скрипт для деплоя на сервер
# Использование: ./deploy.sh

set -e  # Остановка при ошибке

echo "🚀 Начинаем деплой..."

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Переменные (настройте под ваш сервер)
REPO_URL="https://github.com/IV-YADOV/vlesser.git"
PROJECT_DIR="/path/to/vpn_bot"  # Измените на путь к проекту на сервере
BRANCH="master"

echo -e "${YELLOW}📥 Обновление кода из GitHub...${NC}"
cd "$PROJECT_DIR"

# Если директория не существует, клонируем репозиторий
if [ ! -d ".git" ]; then
    echo "Клонирование репозитория..."
    cd ..
    rm -rf "$(basename $PROJECT_DIR)"
    git clone $REPO_URL "$(basename $PROJECT_DIR)"
    cd "$PROJECT_DIR"
else
    # Если репозиторий уже существует, просто обновляем
    git pull origin $BRANCH
fi

echo -e "${YELLOW}📦 Установка зависимостей Node.js...${NC}"
npm install --production

echo -e "${YELLOW}🐍 Установка зависимостей Python...${NC}"
pip install -r requirements.txt

echo -e "${YELLOW}🏗️  Сборка Next.js приложения...${NC}"
npm run build

echo -e "${YELLOW}🔄 Перезапуск сервисов...${NC}"

# Перезапуск Python сервиса (если используется systemd)
if systemctl is-active --quiet xray-service; then
    echo "Перезапуск xray-service..."
    sudo systemctl restart xray-service
else
    echo "⚠️  xray-service не запущен через systemd"
fi

# Перезапуск Telegram бота (если используется PM2)
if command -v pm2 &> /dev/null; then
    if pm2 list | grep -q "telegram-bot"; then
        echo "Перезапуск telegram-bot..."
        pm2 restart telegram-bot
    else
        echo "⚠️  telegram-bot не найден в PM2"
    fi
fi

# Перезапуск Next.js (если используется PM2)
if command -v pm2 &> /dev/null; then
    if pm2 list | grep -q "nextjs-app"; then
        echo "Перезапуск nextjs-app..."
        pm2 restart nextjs-app
    else
        echo "⚠️  nextjs-app не найден в PM2"
    fi
fi

echo -e "${GREEN}✅ Деплой завершен успешно!${NC}"


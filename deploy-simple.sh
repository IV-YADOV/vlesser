#!/bin/bash

# Простой скрипт деплоя для Linux
# Использование: ./deploy-simple.sh

set -e

REPO_URL="https://github.com/IV-YADOV/vlesser.git"
PROJECT_DIR="/path/to/vpn_bot"  # Измените на ваш путь
BRANCH="master"

echo "🚀 Простой деплой..."

# Если директории нет - клонируем, если есть - обновляем
if [ ! -d "$PROJECT_DIR" ]; then
    echo "📥 Клонирование репозитория..."
    git clone $REPO_URL $PROJECT_DIR
    cd $PROJECT_DIR
else
    echo "📥 Обновление кода..."
    cd $PROJECT_DIR
    git pull origin $BRANCH
fi

echo "📦 Установка зависимостей..."
npm install --production
pip install -r requirements.txt

echo "🏗️  Сборка..."
npm run build

echo "🔄 Перезапуск сервисов..."
pm2 restart all || echo "⚠️  PM2 не найден"
sudo systemctl restart xray-service || echo "⚠️  xray-service не найден"

echo "✅ Готово!"


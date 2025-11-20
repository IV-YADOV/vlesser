#!/bin/bash
# Скрипт для исправления ошибки сборки на сервере
# Запустите на сервере: bash fix-server-build.sh

echo "🔧 Исправление ошибки сборки Next.js..."

# Переходим в директорию проекта
cd /var/www/vlesser || exit 1

# Удаляем пустую папку callback, если она существует
if [ -d "app/api/payment/callback" ]; then
    echo "🗑️  Удаление папки app/api/payment/callback..."
    rm -rf app/api/payment/callback
    echo "✅ Папка удалена"
else
    echo "ℹ️  Папка app/api/payment/callback не найдена"
fi

# Очищаем кеш Next.js
if [ -d ".next" ]; then
    echo "🗑️  Очистка кеша Next.js (.next)..."
    rm -rf .next
    echo "✅ Кеш очищен"
fi

# Очищаем node_modules/.cache если существует
if [ -d "node_modules/.cache" ]; then
    echo "🗑️  Очистка кеша node_modules..."
    rm -rf node_modules/.cache
    echo "✅ Кеш node_modules очищен"
fi

echo ""
echo "✅ Исправление завершено!"
echo "📦 Теперь запустите сборку: npm run build"


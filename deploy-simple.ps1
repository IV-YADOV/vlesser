# Простой скрипт деплоя для Windows
# Использование: .\deploy-simple.ps1

$ErrorActionPreference = "Stop"

$REPO_URL = "https://github.com/IV-YADOV/vlesser.git"
$PROJECT_DIR = "C:\path\to\vpn_bot"  # Измените на ваш путь
$BRANCH = "master"

Write-Host "🚀 Простой деплой..." -ForegroundColor Yellow

# Если директории нет - клонируем, если есть - обновляем
if (-not (Test-Path $PROJECT_DIR)) {
    Write-Host "📥 Клонирование репозитория..." -ForegroundColor Cyan
    git clone $REPO_URL $PROJECT_DIR
    Set-Location $PROJECT_DIR
} else {
    Write-Host "📥 Обновление кода..." -ForegroundColor Cyan
    Set-Location $PROJECT_DIR
    git pull origin $BRANCH
}

Write-Host "📦 Установка зависимостей..." -ForegroundColor Yellow
npm install --production
pip install -r requirements.txt

Write-Host "🏗️  Сборка..." -ForegroundColor Yellow
npm run build

Write-Host "🔄 Перезапуск сервисов..." -ForegroundColor Yellow
pm2 restart all
Restart-Service -Name "XrayService" -ErrorAction SilentlyContinue

Write-Host "✅ Готово!" -ForegroundColor Green


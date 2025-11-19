# PowerShell скрипт для деплоя на сервер (Windows)
# Использование: .\deploy.ps1

$ErrorActionPreference = "Stop"

Write-Host "🚀 Начинаем деплой..." -ForegroundColor Yellow

# Переменные (настройте под ваш сервер)
$REPO_URL = "https://github.com/IV-YADOV/vlesser.git"
$PROJECT_DIR = "C:\path\to\vpn_bot"  # Измените на путь к проекту на сервере
$BRANCH = "master"

Write-Host "📥 Обновление кода из GitHub..." -ForegroundColor Yellow

# Если директория не существует, клонируем репозиторий
if (-not (Test-Path "$PROJECT_DIR\.git")) {
    Write-Host "Клонирование репозитория..." -ForegroundColor Cyan
    $parentDir = Split-Path -Parent $PROJECT_DIR
    $folderName = Split-Path -Leaf $PROJECT_DIR
    Set-Location $parentDir
    if (Test-Path $folderName) {
        Remove-Item -Recurse -Force $folderName
    }
    git clone $REPO_URL $folderName
    Set-Location $PROJECT_DIR
} else {
    # Если репозиторий уже существует, просто обновляем
    Set-Location $PROJECT_DIR
    git pull origin $BRANCH
}

Write-Host "📦 Установка зависимостей Node.js..." -ForegroundColor Yellow
npm install --production

Write-Host "🐍 Установка зависимостей Python..." -ForegroundColor Yellow
pip install -r requirements.txt

Write-Host "🏗️  Сборка Next.js приложения..." -ForegroundColor Yellow
npm run build

Write-Host "🔄 Перезапуск сервисов..." -ForegroundColor Yellow

# Перезапуск Python сервиса (если используется NSSM)
if (Get-Service -Name "XrayService" -ErrorAction SilentlyContinue) {
    Write-Host "Перезапуск XrayService..."
    Restart-Service -Name "XrayService"
} else {
    Write-Host "⚠️  XrayService не найден" -ForegroundColor Yellow
}

# Перезапуск Telegram бота (если используется PM2)
if (Get-Command pm2 -ErrorAction SilentlyContinue) {
    $botRunning = pm2 list | Select-String "telegram-bot"
    if ($botRunning) {
        Write-Host "Перезапуск telegram-bot..."
        pm2 restart telegram-bot
    } else {
        Write-Host "⚠️  telegram-bot не найден в PM2" -ForegroundColor Yellow
    }
}

# Перезапуск Next.js (если используется PM2)
if (Get-Command pm2 -ErrorAction SilentlyContinue) {
    $nextRunning = pm2 list | Select-String "nextjs-app"
    if ($nextRunning) {
        Write-Host "Перезапуск nextjs-app..."
        pm2 restart nextjs-app
    } else {
        Write-Host "⚠️  nextjs-app не найден в PM2" -ForegroundColor Yellow
    }
}

Write-Host "✅ Деплой завершен успешно!" -ForegroundColor Green


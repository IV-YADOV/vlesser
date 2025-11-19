# PowerShell скрипт для коммита и пуша изменений на GitHub
# Использование: .\push-to-github.ps1 "Описание изменений"

param(
    [Parameter(Mandatory=$false)]
    [string]$Message = "Обновление проекта"
)

$ErrorActionPreference = "Stop"

Write-Host "📝 Подготовка к коммиту..." -ForegroundColor Yellow

# Проверка статуса
$status = git status --porcelain
if (-not $status) {
    Write-Host "⚠️  Нет изменений для коммита" -ForegroundColor Yellow
    exit 0
}

Write-Host "📋 Измененные файлы:" -ForegroundColor Cyan
git status --short

# Добавление всех изменений
Write-Host "`n➕ Добавление файлов..." -ForegroundColor Yellow
git add .

# Коммит
Write-Host "💾 Создание коммита..." -ForegroundColor Yellow
git commit -m $Message

# Пуш
Write-Host "🚀 Отправка на GitHub..." -ForegroundColor Yellow
git push origin master

Write-Host "`n✅ Изменения успешно отправлены на GitHub!" -ForegroundColor Green
Write-Host "📦 Репозиторий: https://github.com/IV-YADOV/vlesser.git" -ForegroundColor Cyan


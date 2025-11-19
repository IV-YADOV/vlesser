# 🚀 Инструкция по деплою

## Шаг 1: Отправка изменений на GitHub

### Вариант A: Использование PowerShell скрипта (Windows)

```powershell
# С описанием изменений
.\push-to-github.ps1 "Добавлена интеграция с Robokassa"

# Или с описанием по умолчанию
.\push-to-github.ps1
```

### Вариант B: Ручной способ

```powershell
# Проверка статуса
git status

# Добавление всех изменений
git add .

# Создание коммита
git commit -m "Описание ваших изменений"

# Отправка на GitHub
git push origin master
```

**⚠️ Важно:** Файл `.env.local` автоматически игнорируется и не попадет в репозиторий.

---

## Шаг 2: Деплой на сервер

### 🎯 Простой способ (рекомендуется)

#### Для Linux сервера:

**Первый раз (клонирование):**
```bash
# Подключитесь к серверу
ssh user@your-server.com

# Перейдите в нужную директорию
cd /home/user

# Клонируйте репозиторий
git clone https://github.com/IV-YADOV/vlesser.git vpn_bot

# Перейдите в проект
cd vpn_bot

# Установите зависимости
npm install --production
pip install -r requirements.txt

# Соберите проект
npm run build

# Создайте .env.local с настройками
nano .env.local

# Запустите сервисы (см. раздел ниже)
```

**Обновление (когда код уже на сервере):**
```bash
cd /home/user/vpn_bot
git pull origin master
npm install --production
pip install -r requirements.txt
npm run build
pm2 restart all
sudo systemctl restart xray-service
```

#### Для Windows сервера:

**Первый раз (клонирование):**
```powershell
# Перейдите в нужную директорию
cd C:\Projects

# Клонируйте репозиторий
git clone https://github.com/IV-YADOV/vlesser.git vpn_bot

# Перейдите в проект
cd vpn_bot

# Установите зависимости
npm install --production
pip install -r requirements.txt

# Соберите проект
npm run build

# Создайте .env.local с настройками
notepad .env.local

# Запустите сервисы (см. раздел ниже)
```

**Обновление (когда код уже на сервере):**
```powershell
cd C:\Projects\vpn_bot
git pull origin master
npm install --production
pip install -r requirements.txt
npm run build
pm2 restart all
Restart-Service -Name "XrayService"
```

---

### 🔧 Использование скриптов (автоматизация)

#### Для Linux сервера:

1. **Подключитесь к серверу по SSH:**
   ```bash
   ssh user@your-server.com
   ```

2. **Скопируйте скрипт на сервер** или отредактируйте прямо на сервере:
   ```bash
   nano deploy-simple.sh
   # Измените PROJECT_DIR на ваш путь
   ```

3. **Сделайте скрипт исполняемым:**
   ```bash
   chmod +x deploy-simple.sh
   ```

4. **Запустите деплой:**
   ```bash
   ./deploy-simple.sh
   ```

#### Для Windows сервера:

1. **Откройте PowerShell на сервере**

2. **Отредактируйте скрипт `deploy-simple.ps1`** (укажите правильный путь к проекту)

3. **Запустите деплой:**
   ```powershell
   .\deploy-simple.ps1
   ```

---

## Шаг 3: Ручной деплой (если скрипты не подходят)

### На Linux сервере:

```bash
# 1. Перейти в директорию проекта
cd /path/to/vpn_bot

# 2. Обновить код
git fetch origin
git reset --hard origin/master
git clean -fd

# 3. Установить зависимости Node.js
npm install --production

# 4. Установить зависимости Python
pip install -r requirements.txt

# 5. Собрать Next.js приложение
npm run build

# 6. Перезапустить сервисы

# Python сервис (systemd)
sudo systemctl restart xray-service

# Telegram бот (PM2)
pm2 restart telegram-bot

# Next.js приложение (PM2)
pm2 restart nextjs-app
```

### На Windows сервере:

```powershell
# 1. Перейти в директорию проекта
cd C:\path\to\vpn_bot

# 2. Обновить код
git fetch origin
git reset --hard origin/master
git clean -fd

# 3. Установить зависимости Node.js
npm install --production

# 4. Установить зависимости Python
pip install -r requirements.txt

# 5. Собрать Next.js приложение
npm run build

# 6. Перезапустить сервисы

# Python сервис (NSSM)
Restart-Service -Name "XrayService"

# Telegram бот (PM2)
pm2 restart telegram-bot

# Next.js приложение (PM2)
pm2 restart nextjs-app
```

---

## 🔧 Настройка сервисов на сервере

### Python сервис (Xray)

**Linux (systemd):**
```bash
sudo nano /etc/systemd/system/xray-service.service
```

```ini
[Unit]
Description=Xray API Service
After=network.target

[Service]
User=your_user
WorkingDirectory=/path/to/vpn_bot
Environment="PATH=/path/to/venv/bin"
ExecStart=/path/to/venv/bin/python xray_service.py
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable xray-service
sudo systemctl start xray-service
```

**Windows (NSSM):**
```powershell
nssm install XrayService "C:\path\to\python.exe" "C:\path\to\xray_service.py"
nssm start XrayService
```

### Telegram бот (PM2)

```bash
# Установка PM2
npm install -g pm2

# Запуск бота
pm2 start bot.js --name telegram-bot

# Сохранение конфигурации
pm2 save

# Автозапуск при перезагрузке
pm2 startup
```

### Next.js приложение (PM2)

```bash
# Запуск в production режиме
pm2 start npm --name "nextjs-app" -- start

# Или с явным указанием команды
pm2 start "npm run start" --name "nextjs-app"

# Сохранение конфигурации
pm2 save
```

---

## 📝 Проверка после деплоя

1. **Проверить статус сервисов:**
   ```bash
   # Linux
   sudo systemctl status xray-service
   pm2 status

   # Windows
   Get-Service XrayService
   pm2 status
   ```

2. **Проверить логи:**
   ```bash
   # Python сервис
   sudo journalctl -u xray-service -f  # Linux
   # или
   pm2 logs xray-service

   # Telegram бот
   pm2 logs telegram-bot

   # Next.js
   pm2 logs nextjs-app
   ```

3. **Проверить доступность:**
   - Веб-сайт: `https://your-domain.com`
   - Python API: `http://your-server:5000/health`
   - Telegram бот должен отвечать на команды

---

## ⚠️ Важные замечания

1. **Переменные окружения:** Убедитесь, что на сервере есть файл `.env.local` с правильными настройками
2. **Порты:** Убедитесь, что порты 3000 (Next.js) и 5000 (Python) открыты в firewall
3. **База данных:** Проверьте подключение к Supabase
4. **Бэкапы:** Рекомендуется делать бэкап базы данных перед обновлением

---

## 🆘 Решение проблем

### Ошибка при git pull:
```bash
# Если есть конфликты
git stash
git pull
git stash pop
```

### Ошибка при установке зависимостей:
```bash
# Очистить кэш npm
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

### Сервис не запускается:
```bash
# Проверить логи
pm2 logs
sudo journalctl -u xray-service -n 50

# Перезапустить
pm2 restart all
sudo systemctl restart xray-service
```


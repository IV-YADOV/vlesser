# VLESSer - VPN Subscription Website

Современный веб-сайт для продажи VLESS VPN подписок с интеграцией Telegram и автоматическим созданием конфигов через Xray панель.

## 🚀 Технологии

- **Frontend**: Next.js 16 (App Router), TypeScript, TailwindCSS, shadcn/ui, Framer Motion
- **Backend**: Next.js API Routes, Supabase
- **Авторизация**: Telegram Bot API
- **VPN**: Xray панель (через Python сервис)

## 📋 Требования

- Node.js 18+ и npm
- Python 3.8+
- Supabase аккаунт
- Telegram Bot Token
- Xray панель с API доступом

## 🔧 Установка

### 1. Клонирование и установка зависимостей

```bash
# Установка зависимостей Node.js
npm install

# Установка зависимостей Python
pip install -r requirements.txt
```

### 2. Настройка переменных окружения

Создайте файл `.env.local` в корне проекта:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Telegram Bot
TELEGRAM_BOT_TOKEN=your_bot_token
SITE_URL=https://your-domain.com

# Python Xray Service
PYTHON_XRAY_SERVICE_URL=http://localhost:5000

# Admin Panel (для защиты админки)
ADMIN_SECRET_TOKEN=your_secret_admin_token_here
```

### 3. Настройка Supabase

Создайте следующие таблицы в Supabase:

#### Таблица `users`
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  tg_id TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### Таблица `subscriptions`
```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id),
  plan TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  vless_link TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### Таблица `payments`
```sql
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id),
  amount DECIMAL(10, 2) NOT NULL,
  plan TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### Таблица `auth_tokens`
```sql
CREATE TABLE auth_tokens (
  token TEXT PRIMARY KEY,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### Таблица `promocodes`
```sql
CREATE TABLE promocodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value DECIMAL(10, 2) NOT NULL,
  max_uses INTEGER,
  current_uses INTEGER DEFAULT 0,
  expires_at TIMESTAMP,
  min_amount DECIMAL(10, 2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### Таблица `plan_settings`
```sql
CREATE TABLE plan_settings (
  plan_id TEXT PRIMARY KEY,
  price DECIMAL(10, 2) NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO plan_settings (plan_id, price) VALUES
  ('start', 399),
  ('premium', 799),
  ('unlimited', 1399)
ON CONFLICT (plan_id) DO UPDATE SET price = EXCLUDED.price;
```

Также обновите таблицу `payments`:
```sql
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS original_amount DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS promocode TEXT;
```

Или выполните SQL из файла `supabase_promocodes_setup.sql`.

### 4. Настройка Python сервиса для Xray

Python сервис использует значения по умолчанию или переменные окружения:

```env
XRAY_BASE_URL=https://your-xray-server:port/path
XRAY_USERNAME=your_username
XRAY_PASSWORD=your_password
XRAY_INBOUND_ID=1
```

Или отредактируйте значения по умолчанию в `xray_service.py`.

### 5. Запуск проекта

#### Запуск Python сервиса (в отдельном терминале):

```bash
python xray_service.py
```

Сервис будет доступен на `http://localhost:5000`

#### Запуск Telegram бота (в отдельном терминале):

```bash
node bot.js
```

#### Запуск Next.js приложения:

```bash
npm run dev
```

Приложение будет доступно на `http://localhost:3000`

## 📁 Структура проекта

```
vpn_bot/
├── app/                    # Next.js страницы
│   ├── api/               # API routes
│   ├── admin/             # Админ панель
│   ├── checkout/          # Страница оплаты
│   ├── instructions/      # Инструкции по подключению
│   ├── legal/             # Юридическая информация
│   ├── profile/           # Профиль пользователя
│   └── webapp/            # Telegram WebApp
├── components/            # React компоненты
│   ├── ui/               # shadcn/ui компоненты
│   ├── Header.tsx        # Шапка сайта
│   ├── Footer.tsx        # Подвал сайта
│   ├── TelegramAuth.tsx  # Авторизация через Telegram
│   └── CookieBanner.tsx  # Баннер cookies
├── lib/                   # Утилиты
│   ├── supabase/         # Supabase клиенты
│   ├── auth.ts           # Функции авторизации
│   └── plans.ts          # Тарифные планы
├── bot.js                 # Telegram бот
├── xray_service.py        # Python сервис для Xray
└── requirements.txt       # Python зависимости
```

## 🔐 Авторизация через Telegram

Авторизация работает через Telegram бота:

1. Пользователь нажимает "Войти через Telegram" на сайте
2. Генерируется уникальный токен
3. Пользователь переходит в бота с токеном
4. Бот получает данные пользователя и отправляет ссылку авторизации
5. Пользователь возвращается на сайт авторизованным

## 💳 Процесс покупки

1. Пользователь выбирает тариф на главной странице или `/pricing`
2. Переходит на страницу `/checkout`
3. Нажимает "Оплатить" (mock платеж)
4. Next.js API вызывает Python сервис для создания клиента в Xray
5. Python сервис создает клиента и возвращает VLESS ссылку
6. VLESS ссылка сохраняется в Supabase и отображается пользователю

## 🐍 Python Xray Service API

### GET /health
Проверка работоспособности сервиса

**Ответ:**
```json
{
  "status": "ok",
  "service": "xray-api"
}
```

### POST /create-client
Создать клиента в Xray и получить VLESS ссылку

**Запрос:**
```json
{
  "email": "tg_123456789",
  "days": 30
}
```

**Ответ:**
```json
{
  "success": true,
  "vless_link": "vless://...",
  "client_id": "uuid",
  "email": "tg_123456789_1",
  "expiry_time": 1234567890000
}
```

**Особенности:**
- Автоматически генерирует уникальный email (добавляет `_1`, `_2` и т.д. если email уже существует)
- Извлекает все параметры Reality из настроек Xray
- Использует фиксированные значения для `pbk` и `sni`
- Возвращает полную VLESS ссылку со всеми необходимыми параметрами

## 🚀 Деплой

### Next.js на Vercel

1. Подключите репозиторий к Vercel
2. Добавьте переменные окружения в настройках проекта
3. Деплой произойдет автоматически

### Python сервис

Для продакшена рекомендуется использовать:

**С Gunicorn (Linux/Mac):**
```bash
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 xray_service:app
```

**С systemd (Linux):**
Создайте файл `/etc/systemd/system/xray-service.service`:
```ini
[Unit]
Description=Xray API Service
After=network.target

[Service]
User=your_user
WorkingDirectory=/path/to/vpn_bot
Environment="PATH=/path/to/venv/bin"
ExecStart=/path/to/venv/bin/gunicorn -w 4 -b 0.0.0.0:5000 xray_service:app

[Install]
WantedBy=multi-user.target
```

Затем:
```bash
sudo systemctl enable xray-service
sudo systemctl start xray-service
```

**С NSSM (Windows):**
```bash
nssm install XrayService "C:\path\to\python.exe" "C:\path\to\xray_service.py"
nssm start XrayService
```

### Telegram бот

Запустите бота на сервере с помощью PM2 или systemd:

**С PM2:**
```bash
npm install -g pm2
pm2 start bot.js --name telegram-bot
pm2 save
pm2 startup
```

## 📝 Тарифные планы

Планы определены в `lib/plans.ts`:

- **Start**: 30 дней, базовая скорость
- **Premium**: 90 дней, повышенная скорость
- **Unlimited**: 365 дней, максимальная скорость

## 🎫 Промокоды

Система поддерживает создание и применение промокодов:

- **Процентные скидки**: например, 10%, 20%, 50%
- **Фиксированные скидки**: например, 100₽, 500₽
- **Ограничения**: максимальное количество использований, минимальная сумма заказа
- **Срок действия**: автоматическое истечение промокодов

### Использование промокодов

Пользователи могут ввести промокод на странице оплаты. Промокод проверяется в реальном времени и применяется автоматически при успешной оплате.

## 🔐 Админ панель

Админ панель доступна по адресу `/admin` и защищена токеном администратора.

### Функции админ панели:

- **Дашборд**: статистика пользователей, прибыль, платежи, промокоды
- **Управление промокодами**: создание, просмотр, удаление промокодов
- **Настройка тарифов**: изменение стоимости тарифов Start, Premium, Unlimited
- **Просмотр данных**: пользователи, платежи, подписки
- **Выдача конфигов вручную**: возможность выдать конфиг пользователю вручную

### Доступ к админ панели:

1. Перейдите на `/admin`
2. Введите токен администратора (из переменной окружения `ADMIN_SECRET_TOKEN`)
3. После успешной авторизации вы получите доступ ко всем функциям

## 🔧 Настройка Xray

Python сервис автоматически:
- Создает клиентов с уникальными email
- Устанавливает `flow=xtls-rprx-vision`
- Извлекает параметры Reality из настроек инбаунда
- Генерирует полные VLESS ссылки

## 📞 Поддержка

- Telegram: [@vpn_securebot](https://t.me/vpn_securebot)
- Email: support@vlesser.com

## 📄 Лицензия

Все права защищены © 2024 VLESSer

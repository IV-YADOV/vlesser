## VLESSer

Проект состоит из:
- Next.js 16 (директория `app/`) — публичный сайт и админ-панель.
- `bot.js` — Telegram-бот для авторизации и поддержки.
- `xray_service.py` — Python-сервис, который создаёт VLESS-конфиги через Xray API.

### Быстрый старт
```bash
npm install
pip install -r requirements.txt
npm run dev      # Next.js
python xray_service.py
node bot.js
```

### Переменные окружения
Определяются в `.env.local` (пример):
```
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...
TELEGRAM_BOT_TOKEN=...
SITE_URL=https://vlesser.ru
PYTHON_XRAY_SERVICE_URL=http://localhost:5000
ADMIN_SECRET_TOKEN=...
YOOKASSA_SHOP_ID=...
YOOKASSA_SECRET_KEY=...
YOOKASSA_REQUIRE_RECEIPT=true  # По умолчанию true - всегда формирует receipt (можно установить false для отключения)
SKIP_WEBHOOK_SIGNATURE_CHECK=false  # Только для dev/ngrok - пропускать проверку подписи webhook (НЕ использовать в production!)
ALLOW_WEBHOOK_FROM_ANY_IP=false  # Только для dev/ngrok - разрешить webhook с любых IP (НЕ использовать в production!)
```

**Примечание о receipt (чеках 54-ФЗ):**
- Если в настройках YooKassa включена обязательная отправка чеков, receipt формируется автоматически
- Если есть email пользователя - используется он, иначе используется placeholder email
- НДС по умолчанию: 20% (код 1). Для изменения отредактируйте `vat_code` в `app/api/createPayment/route.ts`
- Если YooKassa не требует receipt, можно отключить его в настройках YooKassa или установить `YOOKASSA_REQUIRE_RECEIPT=false`

**Безопасность webhook:**
- Webhook проверяет подпись `X-Content-HMAC-SHA256` (HMAC-SHA256 подпись тела запроса)
- Webhook проверяет IP-адрес отправителя (только IP-адреса YooKassa разрешены в production)
- В development/ngrok можно временно отключить проверки через `SKIP_WEBHOOK_SIGNATURE_CHECK=true` и `ALLOW_WEBHOOK_FROM_ANY_IP=true`
- ⚠️ **НИКОГДА не используйте эти флаги в production!**

### Поддержка
- Пользователь создаёт тикет через `/support` в боте.
- Сотрудники с ролями `owner/admin/support` управляют тикетами через `/staff` (бот) и `/admin` (веб-панель).

### Миграция базы данных

#### Обновление таблицы auth_tokens (обязательно):
Для безопасной авторизации необходимо выполнить миграцию:
```bash
# Запустите supabase_auth_tokens_migration.sql в SQL Editor Supabase
```
Эта миграция добавляет поля `status` и `telegram_id` в таблицу `auth_tokens` для проверки одноразовости токенов и привязки к пользователю.

#### Обновление таблицы users (обязательно):
Для сохранения данных пользователя из Telegram необходимо выполнить миграцию:
```bash
# Запустите supabase_users_migration.sql в SQL Editor Supabase
```
Эта миграция добавляет поля `first_name`, `last_name`, `username`, `photo_url` в таблицу `users` для хранения данных пользователя из Telegram.

### Очистка тестовых данных

#### SQL скрипт (через Supabase SQL Editor):
```bash
# Запустите supabase_clear_test_data.sql в SQL Editor Supabase
```

#### Node.js скрипт:
```bash
node clear-test-data.js
```

⚠️ **ВНИМАНИЕ**: Оба скрипта удаляют ВСЕ данные из таблиц. Используйте только для очистки тестовых данных!

### Исправление ошибки сборки на сервере

Если при сборке появляется ошибка `Cannot find module '../../../app/api/payment/callback/route.js'`:

```bash
# На сервере выполните:
cd /var/www/vlesser
rm -rf app/api/payment/callback
rm -rf .next
npm run build
```

Или используйте скрипт:
```bash
bash fix-server-build.sh
```
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
```

### Поддержка
- Пользователь создаёт тикет через `/support` в боте.
- Сотрудники с ролями `owner/admin/support` управляют тикетами через `/staff` (бот) и `/admin` (веб-панель).
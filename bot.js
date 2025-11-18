// Telegram Bot для авторизации
// Установите: npm install node-telegram-bot-api dotenv
// Запустите: node bot.js

require('dotenv').config({ path: '.env.local' });
const TelegramBot = require('node-telegram-bot-api');

const token = process.env.TELEGRAM_BOT_TOKEN || '8273767693:AAGfm36KQW_5rjvqf_RZxFHzWHRCHJndy1A';
const siteUrl = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

const bot = new TelegramBot(token, { polling: true });

console.log('🤖 Бот запущен и готов к работе!');
console.log(`🌐 URL сайта: ${siteUrl}`);

// Обработка команды /start с токеном
bot.onText(/\/start (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const token = match[1];
  const user = msg.from;

  console.log(`🔐 Запрос авторизации от пользователя ${user.id} с токеном ${token}`);

  // Формируем URL для авторизации
  const params = new URLSearchParams({
    token: token,
    tg_id: user.id.toString(),
    first_name: user.first_name,
    last_name: user.last_name || '',
    username: user.username || '',
  });
  const authUrl = `${siteUrl}/auth/callback?${params.toString()}`;

  // Отправляем пользователю кнопку с ссылкой
  const options = {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: '🔐 Авторизоваться на сайте',
            url: authUrl
          }
        ]
      ]
    }
  };

  await bot.sendMessage(
    chatId,
    `👋 Привет, ${user.first_name}!\n\nДля авторизации на сайте нажмите кнопку ниже:`,
    options
  );
});

// Обработка команды /start без токена
bot.onText(/^\/start$/, async (msg) => {
  const chatId = msg.chat.id;
  const user = msg.from;

  await bot.sendMessage(
    chatId,
    `👋 Привет, ${user.first_name}!\n\nДля авторизации на сайте используйте кнопку "Войти через Telegram" на сайте.\n\nБот отправит вам ссылку для авторизации.`
  );
});

// Обработка других сообщений
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (text && !text.startsWith('/')) {
    bot.sendMessage(
      chatId,
      'Используйте команду /start для авторизации на сайте.'
    );
  }
});

// Обработка ошибок
bot.on('polling_error', (error) => {
  console.error('❌ Ошибка бота:', error);
});


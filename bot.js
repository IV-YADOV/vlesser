// Telegram Bot для авторизации
// Установите: npm install node-telegram-bot-api dotenv
// Запустите: node bot.js

require('dotenv').config({ path: '.env.local' });
const TelegramBot = require('node-telegram-bot-api');
const { createClient } = require('@supabase/supabase-js');

const token = process.env.TELEGRAM_BOT_TOKEN || '8273767693:AAGfm36KQW_5rjvqf_RZxFHzWHRCHJndy1A';
const siteUrl = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.SUPABASE_PROJECT_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn(
    "⚠️ Не найдены переменные SUPABASE_URL (или NEXT_PUBLIC_SUPABASE_URL) и SUPABASE_SERVICE_KEY. Поддержка работать не будет."
  );
}

const supabase = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null;

if (supabase) {
  console.log("✅ Supabase client инициализирован");
} else {
  console.warn("⚠️ Supabase client не создан — тикеты работать не будут");
}

const bot = new TelegramBot(token, { polling: true });
const userStates = new Map();

const SUPPORT_CATEGORIES = [
  { key: 'connection', label: '🔗 Проблемы с подключением' },
  { key: 'payment', label: '💳 Вопрос по оплате' },
  { key: 'speed', label: '⚡ Скорость/качество' },
  { key: 'other', label: '❔ Другое' },
];

const TICKET_STATUS_LABELS = {
  open: '🆕 Новый',
  pending: '🟡 В работе',
  answered: '🟢 Есть ответ',
  closed: '✅ Закрыт',
};

const STAFF_ROLE_PRIORITY = {
  support: 1,
  admin: 2,
  owner: 3,
};

const STAFF_ROLE_LABEL = {
  support: 'Саппорт',
  admin: 'Админ',
  owner: 'Владелец',
};

const staffRoleCache = new Map();

console.log('🤖 Бот запущен и готов к работе!');
console.log(`🌐 URL сайта: ${siteUrl}`);

const getAdminInfoText = () =>
  '✉️ Чтобы открыть тикет, используйте меню /support.\n' +
  'После создания обращения с вами свяжется специалист поддержки.';

const supportMenuKeyboard = {
  reply_markup: {
    inline_keyboard: [
      [{ text: '📨 Создать обращение', callback_data: 'support_create' }],
      [{ text: '📂 Мои тикеты', callback_data: 'support_my_tickets' }],
      [{ text: 'ℹ️ Что входит в тарифы', callback_data: 'support_info' }],
    ],
  },
};

function setUserState(chatId, state) {
  if (!state) {
    userStates.delete(chatId);
  } else {
    userStates.set(chatId, state);
  }
}

function shortTicketId(id) {
  return `#${id.split('-')[0]}`;
}

function staffDisplayName(staff, user) {
  return staff?.display_name || user?.username || user?.first_name || 'Support';
}

function staffHasRole(staff, minRole) {
  if (!staff) return false;
  return (STAFF_ROLE_PRIORITY[staff.role] || 0) >= (STAFF_ROLE_PRIORITY[minRole] || 0);
}

async function getStaffProfile(user) {
  if (!supabase) return null;
  const cacheKey = user.id.toString();
  if (staffRoleCache.has(cacheKey)) {
    return staffRoleCache.get(cacheKey);
  }

  const { data, error } = await supabase
    .from('support_staff_roles')
    .select('*')
    .eq('tg_id', cacheKey)
    .maybeSingle();

  if (error) {
    console.error('Ошибка получения роли саппорта', error);
    return null;
  }

  if (!data) return null;

  const profile = {
    ...data,
    tg_id: cacheKey,
    label: STAFF_ROLE_LABEL[data.role] || data.role,
  };
  staffRoleCache.set(cacheKey, profile);
  return profile;
}

async function ensureStaffAccess(chatId, user, minRole = 'support') {
  const staff = await getStaffProfile(user);
  if (!staff || !staffHasRole(staff, minRole)) {
    await bot.sendMessage(chatId, '🚫 Доступ только для сотрудников поддержки.');
    return null;
  }
  return staff;
}

async function buildMessageContent(msg) {
  const parts = [];
  const text = msg.text?.trim();
  const caption = msg.caption?.trim();
  if (text) parts.push(text);
  if (caption && caption !== text) parts.push(caption);

  async function appendFile(label, fileId) {
    if (!fileId) return;
    try {
      const link = await bot.getFileLink(fileId);
      parts.push(`${label}: ${link}`);
    } catch (error) {
      console.error('Не удалось получить ссылку на файл', error);
      parts.push(`${label}: [не удалось получить ссылку]`);
    }
  }

  if (msg.photo?.length) {
    const file = msg.photo[msg.photo.length - 1];
    await appendFile('📷 Фото', file.file_id);
  }

  if (msg.document) {
    await appendFile(`📎 Файл (${msg.document.file_name || msg.document.mime_type || 'document'})`, msg.document.file_id);
  }

  if (msg.voice) {
    await appendFile('🎤 Голосовое сообщение', msg.voice.file_id);
  }

  if (msg.audio) {
    await appendFile('🎵 Аудио', msg.audio.file_id);
  }

  if (msg.video) {
    await appendFile('🎬 Видео', msg.video.file_id);
  }

  return parts.length ? parts.join('\n') : null;
}

async function fetchUserRecord(tgId) {
  if (!supabase) return null;
  const { data } = await supabase
    .from('users')
    .select('id')
    .eq('tg_id', tgId.toString())
    .maybeSingle();
  return data?.id || null;
}

async function createTicket(user, categoryKey, description) {
  if (!supabase) throw new Error('Supabase client not initialized');
  const category = SUPPORT_CATEGORIES.find((c) => c.key === categoryKey);
  const userId = await fetchUserRecord(user.id);
  console.log(`📩 Создание тикета от ${user.id} (${categoryKey})`);

  const { data: ticket, error } = await supabase
    .from('support_tickets')
    .insert({
      user_id: userId,
      tg_id: user.id.toString(),
      username: user.username || [user.first_name, user.last_name].filter(Boolean).join(' '),
      subject: `${category?.label || 'Обращение'} от ${user.first_name}`,
      category: categoryKey,
      status: 'open',
      priority: 'normal',
    })
    .select()
    .single();

  if (error) {
    console.error('Ошибка создания тикета', error);
    throw new Error('Не удалось создать обращение. Попробуйте позже.');
  }

  console.log(`🎫 Тикет ${ticket.id} создан для ${user.id}`);

  const { error: messageError } = await supabase
    .from('support_messages')
    .insert({
      ticket_id: ticket.id,
      author_type: 'user',
      author_id: user.id.toString(),
      author_name: user.username || user.first_name || 'Telegram user',
      message: description,
    });

  if (messageError) {
    console.error('Ошибка сохранения сообщения', messageError);
  }

  await supabase
    .from('support_tickets')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', ticket.id);

  return ticket;
}

async function getUserTickets(tgId) {
  if (!supabase) return [];
  const { data } = await supabase
    .from('support_tickets')
    .select('*')
    .eq('tg_id', tgId.toString())
    .order('last_message_at', { ascending: false })
    .limit(10);
  return data || [];
}

async function getTicketById(ticketId, tgId) {
  if (!supabase) return null;
  const { data } = await supabase
    .from('support_tickets')
    .select('*')
    .eq('id', ticketId)
    .eq('tg_id', tgId.toString())
    .maybeSingle();
  return data || null;
}

async function getTicketMessages(ticketId) {
  if (!supabase) return [];
  const { data } = await supabase
    .from('support_messages')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true });
  return data || [];
}

async function addTicketMessage(ticketId, user, text) {
  if (!supabase) throw new Error('Supabase client not initialized');
  console.log(`✉️ Сообщение в тикет ${ticketId} от ${user.id}`);

  const { data: ticket } = await supabase
    .from('support_tickets')
    .select('status')
    .eq('id', ticketId)
    .maybeSingle();

  if (!ticket) {
    throw new Error('Тикет не найден');
  }

  if (ticket.status === 'closed') {
    throw new Error('Этот тикет уже закрыт. Создайте новое обращение через /support.');
  }

  await supabase.from('support_messages').insert({
    ticket_id: ticketId,
    author_type: 'user',
    author_id: user.id.toString(),
    author_name: user.username || user.first_name,
    message: text,
  });

  const nextStatus =
    ticket?.status === 'closed'
      ? 'closed'
      : ticket?.status === 'pending'
      ? 'pending'
      : ticket?.status || 'open';

  await supabase
    .from('support_tickets')
    .update({
      status: nextStatus,
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', ticketId);
}

async function closeTicket(ticketId, tgId) {
  if (!supabase) return;
  console.log(`🚪 Закрытие тикета ${ticketId} пользователем ${tgId}`);
  await supabase
    .from('support_tickets')
    .update({
      status: 'closed',
      closed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', ticketId)
    .eq('tg_id', tgId.toString());
}

async function fetchTicketsByStatus(status, limit = 20) {
  if (!supabase) return [];
  let query = supabase
    .from('support_tickets')
    .select('*')
    .order('last_message_at', { ascending: false })
    .limit(limit);

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Ошибка загрузки тикетов для сотрудников', error);
    return [];
  }
  return data || [];
}

async function staffUpdateTicketStatus(ticketId, status, staff, options = {}) {
  if (!supabase) throw new Error('Supabase client not initialized');
  const updates = {
    status,
    updated_at: new Date().toISOString(),
    assigned_admin: options.assign ? staffDisplayName(staff) : options.keepAssigned ? undefined : null,
  };

  if (updates.assigned_admin === undefined) {
    delete updates.assigned_admin;
  }

  if (status === 'closed') {
    updates.closed_at = new Date().toISOString();
  } else if (status === 'open') {
    updates.closed_at = null;
  }

  const { error } = await supabase
    .from('support_tickets')
    .update(updates)
    .eq('id', ticketId);

  if (error) {
    console.error('Ошибка обновления статуса тикета', error);
    throw new Error('Не удалось изменить статус');
  }
}

async function staffSendTicketList(chatId, staff, status) {
  const tickets = await fetchTicketsByStatus(status);
  const statusLabel =
    status === 'all'
      ? 'Все обращения'
      : TICKET_STATUS_LABELS[status] || status;

  if (!tickets.length) {
    await bot.sendMessage(
      chatId,
      `${statusLabel}: Пока нет тикетов.`,
      staffFilterKeyboard(status)
    );
    return;
  }

  const lines = tickets
    .map((t) => {
      const statusText = TICKET_STATUS_LABELS[t.status] || t.status;
      return `${shortTicketId(t.id)} • ${statusText}\nКлиент: ${t.username || '—'} (TG: ${t.tg_id})\n${t.subject}`;
    })
    .join('\n\n');

  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        ...tickets.map((t) => [
          { text: `${shortTicketId(t.id)} • ${t.status}`, callback_data: `staff_ticket_${t.id}` },
        ]),
        [{ text: '⬅️ Фильтры', callback_data: 'staff_panel' }],
      ],
    },
  };

  await bot.sendMessage(chatId, `${statusLabel}:\n\n${lines}`, keyboard);
}

function staffFilterKeyboard(current = 'open') {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🆕 Новые', callback_data: 'staff_filter_open' },
          { text: '🟡 В работе', callback_data: 'staff_filter_pending' },
        ],
        [
          { text: '🟢 Есть ответ', callback_data: 'staff_filter_answered' },
          { text: '✅ Закрытые', callback_data: 'staff_filter_closed' },
        ],
        [{ text: '📋 Все', callback_data: 'staff_filter_all' }],
      ],
    },
  };
}

async function staffShowPanel(chatId, staff) {
  await bot.sendMessage(
    chatId,
    `🛠 Панель ${staffDisplayName(staff)} (${staff.label})\nВыберите фильтр, чтобы увидеть тикеты.`,
    staffFilterKeyboard()
  );
}

async function staffShowTicketDetails(chatId, staff, ticketId) {
  if (!supabase) return;
  const { data: ticket, error } = await supabase
    .from('support_tickets')
    .select('*')
    .eq('id', ticketId)
    .maybeSingle();

  if (error || !ticket) {
    await bot.sendMessage(chatId, 'Тикет не найден или был удалён.');
    return;
  }

  const { data: messages, error: msgError } = await supabase
    .from('support_messages')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true })
    .limit(10);

  if (msgError) {
    console.error('Ошибка загрузки сообщений тикета', msgError);
  }

  const info =
    `${shortTicketId(ticket.id)} • ${ticket.subject}\n` +
    `Статус: ${TICKET_STATUS_LABELS[ticket.status] || ticket.status}\n` +
    `Клиент: ${ticket.username || '—'} (TG: ${ticket.tg_id})\n` +
    `Назначен: ${ticket.assigned_admin || 'не назначен'}\n` +
    `Категория: ${ticket.category}\n\n` +
    `Последние сообщения:\n` +
    `${(messages || [])
      .slice(-5)
      .map((m) => {
        const author =
          m.author_type === 'admin'
            ? `👤 ${m.author_name || 'Саппорт'}`
            : '👤 Клиент';
        return `${author} • ${new Date(m.created_at).toLocaleString()}\n${m.message}`;
      })
      .join('\n\n') || 'Нет сообщений'}`;

  const buttons = [];
  if (ticket.status !== 'closed') {
    buttons.push([{ text: '✍️ Ответить', callback_data: `staff_reply_${ticket.id}` }]);
    if (ticket.status !== 'pending') {
      buttons.push([{ text: '🟡 В работу', callback_data: `staff_inwork_${ticket.id}` }]);
    }
    if (staffHasRole(staff, 'admin')) {
      buttons.push([{ text: '✅ Закрыть', callback_data: `staff_close_${ticket.id}` }]);
    }
  } else if (staffHasRole(staff, 'admin')) {
    buttons.push([{ text: '🔁 Открыть', callback_data: `staff_reopen_${ticket.id}` }]);
  }
  buttons.push([{ text: '⬅️ К списку', callback_data: 'staff_panel' }]);

  await bot.sendMessage(chatId, info, {
    reply_markup: { inline_keyboard: buttons },
  });
}

async function staffNotifyUser(ticket, staff, message) {
  if (!ticket?.tg_id) return;
  try {
    await bot.sendMessage(
      ticket.tg_id,
      `📬 Ответ по тикету ${shortTicketId(ticket.id)}\n${staffDisplayName(staff)}:\n${message}\n\nВы можете ответить прямо здесь.`
    );
  } catch (error) {
    console.error('Не удалось отправить уведомление пользователю', error);
  }
}

async function showTicketList(chatId, user) {
  const tickets = await getUserTickets(user.id);
  if (!tickets.length) {
    await bot.sendMessage(chatId, '📭 У вас пока нет обращений. Используйте кнопку «Создать обращение», чтобы описать проблему.', supportMenuKeyboard);
    return;
  }

  const summary = tickets
    .map((t) => {
      const status = t.status === 'closed'
        ? '✅ закрыт'
        : t.status === 'answered'
        ? '🟢 есть ответ'
        : t.status === 'pending'
        ? '🟡 в работе'
        : '🆕 новый';
      return `${shortTicketId(t.id)} • ${status}\n${t.subject}`;
    })
    .join('\n\n');

  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        ...tickets.map((t) => [
          {
            text: `${shortTicketId(t.id)} (${t.status})`,
            callback_data: `ticket_${t.id}`,
          },
        ]),
        [{ text: '⬅️ Назад', callback_data: 'support_menu' }],
      ],
    },
  };

  await bot.sendMessage(chatId, `📂 Ваши обращения:\n\n${summary}\n\nНажмите на тикет, чтобы посмотреть детали или ответить.`, keyboard);
}

async function showTicketDetails(chatId, user, ticketId) {
  const ticket = await getTicketById(ticketId, user.id);
  if (!ticket) {
    await bot.sendMessage(chatId, 'Тикет не найден или был закрыт.');
    return;
  }
  const messages = await getTicketMessages(ticketId);
  const lastMessages = messages.slice(-5).map((m) => {
    const author = m.author_type === 'admin' ? 'Админ' : 'Вы';
    return `${author}: ${m.message}`;
  });

  const text =
    `${shortTicketId(ticket.id)} • ${ticket.subject}\n` +
    `Статус: ${ticket.status}\nКатегория: ${ticket.category}\n\n` +
    `${lastMessages.length ? 'Последние сообщения:\n' + lastMessages.join('\n\n') : 'Сообщений пока нет.'}`;

  const inline_keyboard = [];
  if (ticket.status !== 'closed') {
    inline_keyboard.push([{ text: '✍️ Ответить', callback_data: `ticket_reply_${ticket.id}` }]);
  }
  inline_keyboard.push([{ text: '⬅️ К списку', callback_data: 'support_my_tickets' }]);

  await bot.sendMessage(chatId, text, {
    reply_markup: { inline_keyboard },
  });
}

function showSupportMenu(chatId) {
  bot.sendMessage(
    chatId,
    '🛠 Центр поддержки VLESSer\nВыберите действие:',
    supportMenuKeyboard
  );
}

// /start with token (auth)
bot.onText(/\/start (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const authToken = match[1];
  const user = msg.from;

  console.log(`🔐 Запрос авторизации от пользователя ${user.id} с токеном ${authToken}`);

  const params = new URLSearchParams({
    token: authToken,
    tg_id: user.id.toString(),
    first_name: user.first_name,
    last_name: user.last_name || '',
    username: user.username || '',
  });
  const authUrl = `${siteUrl}/auth/callback?${params.toString()}`;

  const options = {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: '🔐 Авторизоваться на сайте',
            url: authUrl,
          },
        ],
        [
          {
            text: '📞 Нужна поддержка',
            callback_data: 'support_menu',
          },
        ],
      ],
    },
  };

  await bot.sendMessage(
    chatId,
    `👋 Привет, ${user.first_name}!\n\nДля авторизации на сайте нажмите кнопку ниже или откройте меню поддержки.`,
    options
  );
});

// /start without token
bot.onText(/^\/start$/, async (msg) => {
  const chatId = msg.chat.id;
  const user = msg.from;

  await bot.sendMessage(
    chatId,
    `👋 Привет, ${user.first_name}!\n\nИспользуйте кнопку "Войти через Telegram" на сайте для авторизации.\n` +
      `Если нужна помощь — напишите /support.`,
  );
});

bot.onText(/^\/support$/, async (msg) => {
  showSupportMenu(msg.chat.id);
});

bot.onText(/^\/tickets$/, async (msg) => {
  await showTicketList(msg.chat.id, msg.from);
});

bot.onText(/^\/staff$/, async (msg) => {
  const staff = await ensureStaffAccess(msg.chat.id, msg.from);
  if (!staff) return;
  await staffShowPanel(msg.chat.id, staff);
});

bot.on('callback_query', async (query) => {
  try {
    const { data, message, id } = query;
    if (!message) return;
    const chatId = message.chat.id;
    const user = query.from;

    if (data === 'support_menu') {
      setUserState(chatId, null);
      await showSupportMenu(chatId);
    } else if (data === 'support_create') {
      const keyboard = {
        reply_markup: {
          inline_keyboard: [
            ...SUPPORT_CATEGORIES.map((cat) => [
              { text: cat.label, callback_data: `support_cat_${cat.key}` },
            ]),
            [{ text: '⬅️ Назад', callback_data: 'support_menu' }],
          ],
        },
      };
      await bot.sendMessage(chatId, 'Выберите тему обращения:', keyboard);
    } else if (data?.startsWith('support_cat_')) {
      const categoryKey = data.replace('support_cat_', '');
      setUserState(chatId, { type: 'new_ticket_description', category: categoryKey });
      await bot.sendMessage(chatId, 'Опишите проблему максимально подробно. Можно прикрепить скриншоты, ссылки и указать тариф.');
    } else if (data === 'support_my_tickets') {
      await showTicketList(chatId, user);
    } else if (data === 'support_info') {
      await bot.sendMessage(
        chatId,
        'Каждый тариф включает персональный VLESS-конфиг, безлимитный трафик и поддержку 24/7. ' +
          'Подробнее в разделе каталога на сайте.',
        supportMenuKeyboard
      );
    } else if (data?.startsWith('ticket_') && !data.startsWith('ticket_reply_')) {
      const ticketId = data.replace('ticket_', '');
      await showTicketDetails(chatId, user, ticketId);
    } else if (data?.startsWith('ticket_reply_')) {
      const ticketId = data.replace('ticket_reply_', '');
      const ticket = await getTicketById(ticketId, user.id);
      if (!ticket) {
        await bot.sendMessage(chatId, 'Тикет не найден.');
      } else if (ticket.status === 'closed') {
        await bot.sendMessage(chatId, 'Этот тикет уже закрыт. Создайте новое обращение командой /support.');
      } else {
        setUserState(chatId, { type: 'ticket_reply', ticketId });
        await bot.sendMessage(chatId, `Напишите сообщение для ${shortTicketId(ticketId)}. Оно будет отправлено в поддержку.`);
      }
    } else if (data === 'staff_panel' || data?.startsWith('staff_')) {
      const staff = await ensureStaffAccess(chatId, user);
      if (!staff) return;

      if (data === 'staff_panel') {
        await staffShowPanel(chatId, staff);
      } else if (data.startsWith('staff_filter_')) {
        const status = data.replace('staff_filter_', '');
        await staffSendTicketList(chatId, staff, status === 'all' ? 'all' : status);
      } else if (data.startsWith('staff_ticket_')) {
        const ticketId = data.replace('staff_ticket_', '');
        await staffShowTicketDetails(chatId, staff, ticketId);
      } else if (data.startsWith('staff_reply_')) {
        const ticketId = data.replace('staff_reply_', '');
        setUserState(chatId, { type: 'staff_reply', ticketId, staff });
        await bot.sendMessage(chatId, `✍️ Введите ответ для ${shortTicketId(ticketId)}.`, supportMenuKeyboard);
      } else if (data.startsWith('staff_inwork_')) {
        const ticketId = data.replace('staff_inwork_', '');
        await staffUpdateTicketStatus(ticketId, 'pending', staff, { assign: true });
        await bot.sendMessage(chatId, `${shortTicketId(ticketId)} помечен как «В работе».`, supportMenuKeyboard);
      } else if (data.startsWith('staff_close_')) {
        if (!staffHasRole(staff, 'admin')) {
          await bot.sendMessage(chatId, 'Закрывать тикеты может только админ.');
        } else {
          const ticketId = data.replace('staff_close_', '');
          await staffUpdateTicketStatus(ticketId, 'closed', staff, { keepAssigned: true });
          await bot.sendMessage(chatId, `${shortTicketId(ticketId)} закрыт.`, supportMenuKeyboard);
        }
      } else if (data.startsWith('staff_reopen_')) {
        if (!staffHasRole(staff, 'admin')) {
          await bot.sendMessage(chatId, 'Открывать тикеты может только админ.');
        } else {
          const ticketId = data.replace('staff_reopen_', '');
          await staffUpdateTicketStatus(ticketId, 'pending', staff, { assign: true });
          await bot.sendMessage(chatId, `${shortTicketId(ticketId)} снова в работе.`, supportMenuKeyboard);
        }
      }
    }

    await bot.answerCallbackQuery(id);
  } catch (error) {
    console.error('Ошибка обработки callback_query', error);
    if (query?.id) {
      await bot.answerCallbackQuery(query.id, { text: 'Произошла ошибка' });
    }
  }
});

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text?.trim();

  // игнорируем служебные команды (они обрабатываются в onText)
  if (text?.startsWith('/')) {
    return;
  }

  const content = await buildMessageContent(msg);
  const state = userStates.get(chatId);

  if (state?.type === 'new_ticket_description' && content) {
    try {
      const ticket = await createTicket(msg.from, state.category, content);
      await bot.sendMessage(
        chatId,
        `✅ Обращение ${shortTicketId(ticket.id)} создано.\nМы ответим в ближайшее время. Проверьте раздел «Мои тикеты».`,
        supportMenuKeyboard
      );
    } catch (error) {
      await bot.sendMessage(chatId, error.message || 'Не удалось создать обращение. Попробуйте позже.');
    } finally {
      setUserState(chatId, null);
    }
    return;
  }

  if (state?.type === 'ticket_reply' && content) {
    try {
      await addTicketMessage(state.ticketId, msg.from, content);
      await bot.sendMessage(
        chatId,
        `✉️ Сообщение добавлено в ${shortTicketId(state.ticketId)}. Мы уведомили администраторов.`,
        supportMenuKeyboard
      );
    } catch (error) {
      console.error('Ошибка при добавлении сообщения', error);
      await bot.sendMessage(chatId, error.message || 'Не удалось отправить сообщение. Попробуйте позже.');
    } finally {
      setUserState(chatId, null);
    }
    return;
  }

  if (state?.type === 'staff_reply' && content) {
    try {
      const staff = state.staff || (await getStaffProfile(msg.from));
      if (!staff) {
        await bot.sendMessage(chatId, 'Не удалось подтвердить права сотрудника.');
        setUserState(chatId, null);
        return;
      }

      const { data: ticket, error } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('id', state.ticketId)
        .maybeSingle();

      if (error || !ticket) {
        await bot.sendMessage(chatId, 'Тикет не найден.');
        setUserState(chatId, null);
        return;
      }

      if (ticket.status === 'closed') {
        await bot.sendMessage(chatId, 'Тикет уже закрыт. Откройте его перед ответом.');
        setUserState(chatId, null);
        return;
      }

      await supabase.from('support_messages').insert({
        ticket_id: ticket.id,
        author_type: 'admin',
        author_role: staff.role,
        author_id: staff.tg_id,
        author_name: staffDisplayName(staff, msg.from),
        message: content,
      });

      await staffUpdateTicketStatus(ticket.id, 'pending', staff, { assign: true });
      await staffNotifyUser(ticket, staff, content);

      await bot.sendMessage(
        chatId,
        `Ответ добавлен в ${shortTicketId(ticket.id)} и отправлен пользователю.`,
        supportMenuKeyboard
      );
    } catch (error) {
      console.error('Ошибка при ответе сотрудника', error);
      await bot.sendMessage(chatId, 'Не удалось отправить ответ. Попробуйте позже.');
    } finally {
      setUserState(chatId, null);
    }
    return;
  }

  if (content) {
    await bot.sendMessage(
      chatId,
      'Я могу помочь с авторизацией и поддержкой. Используйте команды /start или /support.',
      supportMenuKeyboard
    );
  }
});

bot.on('polling_error', (error) => {
  console.error('❌ Ошибка бота:', error);
});


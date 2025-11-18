-- Очистка всех тестовых данных из Supabase
-- ВНИМАНИЕ: Этот скрипт удалит ВСЕ данные из таблиц!
-- Используйте только для очистки тестовых данных

-- Отключаем проверку внешних ключей временно для безопасной очистки
SET session_replication_role = 'replica';

-- Удаляем данные в правильном порядке (сначала дочерние таблицы, потом родительские)

-- 1. Очищаем платежи (ссылается на users)
TRUNCATE TABLE payments CASCADE;

-- 2. Очищаем подписки (ссылается на users)
TRUNCATE TABLE subscriptions CASCADE;

-- 3. Очищаем токены авторизации (независимая таблица)
TRUNCATE TABLE auth_tokens CASCADE;

-- 4. Очищаем промокоды (независимая таблица)
TRUNCATE TABLE promocodes CASCADE;

-- 5. Очищаем пользователей (родительская таблица)
TRUNCATE TABLE users CASCADE;

-- Включаем обратно проверку внешних ключей
SET session_replication_role = 'origin';

-- Проверяем, что все таблицы пусты
SELECT 
  'users' as table_name, COUNT(*) as row_count FROM users
UNION ALL
SELECT 
  'subscriptions', COUNT(*) FROM subscriptions
UNION ALL
SELECT 
  'payments', COUNT(*) FROM payments
UNION ALL
SELECT 
  'auth_tokens', COUNT(*) FROM auth_tokens
UNION ALL
SELECT 
  'promocodes', COUNT(*) FROM promocodes;


/**
 * Скрипт для очистки тестовых данных из Supabase
 * Использование: node clear-test-data.js
 * 
 * ВНИМАНИЕ: Этот скрипт удалит ВСЕ данные из таблиц!
 * Используйте только для очистки тестовых данных в dev окружении
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Ошибка: SUPABASE_URL и SUPABASE_SERVICE_KEY должны быть заданы в .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Порядок удаления: сначала дочерние таблицы, потом родительские
const tables = [
  'support_messages',      // Ссылается на support_tickets
  'support_tickets',       // Ссылается на users
  'support_staff_roles',   // Независимая таблица
  'payments',              // Ссылается на users
  'subscriptions',         // Ссылается на users
  'auth_tokens',           // Независимая таблица
  'promocodes',            // Независимая таблица
  'users',                 // Родительская таблица
];

async function clearTestData() {
  console.log('🧹 Начинаем очистку тестовых данных из Supabase...\n');

  try {
    // Сначала проверяем, сколько данных в каждой таблице
    console.log('📊 Проверка данных перед очисткой:\n');
    for (const table of tables) {
      try {
        const { count, error } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });

        if (error && error.code !== 'PGRST116') {
          console.log(`  ⚠️  ${table}: ошибка - ${error.message}`);
        } else {
          console.log(`  ${table}: ${count || 0} записей`);
        }
      } catch (error) {
        console.log(`  ⚠️  ${table}: таблица не найдена или недоступна`);
      }
    }

    console.log('\n🗑️  Удаление данных...\n');

    // Удаляем данные из каждой таблицы
    for (const table of tables) {
      try {
        const { error } = await supabase
          .from(table)
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000'); // Удаляем все записи

        if (error) {
          console.log(`  ❌ ${table}: ошибка - ${error.message}`);
        } else {
          console.log(`  ✅ ${table}: данные удалены`);
        }
      } catch (error) {
        console.log(`  ⚠️  ${table}: ${error.message}`);
      }
    }

    // Проверяем результат
    console.log('\n📊 Проверка данных после очистки:\n');
    let allCleared = true;
    for (const table of tables) {
      try {
        const { count, error } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });

        if (error && error.code !== 'PGRST116') {
          console.log(`  ⚠️  ${table}: ошибка - ${error.message}`);
          allCleared = false;
        } else {
          const countValue = count || 0;
          if (countValue > 0) {
            console.log(`  ⚠️  ${table}: осталось ${countValue} записей`);
            allCleared = false;
          } else {
            console.log(`  ✅ ${table}: пусто (0 записей)`);
          }
        }
      } catch (error) {
        console.log(`  ⚠️  ${table}: ${error.message}`);
        allCleared = false;
      }
    }

    if (allCleared) {
      console.log('\n✅ Все тестовые данные успешно удалены!');
    } else {
      console.log('\n⚠️  Некоторые данные не были удалены. Проверьте ошибки выше.');
    }
  } catch (error) {
    console.error('\n❌ Ошибка при очистке данных:', error);
    process.exit(1);
  }
}

// Запускаем очистку
clearTestData();


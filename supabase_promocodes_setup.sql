-- Таблица промокодов
CREATE TABLE IF NOT EXISTS promocodes (
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

-- Добавляем колонки для промокодов в таблицу payments (если их еще нет)
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS original_amount DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS promocode TEXT;

-- Индекс для быстрого поиска промокодов
CREATE INDEX IF NOT EXISTS idx_promocodes_code ON promocodes(code);
CREATE INDEX IF NOT EXISTS idx_promocodes_active ON promocodes(is_active);

-- Таблица настроек тарифов (для управления ценами)
CREATE TABLE IF NOT EXISTS plan_settings (
  plan_id TEXT PRIMARY KEY,
  price DECIMAL(10, 2) NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Инициализация тарифов по умолчанию
INSERT INTO plan_settings (plan_id, price)
VALUES
  ('start', 399),
  ('premium', 799),
  ('unlimited', 1399)
ON CONFLICT (plan_id) DO UPDATE SET price = EXCLUDED.price;


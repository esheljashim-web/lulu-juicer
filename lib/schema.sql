-- Lulu Juicer Postgres Schema
-- Matches docs/DATA_DICTIONARY.md

CREATE TABLE IF NOT EXISTS telegram_updates (
  update_id BIGINT PRIMARY KEY,
  received_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS raw_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_update_id BIGINT,
  telegram_message_id BIGINT,
  telegram_chat_id BIGINT,
  source TEXT DEFAULT 'telegram',
  sender_telegram_id BIGINT,
  sender_name TEXT,
  received_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  text TEXT NOT NULL,
  file_url TEXT,
  file_type TEXT,
  kind TEXT DEFAULT 'slip',
  status TEXT DEFAULT 'received',
  retry_count INTEGER DEFAULT 0,
  internal_error TEXT,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS daily_slips (
  date DATE PRIMARY KEY,
  raw_message_id UUID REFERENCES raw_messages(id),
  cash_expenses_stated INTEGER NOT NULL DEFAULT 0,
  cash_expenses_calc INTEGER NOT NULL DEFAULT 0,
  card_atm_stated INTEGER NOT NULL DEFAULT 0,
  card_atm_calc INTEGER NOT NULL DEFAULT 0,
  total_on_bill INTEGER NOT NULL DEFAULT 0,
  total_on_bill_source TEXT DEFAULT 'stated',
  keeta INTEGER NOT NULL DEFAULT 0,
  keeta_status TEXT DEFAULT 'missing',
  talabat INTEGER NOT NULL DEFAULT 0,
  talabat_status TEXT DEFAULT 'missing',
  unlabeled INTEGER NOT NULL DEFAULT 0,
  total_sales INTEGER NOT NULL DEFAULT 0,
  bill_diff INTEGER NOT NULL DEFAULT 0,
  items_diff INTEGER NOT NULL DEFAULT 0,
  atm_diff INTEGER NOT NULL DEFAULT 0,
  flag TEXT DEFAULT 'ok',
  status TEXT DEFAULT 'ok',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS daily_slip_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  version INTEGER NOT NULL,
  snapshot JSONB NOT NULL,
  replaced_by_message_id UUID,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS expense_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL REFERENCES daily_slips(date) ON DELETE CASCADE,
  raw_message_id UUID,
  label_raw TEXT NOT NULL,
  label_normalized TEXT NOT NULL,
  category TEXT DEFAULT 'Uncategorised',
  supplier TEXT,
  staff_id UUID,
  amount INTEGER NOT NULL DEFAULT 0,
  is_salary BOOLEAN DEFAULT FALSE,
  position INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS card_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL REFERENCES daily_slips(date) ON DELETE CASCADE,
  raw_message_id UUID,
  amount INTEGER NOT NULL DEFAULT 0,
  position INTEGER DEFAULT 0,
  is_subtotal BOOLEAN DEFAULT FALSE,
  is_additional BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS purchases_online (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  raw_message_id UUID,
  supplier TEXT NOT NULL,
  amount INTEGER NOT NULL DEFAULT 0,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS fixed_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month DATE NOT NULL,
  type TEXT NOT NULL,
  amount INTEGER NOT NULL DEFAULT 0,
  source_message_id UUID
);

CREATE TABLE IF NOT EXISTS staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  aliases TEXT[] DEFAULT '{}',
  monthly_salary INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS label_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label_raw TEXT UNIQUE NOT NULL,
  label_normalized TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Uncategorised',
  supplier TEXT,
  staff_id UUID,
  confirmed BOOLEAN DEFAULT TRUE,
  created_by TEXT DEFAULT 'rule'
);

CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  row_id TEXT NOT NULL,
  field TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_by TEXT NOT NULL DEFAULT 'system',
  changed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  reason TEXT
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS app_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  level TEXT DEFAULT 'info',
  event TEXT NOT NULL,
  message_id UUID,
  details JSONB,
  duration_ms INTEGER
);

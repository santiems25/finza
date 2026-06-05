-- ============================================================
-- FINZA — Migración 005: Ahorro + días hasta 31
-- ============================================================

-- ─── 1. Permitir días 1–31 en tarjetas (antes era 1–28) ──────────────────────

ALTER TABLE credit_cards
  DROP CONSTRAINT credit_cards_closing_day_check,
  DROP CONSTRAINT credit_cards_due_day_check,
  ADD  CONSTRAINT credit_cards_closing_day_check CHECK (closing_day BETWEEN 1 AND 31),
  ADD  CONSTRAINT credit_cards_due_day_check     CHECK (due_day     BETWEEN 1 AND 31);

ALTER TABLE credit_card_monthly_config
  DROP CONSTRAINT credit_card_monthly_config_closing_day_check,
  DROP CONSTRAINT credit_card_monthly_config_due_day_check,
  ADD  CONSTRAINT credit_card_monthly_config_closing_day_check CHECK (closing_day BETWEEN 1 AND 31),
  ADD  CONSTRAINT credit_card_monthly_config_due_day_check     CHECK (due_day     BETWEEN 1 AND 31);

-- Actualizar también el trigger (ya soporta cualquier día, no cambia lógica)

-- ─── 2. Configuración de ahorro inicial ──────────────────────────────────────
-- Una sola fila que guarda el saldo de arranque en ARS y USD.

CREATE TABLE savings_config (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  initial_ars NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (initial_ars >= 0),
  initial_usd NUMERIC(14, 4) NOT NULL DEFAULT 0 CHECK (initial_usd >= 0),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Fila única por defecto
INSERT INTO savings_config (initial_ars, initial_usd) VALUES (0, 0);

-- ─── 3. Compras de dólares ────────────────────────────────────────────────────
-- Cada fila registra una conversión ARS → USD.
-- Descuenta ARS del saldo y suma USD al saldo.

CREATE TABLE fx_transactions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ars_amount    NUMERIC(14, 2) NOT NULL CHECK (ars_amount > 0),   -- pesos gastados
  usd_amount    NUMERIC(14, 4) NOT NULL CHECK (usd_amount > 0),   -- dólares recibidos
  exchange_rate NUMERIC(10, 2) NOT NULL CHECK (exchange_rate > 0), -- $/USD
  date          DATE NOT NULL,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_fx_transactions_date ON fx_transactions (date DESC);

-- ─── 4. RLS ──────────────────────────────────────────────────────────────────

ALTER TABLE savings_config  ENABLE ROW LEVEL SECURITY;
ALTER TABLE fx_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_only" ON savings_config
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "authenticated_only" ON fx_transactions
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

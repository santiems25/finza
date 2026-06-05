-- ============================================================
-- FINZA — Schema completo (v1)
-- Pegá este único archivo en el SQL Editor de Supabase
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── ENUMS ────────────────────────────────────────────────────────────────────

CREATE TYPE currency_type AS ENUM ('ARS', 'USD');

CREATE TYPE payment_method_type AS ENUM (
  'efectivo', 'debito', 'mercado_pago', 'credito'
);

CREATE TYPE card_type AS ENUM ('visa', 'master');

CREATE TYPE expense_category AS ENUM (
  'oficina', 'juntada', 'comida_afuera', 'peluqueria',
  'gym', 'ropa', 'viaje', 'bolucompra', 'salida', 'regalo', 'otros'
);

CREATE TYPE income_source AS ENUM (
  'sueldo', 'freelance', 'alquiler', 'dividendos', 'bono', 'otros'
);

CREATE TYPE asset_type AS ENUM (
  'accion', 'etf', 'cedear', 'bono', 'cripto', 'otro'
);

-- ─── TARJETAS DE CRÉDITO ──────────────────────────────────────────────────────

CREATE TABLE credit_cards (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         TEXT NOT NULL,
  card_type    card_type NOT NULL,
  closing_day  SMALLINT NOT NULL CHECK (closing_day BETWEEN 1 AND 28),
  due_day      SMALLINT NOT NULL CHECK (due_day     BETWEEN 1 AND 28),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO credit_cards (name, card_type, closing_day, due_day) VALUES
  ('Visa',       'visa',   5,  20),
  ('Mastercard', 'master', 15, 10);

-- ─── CONFIGURACIÓN MENSUAL DE TARJETAS ───────────────────────────────────────
-- Override del día de cierre/vencimiento para un mes/año específico.
-- El trigger lo consulta primero; si no hay registro usa credit_cards.closing_day.

CREATE TABLE credit_card_monthly_config (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  credit_card_id  UUID NOT NULL REFERENCES credit_cards(id) ON DELETE CASCADE,
  month           SMALLINT NOT NULL CHECK (month BETWEEN 0 AND 11),
  year            SMALLINT NOT NULL,
  closing_day     SMALLINT NOT NULL CHECK (closing_day BETWEEN 1 AND 28),
  due_day         SMALLINT NOT NULL CHECK (due_day     BETWEEN 1 AND 28),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (credit_card_id, month, year)
);

CREATE INDEX idx_monthly_config_card
  ON credit_card_monthly_config (credit_card_id, year DESC, month DESC);

-- ─── GASTOS ───────────────────────────────────────────────────────────────────

CREATE TABLE expenses (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  amount              NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  currency            currency_type NOT NULL DEFAULT 'ARS',
  description         TEXT NOT NULL,
  category            expense_category NOT NULL DEFAULT 'otros',
  date                DATE NOT NULL,
  payment_method      payment_method_type NOT NULL DEFAULT 'efectivo',
  credit_card_id      UUID REFERENCES credit_cards(id) ON DELETE SET NULL,
  billing_period      TEXT,
  billing_month       SMALLINT,
  billing_year        SMALLINT,
  total_installments  SMALLINT NOT NULL DEFAULT 1 CHECK (total_installments >= 1),
  installment_number  SMALLINT NOT NULL DEFAULT 1 CHECK (installment_number >= 1),
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_expenses_date        ON expenses (date DESC);
CREATE INDEX idx_expenses_category    ON expenses (category);
CREATE INDEX idx_expenses_currency    ON expenses (currency);
CREATE INDEX idx_expenses_payment     ON expenses (payment_method);
CREATE INDEX idx_expenses_billing     ON expenses (billing_year, billing_month);
CREATE INDEX idx_expenses_credit_card ON expenses (credit_card_id)
  WHERE credit_card_id IS NOT NULL;

-- ─── TRIGGER: billing period con lookup mensual ───────────────────────────────

CREATE OR REPLACE FUNCTION calculate_billing_period()
RETURNS TRIGGER AS $$
DECLARE
  v_closing_day   SMALLINT;
  v_expense_day   SMALLINT;
  v_expense_month SMALLINT;
  v_expense_year  SMALLINT;
  v_bill_month    SMALLINT;
  v_bill_year     SMALLINT;
  v_month_names   TEXT[] := ARRAY[
    'Enero','Febrero','Marzo','Abril','Mayo','Junio',
    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
  ];
BEGIN
  IF NEW.payment_method = 'credito' AND NEW.credit_card_id IS NOT NULL THEN
    v_expense_day   := EXTRACT(DAY   FROM NEW.date)::SMALLINT;
    v_expense_month := (EXTRACT(MONTH FROM NEW.date) - 1)::SMALLINT;
    v_expense_year  := EXTRACT(YEAR  FROM NEW.date)::SMALLINT;

    -- 1. Buscar override mensual
    SELECT closing_day INTO v_closing_day
    FROM credit_card_monthly_config
    WHERE credit_card_id = NEW.credit_card_id
      AND month = v_expense_month
      AND year  = v_expense_year;

    -- 2. Si no hay, usar el día habitual del card
    IF NOT FOUND THEN
      SELECT closing_day INTO v_closing_day
      FROM credit_cards WHERE id = NEW.credit_card_id;
    END IF;

    v_bill_month := v_expense_month;
    v_bill_year  := v_expense_year;

    IF v_expense_day > v_closing_day THEN
      v_bill_month := v_bill_month + 1;
      IF v_bill_month > 11 THEN
        v_bill_month := 0;
        v_bill_year  := v_bill_year + 1;
      END IF;
    END IF;

    NEW.billing_month  := v_bill_month;
    NEW.billing_year   := v_bill_year;
    NEW.billing_period := v_month_names[v_bill_month + 1] || ' ' || v_bill_year::TEXT;
  ELSE
    NEW.billing_month  := NULL;
    NEW.billing_year   := NULL;
    NEW.billing_period := NULL;
    NEW.credit_card_id := NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_calculate_billing_period
  BEFORE INSERT OR UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION calculate_billing_period();

-- ─── PAGOS DE RESÚMENES TC ────────────────────────────────────────────────────

CREATE TABLE billing_payments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  credit_card_id  UUID NOT NULL REFERENCES credit_cards(id) ON DELETE CASCADE,
  billing_month   SMALLINT NOT NULL CHECK (billing_month BETWEEN 0 AND 11),
  billing_year    SMALLINT NOT NULL,
  paid_at         TIMESTAMPTZ DEFAULT NOW(),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (credit_card_id, billing_month, billing_year)
);

CREATE INDEX idx_billing_payments_card
  ON billing_payments (credit_card_id, billing_year DESC, billing_month DESC);

-- ─── INGRESOS ─────────────────────────────────────────────────────────────────

CREATE TABLE incomes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  amount      NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  currency    currency_type NOT NULL DEFAULT 'ARS',
  description TEXT NOT NULL,
  source      income_source NOT NULL DEFAULT 'sueldo',
  date        DATE NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_incomes_date ON incomes (date DESC);
CREATE INDEX idx_incomes_currency ON incomes (currency);

-- ─── INVERSIONES (USD) ────────────────────────────────────────────────────────
-- Cada fila es un lote de compra (lot). Se puede marcar como vendido.

CREATE TABLE investments (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticker       TEXT NOT NULL,
  asset_type   asset_type NOT NULL DEFAULT 'accion',
  quantity     NUMERIC(12, 4) NOT NULL CHECK (quantity  > 0),
  buy_price    NUMERIC(12, 4) NOT NULL CHECK (buy_price > 0),
  buy_date     DATE NOT NULL,
  -- Venta (null = posición activa)
  is_sold      BOOLEAN NOT NULL DEFAULT false,
  sell_price   NUMERIC(12, 4) CHECK (sell_price > 0),
  sell_date    DATE,
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_investments_ticker   ON investments (ticker);
CREATE INDEX idx_investments_buy_date ON investments (buy_date DESC);
CREATE INDEX idx_investments_is_sold  ON investments (is_sold);

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────────────────────

ALTER TABLE credit_cards               ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_card_monthly_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_payments           ENABLE ROW LEVEL SECURITY;
ALTER TABLE incomes                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE investments                ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all" ON credit_cards               FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON credit_card_monthly_config FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON expenses                   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON billing_payments           FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON incomes                    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON investments                FOR ALL USING (true) WITH CHECK (true);

-- Vista: posiciones agrupadas por ticker (activas)
CREATE VIEW portfolio_positions AS
SELECT
  ticker,
  asset_type,
  SUM(quantity)                                    AS total_qty,
  SUM(quantity * buy_price)                        AS total_cost,
  AVG(buy_price)                                   AS avg_buy_price,
  MIN(buy_date)                                    AS first_buy_date,
  MAX(buy_date)                                    AS last_buy_date,
  COUNT(*)                                         AS lot_count
FROM investments
WHERE is_sold = false
GROUP BY ticker, asset_type
ORDER BY total_cost DESC;

-- ─── VISTAS ───────────────────────────────────────────────────────────────────

CREATE VIEW credit_card_billing_summary AS
SELECT
  e.billing_period,
  e.billing_month,
  e.billing_year,
  e.credit_card_id,
  cc.name AS card_name,
  cc.card_type,
  COALESCE(mc.due_day, cc.due_day) AS due_day,
  e.currency,
  SUM(e.amount) AS total_amount,
  COUNT(*)      AS expense_count,
  EXISTS (
    SELECT 1 FROM billing_payments bp
    WHERE  bp.credit_card_id = e.credit_card_id
      AND  bp.billing_month  = e.billing_month
      AND  bp.billing_year   = e.billing_year
  ) AS is_paid
FROM expenses e
JOIN credit_cards cc ON cc.id = e.credit_card_id
LEFT JOIN credit_card_monthly_config mc
  ON  mc.credit_card_id = e.credit_card_id
  AND mc.month = e.billing_month
  AND mc.year  = e.billing_year
WHERE e.payment_method = 'credito'
  AND e.billing_period IS NOT NULL
GROUP BY
  e.billing_period, e.billing_month, e.billing_year,
  e.credit_card_id, cc.name, cc.card_type, cc.due_day, mc.due_day, e.currency
ORDER BY e.billing_year DESC, e.billing_month DESC;

CREATE VIEW monthly_summary AS
SELECT
  EXTRACT(YEAR  FROM date)::INT AS year,
  EXTRACT(MONTH FROM date)::INT AS month,
  'expense'::TEXT               AS type,
  currency::TEXT,
  SUM(amount) AS total
FROM expenses
GROUP BY 1, 2, 3, 4
UNION ALL
SELECT
  EXTRACT(YEAR  FROM date)::INT AS year,
  EXTRACT(MONTH FROM date)::INT AS month,
  'income'::TEXT                AS type,
  currency::TEXT,
  SUM(amount) AS total
FROM incomes
GROUP BY 1, 2, 3, 4
ORDER BY 1 DESC, 2 DESC;

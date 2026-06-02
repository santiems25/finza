-- ============================================================
-- FINANZAS APP - Migración inicial
-- Ejecutar en el SQL Editor de Supabase
-- ============================================================

-- Extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── TIPOS ENUM ────────────────────────────────────────────────────────────────

CREATE TYPE currency_type AS ENUM ('ARS', 'USD');

CREATE TYPE payment_method_type AS ENUM (
  'efectivo',
  'debito',
  'mercado_pago',
  'credito'
);

CREATE TYPE card_type AS ENUM ('visa', 'master');

CREATE TYPE expense_category AS ENUM (
  'alimentacion',
  'transporte',
  'servicios',
  'salud',
  'entretenimiento',
  'ropa',
  'tecnologia',
  'educacion',
  'viajes',
  'restaurantes',
  'supermercado',
  'otros'
);

-- ─── TARJETAS DE CRÉDITO ───────────────────────────────────────────────────────

CREATE TABLE credit_cards (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         TEXT NOT NULL,                  -- ej: "Visa Galicia"
  card_type    card_type NOT NULL,             -- 'visa' | 'master'
  closing_day  SMALLINT NOT NULL               -- día de cierre (1-28)
               CHECK (closing_day BETWEEN 1 AND 28),
  due_day      SMALLINT NOT NULL               -- día de vencimiento (1-28)
               CHECK (due_day BETWEEN 1 AND 28),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Tarjetas por defecto
INSERT INTO credit_cards (name, card_type, closing_day, due_day) VALUES
  ('Visa', 'visa', 5, 20),
  ('Mastercard', 'master', 15, 10);

-- ─── GASTOS ────────────────────────────────────────────────────────────────────

CREATE TABLE expenses (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  amount         NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  currency       currency_type NOT NULL DEFAULT 'ARS',
  description    TEXT NOT NULL,
  category       expense_category NOT NULL DEFAULT 'otros',
  date           DATE NOT NULL,
  payment_method payment_method_type NOT NULL DEFAULT 'efectivo',

  -- Tarjeta de crédito (solo cuando payment_method = 'credito')
  credit_card_id UUID REFERENCES credit_cards(id) ON DELETE SET NULL,

  -- Período de resumen calculado automáticamente al insertar
  -- Ej: "Enero 2025"
  billing_period TEXT,
  billing_month  SMALLINT,   -- 0-indexed (0=Enero, 11=Diciembre)
  billing_year   SMALLINT,

  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para filtros comunes
CREATE INDEX idx_expenses_date ON expenses (date DESC);
CREATE INDEX idx_expenses_category ON expenses (category);
CREATE INDEX idx_expenses_payment_method ON expenses (payment_method);
CREATE INDEX idx_expenses_billing ON expenses (billing_year, billing_month);
CREATE INDEX idx_expenses_credit_card ON expenses (credit_card_id) WHERE credit_card_id IS NOT NULL;

-- ─── FUNCIÓN: calcular período de resumen ──────────────────────────────────────
-- Se ejecuta automáticamente al INSERT/UPDATE de un gasto con tarjeta de crédito

CREATE OR REPLACE FUNCTION calculate_billing_period()
RETURNS TRIGGER AS $$
DECLARE
  v_closing_day  SMALLINT;
  v_expense_day  SMALLINT;
  v_month        SMALLINT;
  v_year         SMALLINT;
  v_month_names  TEXT[] := ARRAY[
    'Enero','Febrero','Marzo','Abril','Mayo','Junio',
    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
  ];
BEGIN
  -- Solo procesar si es gasto con tarjeta de crédito
  IF NEW.payment_method = 'credito' AND NEW.credit_card_id IS NOT NULL THEN
    SELECT closing_day INTO v_closing_day
    FROM credit_cards WHERE id = NEW.credit_card_id;

    v_expense_day := EXTRACT(DAY FROM NEW.date);
    v_month       := EXTRACT(MONTH FROM NEW.date) - 1;  -- 0-indexed
    v_year        := EXTRACT(YEAR FROM NEW.date);

    -- Si el día del gasto <= día de cierre → va al resumen del mes actual
    -- Si el día del gasto >  día de cierre → va al resumen del mes siguiente
    IF v_expense_day > v_closing_day THEN
      v_month := v_month + 1;
      IF v_month > 11 THEN
        v_month := 0;
        v_year  := v_year + 1;
      END IF;
    END IF;

    NEW.billing_month  := v_month;
    NEW.billing_year   := v_year;
    NEW.billing_period := v_month_names[v_month + 1] || ' ' || v_year;
  ELSE
    -- No es crédito: limpiar campos de billing
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
  FOR EACH ROW
  EXECUTE FUNCTION calculate_billing_period();

-- ─── INVERSIONES ───────────────────────────────────────────────────────────────

CREATE TABLE investments (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticker     TEXT NOT NULL,               -- ej: "AAPL", "GGAL"
  quantity   NUMERIC(12, 4) NOT NULL CHECK (quantity > 0),
  buy_price  NUMERIC(12, 4) NOT NULL CHECK (buy_price > 0),  -- en USD
  buy_date   DATE NOT NULL,
  notes      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_investments_ticker ON investments (ticker);
CREATE INDEX idx_investments_buy_date ON investments (buy_date DESC);

-- ─── ROW LEVEL SECURITY ────────────────────────────────────────────────────────
-- Habilitado para preparar autenticación futura.
-- Por ahora las políticas son permisivas (acceso total).

ALTER TABLE credit_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE investments ENABLE ROW LEVEL SECURITY;

-- Política abierta (cambiar cuando agregues auth)
CREATE POLICY "allow_all_credit_cards" ON credit_cards FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_expenses"     ON expenses     FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_investments"  ON investments  FOR ALL USING (true) WITH CHECK (true);

-- ─── VISTAS ÚTILES ─────────────────────────────────────────────────────────────

-- Resumen de gastos en tarjeta por período de billing
CREATE VIEW credit_card_billing_summary AS
SELECT
  e.billing_period,
  e.billing_month,
  e.billing_year,
  e.credit_card_id,
  cc.name        AS card_name,
  cc.card_type,
  cc.due_day,
  e.currency,
  SUM(e.amount)  AS total_amount,
  COUNT(*)       AS expense_count
FROM expenses e
JOIN credit_cards cc ON cc.id = e.credit_card_id
WHERE e.payment_method = 'credito'
  AND e.billing_period IS NOT NULL
GROUP BY
  e.billing_period, e.billing_month, e.billing_year,
  e.credit_card_id, cc.name, cc.card_type, cc.due_day, e.currency
ORDER BY e.billing_year DESC, e.billing_month DESC;

-- Resumen mensual de gastos por categoría
CREATE VIEW monthly_expense_summary AS
SELECT
  EXTRACT(YEAR FROM date)::INT  AS year,
  EXTRACT(MONTH FROM date)::INT AS month,
  category,
  currency,
  SUM(amount)   AS total,
  COUNT(*)      AS count
FROM expenses
GROUP BY 1, 2, 3, 4
ORDER BY 1 DESC, 2 DESC;

-- ============================================================
-- FINZA — Migración 007: Multi-usuario
--
-- ANTES DE CORRER:
--   1. Andá a Supabase → Authentication → Users
--   2. Copiá tu UUID (columna "UID")
--   3. Reemplazá todas las ocurrencias de
--      'TU-UUID-AQUI' con tu UUID real
--      (podés usar Ctrl+H en el SQL Editor)
-- ============================================================

-- ─── PASO 1: Agregar columna user_id a todas las tablas ──────────────────────

ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE incomes
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE investments
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE dividends
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE credit_cards
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE credit_card_monthly_config
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE billing_payments
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE savings_config
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE fx_transactions
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- ─── PASO 2: Migrar datos existentes al usuario actual ───────────────────────
-- Reemplazá 'TU-UUID-AQUI' con tu UUID antes de correr esto.

UPDATE expenses                SET user_id = 'TU-UUID-AQUI' WHERE user_id IS NULL;
UPDATE incomes                 SET user_id = 'TU-UUID-AQUI' WHERE user_id IS NULL;
UPDATE investments             SET user_id = 'TU-UUID-AQUI' WHERE user_id IS NULL;
UPDATE dividends               SET user_id = 'TU-UUID-AQUI' WHERE user_id IS NULL;
UPDATE credit_cards            SET user_id = 'TU-UUID-AQUI' WHERE user_id IS NULL;
UPDATE credit_card_monthly_config SET user_id = 'TU-UUID-AQUI' WHERE user_id IS NULL;
UPDATE billing_payments        SET user_id = 'TU-UUID-AQUI' WHERE user_id IS NULL;
UPDATE savings_config          SET user_id = 'TU-UUID-AQUI' WHERE user_id IS NULL;
UPDATE fx_transactions         SET user_id = 'TU-UUID-AQUI' WHERE user_id IS NULL;

-- ─── PASO 3: Hacer user_id NOT NULL ahora que todos los registros lo tienen ──

ALTER TABLE expenses                  ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE incomes                   ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE investments               ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE dividends                 ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE credit_cards              ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE credit_card_monthly_config ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE billing_payments          ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE savings_config            ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE fx_transactions           ALTER COLUMN user_id SET NOT NULL;

-- ─── PASO 4: Índices para performance ────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_expenses_user               ON expenses (user_id);
CREATE INDEX IF NOT EXISTS idx_incomes_user                ON incomes (user_id);
CREATE INDEX IF NOT EXISTS idx_investments_user            ON investments (user_id);
CREATE INDEX IF NOT EXISTS idx_dividends_user              ON dividends (user_id);
CREATE INDEX IF NOT EXISTS idx_credit_cards_user           ON credit_cards (user_id);
CREATE INDEX IF NOT EXISTS idx_monthly_config_user         ON credit_card_monthly_config (user_id);
CREATE INDEX IF NOT EXISTS idx_billing_payments_user       ON billing_payments (user_id);
CREATE INDEX IF NOT EXISTS idx_savings_config_user         ON savings_config (user_id);
CREATE INDEX IF NOT EXISTS idx_fx_transactions_user        ON fx_transactions (user_id);

-- ─── PASO 5: Reemplazar políticas RLS ────────────────────────────────────────
-- Cada usuario ve y modifica únicamente sus propios datos.

-- expenses
DROP POLICY IF EXISTS "allow_all"          ON expenses;
DROP POLICY IF EXISTS "authenticated_only" ON expenses;
CREATE POLICY "own_data" ON expenses
  FOR ALL USING     (auth.uid() = user_id)
  WITH CHECK        (auth.uid() = user_id);

-- incomes
DROP POLICY IF EXISTS "allow_all"          ON incomes;
DROP POLICY IF EXISTS "authenticated_only" ON incomes;
CREATE POLICY "own_data" ON incomes
  FOR ALL USING     (auth.uid() = user_id)
  WITH CHECK        (auth.uid() = user_id);

-- investments
DROP POLICY IF EXISTS "allow_all"          ON investments;
DROP POLICY IF EXISTS "authenticated_only" ON investments;
CREATE POLICY "own_data" ON investments
  FOR ALL USING     (auth.uid() = user_id)
  WITH CHECK        (auth.uid() = user_id);

-- dividends
DROP POLICY IF EXISTS "allow_all"          ON dividends;
DROP POLICY IF EXISTS "authenticated_only" ON dividends;
CREATE POLICY "own_data" ON dividends
  FOR ALL USING     (auth.uid() = user_id)
  WITH CHECK        (auth.uid() = user_id);

-- credit_cards
DROP POLICY IF EXISTS "allow_all"          ON credit_cards;
DROP POLICY IF EXISTS "authenticated_only" ON credit_cards;
CREATE POLICY "own_data" ON credit_cards
  FOR ALL USING     (auth.uid() = user_id)
  WITH CHECK        (auth.uid() = user_id);

-- credit_card_monthly_config
DROP POLICY IF EXISTS "allow_all"          ON credit_card_monthly_config;
DROP POLICY IF EXISTS "authenticated_only" ON credit_card_monthly_config;
CREATE POLICY "own_data" ON credit_card_monthly_config
  FOR ALL USING     (auth.uid() = user_id)
  WITH CHECK        (auth.uid() = user_id);

-- billing_payments
DROP POLICY IF EXISTS "allow_all"          ON billing_payments;
DROP POLICY IF EXISTS "authenticated_only" ON billing_payments;
CREATE POLICY "own_data" ON billing_payments
  FOR ALL USING     (auth.uid() = user_id)
  WITH CHECK        (auth.uid() = user_id);

-- savings_config
DROP POLICY IF EXISTS "allow_all"          ON savings_config;
DROP POLICY IF EXISTS "authenticated_only" ON savings_config;
CREATE POLICY "own_data" ON savings_config
  FOR ALL USING     (auth.uid() = user_id)
  WITH CHECK        (auth.uid() = user_id);

-- fx_transactions
DROP POLICY IF EXISTS "allow_all"          ON fx_transactions;
DROP POLICY IF EXISTS "authenticated_only" ON fx_transactions;
CREATE POLICY "own_data" ON fx_transactions
  FOR ALL USING     (auth.uid() = user_id)
  WITH CHECK        (auth.uid() = user_id);

-- ─── PASO 6: Trigger para crear savings_config automáticamente ───────────────
-- Cuando se registra un usuario nuevo, se le crea su fila de ahorro vacía.

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.savings_config (user_id, initial_ars, initial_usd)
  VALUES (NEW.id, 0, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─── PASO 7: unique constraint en savings_config por usuario ─────────────────

ALTER TABLE savings_config
  DROP CONSTRAINT IF EXISTS savings_config_pkey_user,
  ADD  CONSTRAINT savings_config_user_unique UNIQUE (user_id);

-- ─── FIN ─────────────────────────────────────────────────────────────────────
-- Verificación: estas queries deberían devolver 0 filas con user_id NULL
-- SELECT COUNT(*) FROM expenses        WHERE user_id IS NULL;
-- SELECT COUNT(*) FROM credit_cards    WHERE user_id IS NULL;
-- SELECT COUNT(*) FROM investments     WHERE user_id IS NULL;

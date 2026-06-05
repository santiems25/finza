-- ============================================================
-- FINZA — Migración 003: RLS con autenticación real
-- Corré esto DESPUÉS de crear tu usuario en Supabase Auth.
-- Hace que la DB solo acepte requests autenticados.
-- ============================================================

-- ─── Reemplazar políticas abiertas por políticas con auth ─────────────────────

-- credit_cards
DROP POLICY IF EXISTS "allow_all" ON credit_cards;
CREATE POLICY "authenticated_only" ON credit_cards
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- credit_card_monthly_config
DROP POLICY IF EXISTS "allow_all" ON credit_card_monthly_config;
CREATE POLICY "authenticated_only" ON credit_card_monthly_config
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- expenses
DROP POLICY IF EXISTS "allow_all" ON expenses;
CREATE POLICY "authenticated_only" ON expenses
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- billing_payments
DROP POLICY IF EXISTS "allow_all" ON billing_payments;
CREATE POLICY "authenticated_only" ON billing_payments
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- incomes
DROP POLICY IF EXISTS "allow_all" ON incomes;
CREATE POLICY "authenticated_only" ON incomes
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- investments
DROP POLICY IF EXISTS "allow_all" ON investments;
CREATE POLICY "authenticated_only" ON investments
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ============================================================
-- FINZA — Migración 004: Tabla de dividendos
-- Corré esto en el SQL Editor de Supabase.
-- Requiere haber corrido previamente 003_rls_auth.sql.
-- ============================================================

CREATE TABLE dividends (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticker     TEXT NOT NULL,
  amount     NUMERIC(12, 4) NOT NULL CHECK (amount > 0),  -- siempre en USD
  date       DATE NOT NULL,
  notes      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dividends_ticker ON dividends (ticker);
CREATE INDEX idx_dividends_date   ON dividends (date DESC);

ALTER TABLE dividends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_only" ON dividends
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

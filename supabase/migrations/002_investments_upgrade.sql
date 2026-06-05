-- ============================================================
-- FINZA — Migración 002: Upgrade de tabla investments
-- Corré esto en el SQL Editor de Supabase si ya tenías el
-- schema anterior (001_schema.sql) aplicado.
-- ============================================================

-- 1. Nuevo enum para tipo de asset
CREATE TYPE asset_type AS ENUM (
  'accion', 'etf', 'cedear', 'bono', 'cripto', 'otro'
);

-- 2. Agregar columnas nuevas a la tabla investments
ALTER TABLE investments
  ADD COLUMN asset_type  asset_type NOT NULL DEFAULT 'accion',
  ADD COLUMN is_sold     BOOLEAN    NOT NULL DEFAULT false,
  ADD COLUMN sell_price  NUMERIC(12, 4) CHECK (sell_price > 0),
  ADD COLUMN sell_date   DATE;

-- 3. Índice para filtrar activas vs vendidas rápido
CREATE INDEX idx_investments_is_sold ON investments (is_sold);

-- 4. Vista: posiciones agrupadas por ticker (solo activas)
CREATE VIEW portfolio_positions AS
SELECT
  ticker,
  asset_type,
  SUM(quantity)             AS total_qty,
  SUM(quantity * buy_price) AS total_cost,
  AVG(buy_price)            AS avg_buy_price,
  MIN(buy_date)             AS first_buy_date,
  MAX(buy_date)             AS last_buy_date,
  COUNT(*)                  AS lot_count
FROM investments
WHERE is_sold = false
GROUP BY ticker, asset_type
ORDER BY total_cost DESC;

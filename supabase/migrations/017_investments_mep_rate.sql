-- Todas las compras/ventas de inversiones se pagan en pesos al tipo de
-- cambio MEP vigente en el momento (aunque el activo se valorice en USD).
-- Guardamos la cotización usada en cada punta para poder reconstruir el
-- movimiento real de pesos de la cuenta de Inversiones sin depender de la
-- cotización actual (que cambia todo el tiempo).
ALTER TABLE investments ADD COLUMN IF NOT EXISTS buy_rate  NUMERIC;
ALTER TABLE investments ADD COLUMN IF NOT EXISTS sell_rate NUMERIC;

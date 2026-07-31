-- Marca gastos/ingresos generados a partir de un movimiento recurrente
-- (alquiler, sueldo, etc.). No dispara generación automática por sí sola:
-- el frontend crea las filas de los próximos meses al guardar.
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE incomes  ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN NOT NULL DEFAULT false;

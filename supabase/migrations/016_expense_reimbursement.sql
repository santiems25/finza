-- Gastos compartidos: permite registrar cuánto te reembolsaron y a qué
-- cuenta, sin crear un ingreso aparte. El monto "real" (amount) sigue
-- siendo el total de la compra — se usa igual en el resumen de la tarjeta.
-- Lo que cuenta como gasto personal en Inicio se calcula como
-- amount - reimbursed_amount.
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS reimbursed_amount NUMERIC;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS reimbursed_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL;

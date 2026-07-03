-- Cuentas bancarias / billeteras por usuario
CREATE TABLE IF NOT EXISTS accounts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  currency     TEXT NOT NULL DEFAULT 'ARS',
  account_type TEXT NOT NULL DEFAULT 'bank',   -- 'bank' | 'wallet' | 'cash'
  initial_ars  NUMERIC NOT NULL DEFAULT 0,
  initial_usd  NUMERIC NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "accounts_owner" ON accounts
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Vincular tarjetas a una cuenta
ALTER TABLE credit_cards ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id) ON DELETE SET NULL;

-- Vincular gastos a una cuenta
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id) ON DELETE SET NULL;

-- Vincular ingresos a una cuenta
ALTER TABLE incomes ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id) ON DELETE SET NULL;

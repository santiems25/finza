-- ═══════════════════════════════════════════════════════════════════
-- 012: Transferencias entre cuentas, FX por cuenta, y migración de
--      categorías base a categorías personalizadas por usuario
-- ═══════════════════════════════════════════════════════════════════

-- 1. Transferencias entre cuentas
CREATE TABLE IF NOT EXISTS account_transfers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  to_account_id   UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  amount          NUMERIC NOT NULL CHECK (amount > 0),
  currency        TEXT NOT NULL CHECK (currency IN ('ARS','USD')),
  date            DATE NOT NULL DEFAULT CURRENT_DATE,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transfers_user ON account_transfers(user_id);

ALTER TABLE account_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "transfers_owner" ON account_transfers
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 2. Compras de dólares asociadas a una cuenta (opcional)
ALTER TABLE fx_transactions ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id) ON DELETE SET NULL;

-- 3. La columna category era un ENUM (expense_category): convertirla a TEXT
--    para poder guardar ids de categorías personalizadas (custom_<uuid>).
ALTER TABLE expenses ALTER COLUMN category DROP DEFAULT;
ALTER TABLE expenses ALTER COLUMN category TYPE TEXT USING category::text;
DROP TYPE IF EXISTS expense_category;

-- 4. Migrar categorías base a categorías personalizadas por usuario.
--    Para cada usuario con gastos: crea sus categorías (solo las que usa)
--    y re-apunta los gastos a `custom_<uuid>`.
DO $$
DECLARE
  u   RECORD;
  cat RECORD;
  new_id UUID;
BEGIN
  FOR u IN SELECT DISTINCT user_id FROM expenses LOOP
    FOR cat IN
      SELECT * FROM (VALUES
        ('oficina',       'Oficina',       '☕'),
        ('juntada',       'Juntada',       '🍻'),
        ('comida_afuera', 'Comida afuera', '🍽️'),
        ('peluqueria',    'Peluquería',    '✂️'),
        ('gym',           'Gym',           '🏋️'),
        ('ropa',          'Ropa',          '👕'),
        ('viaje',         'Viaje',         '✈️'),
        ('bolucompra',    'Bolucompra',    '🛍️'),
        ('salida',        'Salida',        '🎉'),
        ('regalo',        'Regalo',        '🎁'),
        ('otros',         'Otros',         '📦')
      ) AS t(slug, name, icon)
    LOOP
      IF EXISTS (
        SELECT 1 FROM expenses
        WHERE user_id = u.user_id AND category = cat.slug
      ) THEN
        -- Evitar duplicados si ya existe una categoría con ese nombre
        SELECT id INTO new_id FROM expense_categories
        WHERE user_id = u.user_id AND name = cat.name
        LIMIT 1;

        IF new_id IS NULL THEN
          INSERT INTO expense_categories (user_id, name, icon)
          VALUES (u.user_id, cat.name, cat.icon)
          RETURNING id INTO new_id;
        END IF;

        UPDATE expenses
        SET category = 'custom_' || new_id
        WHERE user_id = u.user_id AND category = cat.slug;

        new_id := NULL;
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- Fix: nueva lógica de asignación de período de facturación.
--
-- Regla según closing_day:
--   closing_day < 15  → el cierre cae en el MES SIGUIENTE al mes del resumen
--     · expense_day <  closing_day → resumen del mes ANTERIOR al gasto
--     · expense_day >= closing_day → resumen del mes del gasto
--
--   closing_day >= 15 → el cierre cae en el MISMO mes del resumen
--     · expense_day <  closing_day → resumen del mes del gasto
--     · expense_day >= closing_day → resumen del mes SIGUIENTE al gasto

CREATE OR REPLACE FUNCTION calculate_billing_period()
RETURNS TRIGGER AS $$
DECLARE
  v_closing_day   SMALLINT;
  v_expense_day   SMALLINT;
  v_expense_month SMALLINT;
  v_expense_year  SMALLINT;
  v_bill_month    SMALLINT;
  v_bill_year     SMALLINT;
  v_month_names   TEXT[] := ARRAY[
    'Enero','Febrero','Marzo','Abril','Mayo','Junio',
    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
  ];
BEGIN
  IF NEW.payment_method = 'credito' AND NEW.credit_card_id IS NOT NULL THEN
    v_expense_day   := EXTRACT(DAY   FROM NEW.date)::SMALLINT;
    v_expense_month := (EXTRACT(MONTH FROM NEW.date) - 1)::SMALLINT;  -- 0-indexed
    v_expense_year  := EXTRACT(YEAR  FROM NEW.date)::SMALLINT;

    -- 1. Buscar override mensual
    SELECT closing_day INTO v_closing_day
    FROM credit_card_monthly_config
    WHERE credit_card_id = NEW.credit_card_id
      AND month = v_expense_month
      AND year  = v_expense_year;

    -- 2. Si no hay override, usar el día habitual del card
    IF NOT FOUND THEN
      SELECT closing_day INTO v_closing_day
      FROM credit_cards WHERE id = NEW.credit_card_id;
    END IF;

    v_bill_month := v_expense_month;
    v_bill_year  := v_expense_year;

    IF v_closing_day < 15 THEN
      -- El cierre cae en el mes siguiente: si el gasto es ANTES del cierre
      -- pertenece al resumen del mes anterior.
      IF v_expense_day < v_closing_day THEN
        v_bill_month := v_bill_month - 1;
        IF v_bill_month < 0 THEN
          v_bill_month := 11;
          v_bill_year  := v_bill_year - 1;
        END IF;
      END IF;
    ELSE
      -- El cierre cae en el mismo mes: si el gasto es EN o DESPUÉS del cierre
      -- pertenece al resumen del mes siguiente.
      IF v_expense_day >= v_closing_day THEN
        v_bill_month := v_bill_month + 1;
        IF v_bill_month > 11 THEN
          v_bill_month := 0;
          v_bill_year  := v_bill_year + 1;
        END IF;
      END IF;
    END IF;

    NEW.billing_month  := v_bill_month;
    NEW.billing_year   := v_bill_year;
    NEW.billing_period := v_month_names[v_bill_month + 1] || ' ' || v_bill_year::TEXT;
  ELSE
    NEW.billing_month  := NULL;
    NEW.billing_year   := NULL;
    NEW.billing_period := NULL;
    NEW.credit_card_id := NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

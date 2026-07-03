-- Actualiza el trigger de billing_period para usar cierre INCLUSIVO:
-- El día de cierre mismo pertenece al resumen actual (no al siguiente).

CREATE OR REPLACE FUNCTION calculate_billing_period()
RETURNS TRIGGER AS $$
DECLARE
  v_closing_day  INT;
  v_expense_day  INT;
  v_month        INT;
  v_year         INT;
  v_card         RECORD;
  v_override     RECORD;
BEGIN
  IF NEW.payment_method <> 'credito' OR NEW.credit_card_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_card FROM credit_cards WHERE id = NEW.credit_card_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  v_expense_day := EXTRACT(DAY FROM NEW.date::date)::INT;
  v_month       := EXTRACT(MONTH FROM NEW.date::date)::INT - 1; -- 0-indexed
  v_year        := EXTRACT(YEAR  FROM NEW.date::date)::INT;

  -- Buscar override mensual
  SELECT * INTO v_override
  FROM credit_card_monthly_config
  WHERE credit_card_id = NEW.credit_card_id
    AND month = v_month
    AND year  = v_year;

  v_closing_day := COALESCE(v_override.closing_day, v_card.closing_day);

  -- Cierre INCLUSIVO:
  IF v_closing_day < 15 THEN
    -- Cierre en mes siguiente: gastos <= día de cierre van al mes anterior
    IF v_expense_day <= v_closing_day THEN
      v_month := v_month - 1;
      IF v_month < 0 THEN v_month := 11; v_year := v_year - 1; END IF;
    END IF;
  ELSE
    -- Cierre en mismo mes: gastos > día de cierre van al mes siguiente
    IF v_expense_day > v_closing_day THEN
      v_month := v_month + 1;
      IF v_month > 11 THEN v_month := 0; v_year := v_year + 1; END IF;
    END IF;
  END IF;

  NEW.billing_month  := v_month;
  NEW.billing_year   := v_year;
  NEW.billing_period := (ARRAY['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                                'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'])[v_month + 1]
                        || ' ' || v_year;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

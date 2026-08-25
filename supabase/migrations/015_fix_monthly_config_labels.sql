-- La migración 014 cambió la convención de "resumen" para que se llame como
-- el mes en que CIERRA (no el mes en que arrancan las compras). Pero los
-- overrides mensuales que ya habías guardado en Tarjetas (fechas exactas de
-- cierre/vencimiento) quedaron con la etiqueta VIEJA: la fila "Agosto" podía
-- tener una closing_date real de "2 de septiembre".
--
-- Esta migración realinea cada fila para que su (month, year) coincida con
-- el mes/año real en que cae su closing_date, resolviendo también las filas
-- que solo tenían closing_day (sin fecha exacta) reconstruyendo la fecha de
-- cierre real con la fórmula vieja (heurística <15).
DO $$
DECLARE
  r              RECORD;
  base_date      DATE;
  old_close_date DATE;
  new_month      INT;
  new_year       INT;
BEGIN
  FOR r IN SELECT * FROM credit_card_monthly_config LOOP
    IF r.closing_date IS NOT NULL THEN
      old_close_date := r.closing_date;
    ELSE
      base_date := make_date(r.year, r.month + 1, 1);
      IF r.closing_day < 15 THEN
        old_close_date := (base_date + INTERVAL '1 month')::date + (r.closing_day - 1);
      ELSE
        old_close_date := base_date + (r.closing_day - 1);
      END IF;
    END IF;

    new_month := EXTRACT(MONTH FROM old_close_date)::int - 1;
    new_year  := EXTRACT(YEAR  FROM old_close_date)::int;

    IF new_month = r.month AND new_year = r.year THEN
      CONTINUE; -- ya está alineada
    END IF;

    BEGIN
      UPDATE credit_card_monthly_config
      SET month = new_month, year = new_year
      WHERE id = r.id;
    EXCEPTION WHEN unique_violation THEN
      RAISE NOTICE 'No se pudo realinear la fila % (ya existe otra fila para ese mes/año)', r.id;
    END;
  END LOOP;
END $$;

-- Los gastos ya guardados con billing_month/billing_year calculados antes
-- de este cambio no se tocan: solo afecta a los defaults/overrides que se
-- usan de acá en adelante en Tarjetas y en nuevos gastos.

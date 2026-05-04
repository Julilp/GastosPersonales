-- =============================================================
-- Migration: update_get_resumen_mes_exclude_traspaso
-- Description: Excluye movimientos de tipo 'traspaso' de total_ingresos,
--              total_egresos y balance en get_resumen_mes.
-- Rollback: Recrear la función sin la condición AND m.tipo != 'traspaso'
--           (ver versión anterior en schema.sql sección 9).
-- =============================================================

CREATE OR REPLACE FUNCTION Gastos_personales.get_resumen_mes(
  p_mes  INT,
  p_anio INT
)
RETURNS TABLE (
  cuenta_id      BIGINT,
  cuenta_nombre  TEXT,
  cuenta_tipo    TEXT,
  moneda         TEXT,
  total_ingresos NUMERIC,
  total_egresos  NUMERIC,
  balance        NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = Gastos_personales
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id                                                                                               AS cuenta_id,
    c.nombre                                                                                           AS cuenta_nombre,
    c.tipo::TEXT                                                                                       AS cuenta_tipo,
    m.moneda::TEXT                                                                                     AS moneda,
    COALESCE(SUM(m.monto) FILTER (WHERE m.tipo = 'ingreso'  AND m.tipo != 'traspaso'), 0)             AS total_ingresos,
    COALESCE(SUM(m.monto) FILTER (WHERE m.tipo = 'egreso'   AND m.tipo != 'traspaso'), 0)             AS total_egresos,
    COALESCE(SUM(m.monto) FILTER (WHERE m.tipo = 'ingreso'  AND m.tipo != 'traspaso'), 0)
    - COALESCE(SUM(m.monto) FILTER (WHERE m.tipo = 'egreso' AND m.tipo != 'traspaso'), 0)             AS balance
  FROM Gastos_personales.movimientos m
  JOIN Gastos_personales.cuentas c ON c.id = m.cuenta_id
  WHERE
    m.user_id = auth.uid()
    AND m.tipo != 'traspaso'
    AND EXTRACT(MONTH FROM m.fecha)::INT = p_mes
    AND EXTRACT(YEAR  FROM m.fecha)::INT = p_anio
  GROUP BY c.id, c.nombre, c.tipo, m.moneda
  ORDER BY c.orden, m.moneda;
END;
$$;

GRANT EXECUTE ON FUNCTION Gastos_personales.get_resumen_mes(INT, INT) TO authenticated;

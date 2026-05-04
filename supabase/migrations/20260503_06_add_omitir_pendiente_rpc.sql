-- =============================================================
-- MIGRACIÓN: omitir_pendiente RPC
-- Schema: Gastos_personales
-- Fecha: 2026-05-03
-- Descripción: RPC para que el cliente registre un item como
--              omitido. Usa ON CONFLICT DO NOTHING para ser
--              idempotente (doble click no falla).
-- Depende de: migración 04 (pendientes_omitidos)
-- =============================================================
-- ROLLBACK documentado al final del archivo
-- =============================================================


CREATE OR REPLACE FUNCTION Gastos_personales.omitir_pendiente(
  p_tipo          TEXT,
  p_referencia_id BIGINT,
  p_mes           INT,
  p_anio          INT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = Gastos_personales
AS $$
BEGIN
  IF p_tipo NOT IN ('recurrente', 'cuota') THEN
    RAISE EXCEPTION 'tipo inválido: %. Valores permitidos: recurrente, cuota', p_tipo;
  END IF;

  INSERT INTO Gastos_personales.pendientes_omitidos (user_id, tipo, referencia_id, mes, anio)
  VALUES (auth.uid(), p_tipo, p_referencia_id, p_mes, p_anio)
  ON CONFLICT (user_id, tipo, referencia_id, mes, anio) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION Gastos_personales.omitir_pendiente(TEXT, BIGINT, INT, INT) TO authenticated;


-- =============================================================
-- ROLLBACK
-- =============================================================
/*
  DROP FUNCTION IF EXISTS Gastos_personales.omitir_pendiente(TEXT, BIGINT, INT, INT);
*/

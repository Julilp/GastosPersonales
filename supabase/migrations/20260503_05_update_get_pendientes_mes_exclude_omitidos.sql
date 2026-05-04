-- =============================================================
-- MIGRACIÓN: get_pendientes_mes — excluir omitidos
-- Schema: Gastos_personales
-- Fecha: 2026-05-03
-- Descripción: Actualiza get_pendientes_mes para filtrar items
--              que el usuario desestimó (existen en
--              pendientes_omitidos para el mes/año consultado).
-- Depende de: migración 04 (pendientes_omitidos)
-- =============================================================
-- ROLLBACK documentado al final del archivo
-- =============================================================


CREATE OR REPLACE FUNCTION Gastos_personales.get_pendientes_mes(
  p_mes  INT,
  p_anio INT
)
RETURNS TABLE (
  recurrentes_pendientes  JSONB,
  cuotas_pendientes       JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = Gastos_personales
AS $$
DECLARE
  v_uid              UUID := auth.uid();
  v_recurrentes_json JSONB;
  v_cuotas_json      JSONB;
BEGIN

  -- -------------------------------------------------------
  -- Recurrentes activos que:
  --   1. NO fueron aplicados en p_mes/p_anio
  --   2. NO fueron omitidos en p_mes/p_anio
  -- -------------------------------------------------------
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id',           r.id,
        'tipo',         r.tipo,
        'monto',        r.monto,
        'moneda',       r.moneda,
        'descripcion',  r.descripcion,
        'dia_del_mes',  r.dia_del_mes,
        'cuenta',       jsonb_build_object('id', c.id, 'nombre', c.nombre),
        'categoria',    jsonb_build_object('id', cat.id, 'nombre', cat.nombre, 'icono', cat.icono)
      )
      ORDER BY r.dia_del_mes, r.id
    ),
    '[]'::JSONB
  )
  INTO v_recurrentes_json
  FROM Gastos_personales.recurrentes r
  JOIN Gastos_personales.cuentas     c   ON c.id   = r.cuenta_id
  JOIN Gastos_personales.categorias  cat ON cat.id = r.categoria_id
  WHERE
    r.user_id = v_uid
    AND r.activo = true
    AND NOT EXISTS (
      SELECT 1
      FROM Gastos_personales.recurrentes_aplicados ra
      WHERE
        ra.recurrente_id = r.id
        AND ra.user_id   = v_uid
        AND ra.mes       = p_mes::SMALLINT
        AND ra.anio      = p_anio::SMALLINT
    )
    AND NOT EXISTS (
      SELECT 1
      FROM Gastos_personales.pendientes_omitidos po
      WHERE
        po.user_id       = v_uid
        AND po.tipo          = 'recurrente'
        AND po.referencia_id = r.id
        AND po.mes           = p_mes
        AND po.anio          = p_anio
    );

  -- -------------------------------------------------------
  -- Cuotas activas con cuotas pendientes de pago que:
  --   1. NO fueron omitidas en p_mes/p_anio
  -- -------------------------------------------------------
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id',               cu.id,
        'descripcion',      cu.descripcion,
        'monto_cuota',      cu.monto_cuota,
        'moneda',           cu.moneda,
        'cuotas_pagadas',   cu.cuotas_pagadas,
        'cantidad_cuotas',  cu.cantidad_cuotas,
        'cuenta',           jsonb_build_object('id', c.id, 'nombre', c.nombre),
        'categoria',        jsonb_build_object('id', cat.id, 'nombre', cat.nombre, 'icono', cat.icono)
      )
      ORDER BY cu.fecha_inicio, cu.id
    ),
    '[]'::JSONB
  )
  INTO v_cuotas_json
  FROM Gastos_personales.cuotas      cu
  JOIN Gastos_personales.cuentas     c   ON c.id   = cu.cuenta_id
  JOIN Gastos_personales.categorias  cat ON cat.id = cu.categoria_id
  WHERE
    cu.user_id = v_uid
    AND cu.activa = true
    AND cu.cuotas_pagadas < cu.cantidad_cuotas
    AND NOT EXISTS (
      SELECT 1
      FROM Gastos_personales.pendientes_omitidos po
      WHERE
        po.user_id       = v_uid
        AND po.tipo          = 'cuota'
        AND po.referencia_id = cu.id
        AND po.mes           = p_mes
        AND po.anio          = p_anio
    );

  RETURN QUERY SELECT v_recurrentes_json, v_cuotas_json;

END;
$$;

GRANT EXECUTE ON FUNCTION Gastos_personales.get_pendientes_mes(INT, INT) TO authenticated;


-- =============================================================
-- ROLLBACK — restaura la versión anterior sin filtro de omitidos
-- =============================================================
/*
CREATE OR REPLACE FUNCTION Gastos_personales.get_pendientes_mes(
  p_mes  INT,
  p_anio INT
)
RETURNS TABLE (
  recurrentes_pendientes  JSONB,
  cuotas_pendientes       JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = Gastos_personales
AS $$
DECLARE
  v_uid              UUID := auth.uid();
  v_recurrentes_json JSONB;
  v_cuotas_json      JSONB;
BEGIN

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id',           r.id,
        'tipo',         r.tipo,
        'monto',        r.monto,
        'moneda',       r.moneda,
        'descripcion',  r.descripcion,
        'dia_del_mes',  r.dia_del_mes,
        'cuenta',       jsonb_build_object('id', c.id, 'nombre', c.nombre),
        'categoria',    jsonb_build_object('id', cat.id, 'nombre', cat.nombre, 'icono', cat.icono)
      )
      ORDER BY r.dia_del_mes, r.id
    ),
    '[]'::JSONB
  )
  INTO v_recurrentes_json
  FROM Gastos_personales.recurrentes r
  JOIN Gastos_personales.cuentas     c   ON c.id   = r.cuenta_id
  JOIN Gastos_personales.categorias  cat ON cat.id = r.categoria_id
  WHERE
    r.user_id = v_uid
    AND r.activo = true
    AND NOT EXISTS (
      SELECT 1
      FROM Gastos_personales.recurrentes_aplicados ra
      WHERE
        ra.recurrente_id = r.id
        AND ra.user_id   = v_uid
        AND ra.mes       = p_mes::SMALLINT
        AND ra.anio      = p_anio::SMALLINT
    );

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id',               cu.id,
        'descripcion',      cu.descripcion,
        'monto_cuota',      cu.monto_cuota,
        'moneda',           cu.moneda,
        'cuotas_pagadas',   cu.cuotas_pagadas,
        'cantidad_cuotas',  cu.cantidad_cuotas,
        'cuenta',           jsonb_build_object('id', c.id, 'nombre', c.nombre),
        'categoria',        jsonb_build_object('id', cat.id, 'nombre', cat.nombre, 'icono', cat.icono)
      )
      ORDER BY cu.fecha_inicio, cu.id
    ),
    '[]'::JSONB
  )
  INTO v_cuotas_json
  FROM Gastos_personales.cuotas      cu
  JOIN Gastos_personales.cuentas     c   ON c.id   = cu.cuenta_id
  JOIN Gastos_personales.categorias  cat ON cat.id = cu.categoria_id
  WHERE
    cu.user_id = v_uid
    AND cu.activa = true
    AND cu.cuotas_pagadas < cu.cantidad_cuotas;

  RETURN QUERY SELECT v_recurrentes_json, v_cuotas_json;

END;
$$;

GRANT EXECUTE ON FUNCTION Gastos_personales.get_pendientes_mes(INT, INT) TO authenticated;
*/

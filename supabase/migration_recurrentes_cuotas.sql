-- =============================================================
-- MIGRACIÓN: Recurrentes y Cuotas
-- Schema: Gastos_personales
-- Fecha: 2026-04-30
-- Descripción: Agrega gestión de gastos/ingresos recurrentes
--              y compras en cuotas. Ambas features son manuales:
--              el usuario aplica cada registro mes a mes.
-- =============================================================
-- ROLLBACK documentado al final del archivo
-- =============================================================


-- =============================================================
-- 1. TABLA: recurrentes
--    Templates de gastos/ingresos fijos mensuales.
--    NO se auto-aplican — el usuario los aplica manualmente.
-- =============================================================

CREATE TABLE IF NOT EXISTS Gastos_personales.recurrentes (
  id            BIGSERIAL                              PRIMARY KEY,
  user_id       UUID                                   NOT NULL DEFAULT auth.uid()
                  REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo          Gastos_personales.tipo_movimiento      NOT NULL,
  monto         NUMERIC(14, 2)                         NOT NULL CHECK (monto > 0),
  moneda        Gastos_personales.moneda               NOT NULL DEFAULT 'ARS',
  cuenta_id     BIGINT                                 NOT NULL
                  REFERENCES Gastos_personales.cuentas(id) ON DELETE RESTRICT,
  categoria_id  BIGINT                                 NOT NULL
                  REFERENCES Gastos_personales.categorias(id) ON DELETE RESTRICT,
  descripcion   TEXT                                   NOT NULL,
  dia_del_mes   SMALLINT                               NOT NULL DEFAULT 1
                  CHECK (dia_del_mes BETWEEN 1 AND 31),
  activo        BOOLEAN                                NOT NULL DEFAULT true,
  creado_en     TIMESTAMPTZ                            NOT NULL DEFAULT now()
);

COMMENT ON TABLE  Gastos_personales.recurrentes              IS 'Templates de gastos/ingresos fijos mensuales. El usuario los aplica manualmente cada mes.';
COMMENT ON COLUMN Gastos_personales.recurrentes.dia_del_mes  IS 'Dia estimado del mes en que cae el gasto/ingreso (1-31). Solo referencial.';
COMMENT ON COLUMN Gastos_personales.recurrentes.activo       IS 'false = archivado, no aparece en pendientes del mes.';


-- =============================================================
-- 2. TABLA: recurrentes_aplicados
--    Registro de qué recurrente se aplicó en qué mes/año.
--    La UNIQUE (user_id, recurrente_id, mes, anio) evita doble aplicación.
-- =============================================================

CREATE TABLE IF NOT EXISTS Gastos_personales.recurrentes_aplicados (
  id             BIGSERIAL    PRIMARY KEY,
  user_id        UUID         NOT NULL DEFAULT auth.uid()
                   REFERENCES auth.users(id) ON DELETE CASCADE,
  recurrente_id  BIGINT       NOT NULL
                   REFERENCES Gastos_personales.recurrentes(id) ON DELETE CASCADE,
  mes            SMALLINT     NOT NULL CHECK (mes BETWEEN 1 AND 12),
  anio           SMALLINT     NOT NULL CHECK (anio BETWEEN 2000 AND 2100),
  movimiento_id  BIGINT
                   REFERENCES Gastos_personales.movimientos(id) ON DELETE SET NULL,
  creado_en      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT recurrentes_aplicados_unique UNIQUE (user_id, recurrente_id, mes, anio)
);

COMMENT ON TABLE  Gastos_personales.recurrentes_aplicados               IS 'Historial de aplicaciones mensuales de cada recurrente. Previene doble aplicacion.';
COMMENT ON COLUMN Gastos_personales.recurrentes_aplicados.movimiento_id IS 'NULL si el movimiento fue eliminado posteriormente (ON DELETE SET NULL).';


-- =============================================================
-- 3. TABLA: cuotas
--    Compras en cuotas. El usuario registra la compra y aplica
--    cada cuota manualmente mes a mes.
-- =============================================================

CREATE TABLE IF NOT EXISTS Gastos_personales.cuotas (
  id                BIGSERIAL                        PRIMARY KEY,
  user_id           UUID                             NOT NULL DEFAULT auth.uid()
                      REFERENCES auth.users(id) ON DELETE CASCADE,
  descripcion       TEXT                             NOT NULL,
  monto_total       NUMERIC(14, 2)                   NOT NULL CHECK (monto_total > 0),
  monto_cuota       NUMERIC(14, 2)                   NOT NULL CHECK (monto_cuota > 0),
  cantidad_cuotas   SMALLINT                         NOT NULL CHECK (cantidad_cuotas > 0),
  cuotas_pagadas    SMALLINT                         NOT NULL DEFAULT 0
                      CHECK (cuotas_pagadas >= 0),
  cuenta_id         BIGINT                           NOT NULL
                      REFERENCES Gastos_personales.cuentas(id) ON DELETE RESTRICT,
  categoria_id      BIGINT                           NOT NULL
                      REFERENCES Gastos_personales.categorias(id) ON DELETE RESTRICT,
  moneda            Gastos_personales.moneda         NOT NULL DEFAULT 'ARS',
  fecha_inicio      DATE                             NOT NULL DEFAULT CURRENT_DATE,
  activa            BOOLEAN                          NOT NULL DEFAULT true,
  creado_en         TIMESTAMPTZ                      NOT NULL DEFAULT now(),
  CONSTRAINT cuotas_pagadas_no_excede CHECK (cuotas_pagadas <= cantidad_cuotas)
);

COMMENT ON TABLE  Gastos_personales.cuotas              IS 'Compras en cuotas. Cada cuota se aplica manualmente cada mes.';
COMMENT ON COLUMN Gastos_personales.cuotas.fecha_inicio IS 'Fecha de la primera cuota. Sirve como referencia del mes de inicio.';
COMMENT ON COLUMN Gastos_personales.cuotas.activa       IS 'Se vuelve false cuando cuotas_pagadas = cantidad_cuotas, o si el usuario la archiva.';


-- =============================================================
-- 4. ÍNDICES
-- =============================================================

-- recurrentes
CREATE INDEX IF NOT EXISTS idx_recurrentes_user_activo
  ON Gastos_personales.recurrentes (user_id, activo);

-- recurrentes_aplicados
CREATE INDEX IF NOT EXISTS idx_recurrentes_aplicados_user_mes_anio
  ON Gastos_personales.recurrentes_aplicados (user_id, mes, anio);

CREATE INDEX IF NOT EXISTS idx_recurrentes_aplicados_recurrente_id
  ON Gastos_personales.recurrentes_aplicados (recurrente_id);

-- cuotas
CREATE INDEX IF NOT EXISTS idx_cuotas_user_activa
  ON Gastos_personales.cuotas (user_id, activa);

CREATE INDEX IF NOT EXISTS idx_cuotas_user_fecha_inicio
  ON Gastos_personales.cuotas (user_id, fecha_inicio);


-- =============================================================
-- 5. RLS
-- =============================================================

ALTER TABLE Gastos_personales.recurrentes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE Gastos_personales.recurrentes_aplicados ENABLE ROW LEVEL SECURITY;
ALTER TABLE Gastos_personales.cuotas               ENABLE ROW LEVEL SECURITY;

-- recurrentes
CREATE POLICY "recurrentes_select" ON Gastos_personales.recurrentes
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "recurrentes_insert" ON Gastos_personales.recurrentes
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "recurrentes_update" ON Gastos_personales.recurrentes
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "recurrentes_delete" ON Gastos_personales.recurrentes
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- recurrentes_aplicados
CREATE POLICY "recurrentes_aplicados_select" ON Gastos_personales.recurrentes_aplicados
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "recurrentes_aplicados_insert" ON Gastos_personales.recurrentes_aplicados
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "recurrentes_aplicados_update" ON Gastos_personales.recurrentes_aplicados
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "recurrentes_aplicados_delete" ON Gastos_personales.recurrentes_aplicados
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- cuotas
CREATE POLICY "cuotas_select" ON Gastos_personales.cuotas
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "cuotas_insert" ON Gastos_personales.cuotas
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "cuotas_update" ON Gastos_personales.cuotas
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "cuotas_delete" ON Gastos_personales.cuotas
  FOR DELETE TO authenticated USING (user_id = auth.uid());


-- =============================================================
-- 6. RPC: get_pendientes_mes(p_mes INT, p_anio INT)
--
--    Devuelve dos columnas JSONB:
--      recurrentes_pendientes: recurrentes activos sin registro
--        en recurrentes_aplicados para el mes/año pedido.
--      cuotas_pendientes: cuotas activas con cuotas_pagadas < cantidad_cuotas.
--
--    Usa SECURITY DEFINER para leer a través de RLS con auth.uid().
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
  -- Recurrentes activos que NO fueron aplicados en p_mes/p_anio
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
    );

  -- -------------------------------------------------------
  -- Cuotas activas con cuotas pendientes de pago
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
    AND cu.cuotas_pagadas < cu.cantidad_cuotas;

  RETURN QUERY SELECT v_recurrentes_json, v_cuotas_json;

END;
$$;

GRANT EXECUTE ON FUNCTION Gastos_personales.get_pendientes_mes(INT, INT) TO authenticated;


-- =============================================================
-- ROLLBACK (documentado — NO ejecutar en producción sin confirmar)
-- =============================================================
/*
  -- Eliminar RPC
  DROP FUNCTION IF EXISTS Gastos_personales.get_pendientes_mes(INT, INT);

  -- Eliminar tablas (CASCADE borra policies e índices asociados)
  DROP TABLE IF EXISTS Gastos_personales.recurrentes_aplicados CASCADE;
  DROP TABLE IF EXISTS Gastos_personales.cuotas               CASCADE;
  DROP TABLE IF EXISTS Gastos_personales.recurrentes          CASCADE;
*/

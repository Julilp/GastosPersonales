-- =============================================================
-- GASTOS PERSONALES — Schema Supabase
-- Schema: Gastos_personales
-- Auth: Supabase Auth nativo (auth.uid())
-- Moneda: ARS / USD  |  Locale: es-AR
-- =============================================================


-- =============================================================
-- 1. SCHEMA
-- =============================================================

CREATE SCHEMA IF NOT EXISTS Gastos_personales;

GRANT USAGE ON SCHEMA Gastos_personales TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA Gastos_personales GRANT ALL ON TABLES    TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA Gastos_personales GRANT ALL ON SEQUENCES TO authenticated;


-- =============================================================
-- 2. EXTENSIONES
-- =============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- =============================================================
-- 3. TIPOS ENUM
-- =============================================================

DO $$ BEGIN
  CREATE TYPE Gastos_personales.tipo_cuenta AS ENUM ('mercado_pago', 'banco', 'efectivo', 'tarjeta_credito');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE Gastos_personales.tipo_movimiento AS ENUM ('egreso', 'ingreso');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE Gastos_personales.moneda AS ENUM ('ARS', 'USD');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- =============================================================
-- 4. TABLAS
-- =============================================================

-- -------------------------------------------------------------
-- 4.1 cuentas
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Gastos_personales.cuentas (
  id         BIGSERIAL                            PRIMARY KEY,
  user_id    UUID                                 NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre     TEXT                                 NOT NULL,
  tipo       Gastos_personales.tipo_cuenta        NOT NULL,
  activa     BOOLEAN                              NOT NULL DEFAULT true,
  orden      INTEGER                              NOT NULL DEFAULT 0,
  creado_en  TIMESTAMPTZ                          NOT NULL DEFAULT now(),
  CONSTRAINT cuentas_nombre_user_unique UNIQUE (user_id, nombre)
);

-- -------------------------------------------------------------
-- 4.2 categorias
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Gastos_personales.categorias (
  id         BIGSERIAL   PRIMARY KEY,
  user_id    UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre     TEXT        NOT NULL,
  icono      TEXT        NOT NULL DEFAULT '📦',
  es_default BOOLEAN     NOT NULL DEFAULT false,
  parent_id  BIGINT      REFERENCES Gastos_personales.categorias(id) ON DELETE CASCADE,
  creado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT categorias_nombre_parent_user_unique UNIQUE (user_id, parent_id, nombre)
);

-- -------------------------------------------------------------
-- 4.3 movimientos
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Gastos_personales.movimientos (
  id           BIGSERIAL                          PRIMARY KEY,
  user_id      UUID                               NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo         Gastos_personales.tipo_movimiento  NOT NULL,
  monto        NUMERIC(14, 2)                     NOT NULL CHECK (monto > 0),
  moneda       Gastos_personales.moneda           NOT NULL DEFAULT 'ARS',
  cuenta_id    BIGINT                             NOT NULL REFERENCES Gastos_personales.cuentas(id) ON DELETE RESTRICT,
  categoria_id BIGINT                             NOT NULL REFERENCES Gastos_personales.categorias(id) ON DELETE RESTRICT,
  descripcion  TEXT,
  fecha        DATE                               NOT NULL DEFAULT CURRENT_DATE,
  creado_en    TIMESTAMPTZ                        NOT NULL DEFAULT now()
);

-- -------------------------------------------------------------
-- 4.4 presupuestos
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Gastos_personales.presupuestos (
  id            BIGSERIAL                        PRIMARY KEY,
  user_id       UUID                             NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  categoria_id  BIGINT                           NOT NULL REFERENCES Gastos_personales.categorias(id) ON DELETE CASCADE,
  mes           SMALLINT                         NOT NULL CHECK (mes BETWEEN 1 AND 12),
  anio          SMALLINT                         NOT NULL CHECK (anio BETWEEN 2000 AND 2100),
  monto_limite  NUMERIC(14, 2)                   NOT NULL CHECK (monto_limite > 0),
  moneda        Gastos_personales.moneda         NOT NULL DEFAULT 'ARS',
  creado_en     TIMESTAMPTZ                      NOT NULL DEFAULT now(),
  CONSTRAINT presupuestos_unique UNIQUE (user_id, categoria_id, mes, anio, moneda)
);

-- -------------------------------------------------------------
-- 4.5 meta_ahorro
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Gastos_personales.meta_ahorro (
  id              BIGSERIAL                      PRIMARY KEY,
  user_id         UUID                           NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  mes             SMALLINT                       NOT NULL CHECK (mes BETWEEN 1 AND 12),
  anio            SMALLINT                       NOT NULL CHECK (anio BETWEEN 2000 AND 2100),
  monto_objetivo  NUMERIC(14, 2)                 NOT NULL CHECK (monto_objetivo > 0),
  moneda          Gastos_personales.moneda       NOT NULL DEFAULT 'ARS',
  creado_en       TIMESTAMPTZ                    NOT NULL DEFAULT now(),
  CONSTRAINT meta_ahorro_unique UNIQUE (user_id, mes, anio, moneda)
);


-- =============================================================
-- 5. ÍNDICES
-- =============================================================

CREATE INDEX IF NOT EXISTS idx_movimientos_user_fecha     ON Gastos_personales.movimientos (user_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_movimientos_user_mes_anio  ON Gastos_personales.movimientos (user_id, date_part('year', fecha), date_part('month', fecha));
CREATE INDEX IF NOT EXISTS idx_movimientos_cuenta_id      ON Gastos_personales.movimientos (cuenta_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_categoria_id   ON Gastos_personales.movimientos (categoria_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_moneda         ON Gastos_personales.movimientos (moneda);
CREATE INDEX IF NOT EXISTS idx_presupuestos_user_mes_anio ON Gastos_personales.presupuestos (user_id, mes, anio);
CREATE INDEX IF NOT EXISTS idx_meta_ahorro_user_mes_anio  ON Gastos_personales.meta_ahorro (user_id, mes, anio);
CREATE INDEX IF NOT EXISTS idx_categorias_parent_id       ON Gastos_personales.categorias (parent_id);
CREATE INDEX IF NOT EXISTS idx_categorias_user_id         ON Gastos_personales.categorias (user_id);


-- =============================================================
-- 6. RLS
-- =============================================================

ALTER TABLE Gastos_personales.cuentas      ENABLE ROW LEVEL SECURITY;
ALTER TABLE Gastos_personales.categorias   ENABLE ROW LEVEL SECURITY;
ALTER TABLE Gastos_personales.movimientos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE Gastos_personales.presupuestos ENABLE ROW LEVEL SECURITY;
ALTER TABLE Gastos_personales.meta_ahorro  ENABLE ROW LEVEL SECURITY;


-- cuentas
CREATE POLICY "cuentas_select" ON Gastos_personales.cuentas
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "cuentas_insert" ON Gastos_personales.cuentas
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "cuentas_update" ON Gastos_personales.cuentas
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "cuentas_delete" ON Gastos_personales.cuentas
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- categorias (defaults: user_id IS NULL, propias: user_id = auth.uid())
CREATE POLICY "categorias_select" ON Gastos_personales.categorias
  FOR SELECT TO authenticated USING (user_id IS NULL OR user_id = auth.uid());
CREATE POLICY "categorias_insert" ON Gastos_personales.categorias
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "categorias_update" ON Gastos_personales.categorias
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "categorias_delete" ON Gastos_personales.categorias
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- movimientos
CREATE POLICY "movimientos_select" ON Gastos_personales.movimientos
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "movimientos_insert" ON Gastos_personales.movimientos
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "movimientos_update" ON Gastos_personales.movimientos
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "movimientos_delete" ON Gastos_personales.movimientos
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- presupuestos
CREATE POLICY "presupuestos_select" ON Gastos_personales.presupuestos
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "presupuestos_insert" ON Gastos_personales.presupuestos
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "presupuestos_update" ON Gastos_personales.presupuestos
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "presupuestos_delete" ON Gastos_personales.presupuestos
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- meta_ahorro
CREATE POLICY "meta_ahorro_select" ON Gastos_personales.meta_ahorro
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "meta_ahorro_insert" ON Gastos_personales.meta_ahorro
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "meta_ahorro_update" ON Gastos_personales.meta_ahorro
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "meta_ahorro_delete" ON Gastos_personales.meta_ahorro
  FOR DELETE TO authenticated USING (user_id = auth.uid());


-- =============================================================
-- 7. SEED — Categorías default
-- =============================================================

DO $$
DECLARE
  id_comida      BIGINT;
  id_transporte  BIGINT;
  id_salud       BIGINT;
  id_ocio        BIGINT;
  id_servicios   BIGINT;
  id_sueldo      BIGINT;
  id_otros       BIGINT;
BEGIN

  INSERT INTO Gastos_personales.categorias (nombre, icono, es_default, parent_id, user_id)
  VALUES ('Comida', '🍽️', true, NULL, NULL)
  ON CONFLICT DO NOTHING RETURNING id INTO id_comida;
  IF id_comida IS NULL THEN
    SELECT id INTO id_comida FROM Gastos_personales.categorias WHERE nombre = 'Comida' AND user_id IS NULL AND parent_id IS NULL;
  END IF;

  INSERT INTO Gastos_personales.categorias (nombre, icono, es_default, parent_id, user_id)
  VALUES ('Transporte', '🚌', true, NULL, NULL)
  ON CONFLICT DO NOTHING RETURNING id INTO id_transporte;
  IF id_transporte IS NULL THEN
    SELECT id INTO id_transporte FROM Gastos_personales.categorias WHERE nombre = 'Transporte' AND user_id IS NULL AND parent_id IS NULL;
  END IF;

  INSERT INTO Gastos_personales.categorias (nombre, icono, es_default, parent_id, user_id)
  VALUES ('Salud', '🏥', true, NULL, NULL)
  ON CONFLICT DO NOTHING RETURNING id INTO id_salud;
  IF id_salud IS NULL THEN
    SELECT id INTO id_salud FROM Gastos_personales.categorias WHERE nombre = 'Salud' AND user_id IS NULL AND parent_id IS NULL;
  END IF;

  INSERT INTO Gastos_personales.categorias (nombre, icono, es_default, parent_id, user_id)
  VALUES ('Ocio', '🎮', true, NULL, NULL)
  ON CONFLICT DO NOTHING RETURNING id INTO id_ocio;
  IF id_ocio IS NULL THEN
    SELECT id INTO id_ocio FROM Gastos_personales.categorias WHERE nombre = 'Ocio' AND user_id IS NULL AND parent_id IS NULL;
  END IF;

  INSERT INTO Gastos_personales.categorias (nombre, icono, es_default, parent_id, user_id)
  VALUES ('Servicios', '💡', true, NULL, NULL)
  ON CONFLICT DO NOTHING RETURNING id INTO id_servicios;
  IF id_servicios IS NULL THEN
    SELECT id INTO id_servicios FROM Gastos_personales.categorias WHERE nombre = 'Servicios' AND user_id IS NULL AND parent_id IS NULL;
  END IF;

  INSERT INTO Gastos_personales.categorias (nombre, icono, es_default, parent_id, user_id)
  VALUES ('Sueldo', '💰', true, NULL, NULL)
  ON CONFLICT DO NOTHING RETURNING id INTO id_sueldo;
  IF id_sueldo IS NULL THEN
    SELECT id INTO id_sueldo FROM Gastos_personales.categorias WHERE nombre = 'Sueldo' AND user_id IS NULL AND parent_id IS NULL;
  END IF;

  INSERT INTO Gastos_personales.categorias (nombre, icono, es_default, parent_id, user_id)
  VALUES ('Otros', '📦', true, NULL, NULL)
  ON CONFLICT DO NOTHING RETURNING id INTO id_otros;
  IF id_otros IS NULL THEN
    SELECT id INTO id_otros FROM Gastos_personales.categorias WHERE nombre = 'Otros' AND user_id IS NULL AND parent_id IS NULL;
  END IF;

  -- Subcategorías Comida
  INSERT INTO Gastos_personales.categorias (nombre, icono, es_default, parent_id, user_id) VALUES
    ('Almuerzo',     '🥗', true, id_comida, NULL),
    ('Cena',         '🍜', true, id_comida, NULL),
    ('Supermercado', '🛒', true, id_comida, NULL),
    ('Cafetería',    '☕', true, id_comida, NULL),
    ('Delivery',     '🛵', true, id_comida, NULL)
  ON CONFLICT DO NOTHING;

  -- Subcategorías Transporte
  INSERT INTO Gastos_personales.categorias (nombre, icono, es_default, parent_id, user_id) VALUES
    ('Colectivo/Tren', '🚇', true, id_transporte, NULL),
    ('Nafta',          '⛽', true, id_transporte, NULL),
    ('Taxi/Remis',     '🚕', true, id_transporte, NULL),
    ('Peaje',          '🛣️', true, id_transporte, NULL)
  ON CONFLICT DO NOTHING;

  -- Subcategorías Salud
  INSERT INTO Gastos_personales.categorias (nombre, icono, es_default, parent_id, user_id) VALUES
    ('Farmacia',    '💊', true, id_salud, NULL),
    ('Médico',      '👨‍⚕️', true, id_salud, NULL),
    ('Obra social', '🏥', true, id_salud, NULL)
  ON CONFLICT DO NOTHING;

  -- Subcategorías Ocio
  INSERT INTO Gastos_personales.categorias (nombre, icono, es_default, parent_id, user_id) VALUES
    ('Salidas',   '🎉', true, id_ocio, NULL),
    ('Streaming', '📺', true, id_ocio, NULL),
    ('Deportes',  '⚽', true, id_ocio, NULL),
    ('Viajes',    '✈️', true, id_ocio, NULL)
  ON CONFLICT DO NOTHING;

  -- Subcategorías Servicios
  INSERT INTO Gastos_personales.categorias (nombre, icono, es_default, parent_id, user_id) VALUES
    ('Luz',       '💡', true, id_servicios, NULL),
    ('Gas',       '🔥', true, id_servicios, NULL),
    ('Internet',  '🌐', true, id_servicios, NULL),
    ('Alquiler',  '🏠', true, id_servicios, NULL),
    ('Celular',   '📱', true, id_servicios, NULL)
  ON CONFLICT DO NOTHING;

END $$;


-- =============================================================
-- 8. FUNCIÓN ONBOARDING — Cuentas default
-- =============================================================

CREATE OR REPLACE FUNCTION Gastos_personales.init_cuentas_default()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = Gastos_personales
AS $$
BEGIN
  INSERT INTO Gastos_personales.cuentas (user_id, nombre, tipo, activa, orden)
  VALUES
    (auth.uid(), 'Efectivo',        'efectivo',        true, 1),
    (auth.uid(), 'Banco',           'banco',            true, 2),
    (auth.uid(), 'Mercado Pago',    'mercado_pago',     true, 3),
    (auth.uid(), 'Tarjeta Crédito', 'tarjeta_credito',  true, 4)
  ON CONFLICT (user_id, nombre) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION Gastos_personales.init_cuentas_default() TO authenticated;


-- =============================================================
-- 9. RPC — get_resumen_mes
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
    c.id                                                          AS cuenta_id,
    c.nombre                                                      AS cuenta_nombre,
    c.tipo::TEXT                                                  AS cuenta_tipo,
    m.moneda::TEXT                                                AS moneda,
    COALESCE(SUM(m.monto) FILTER (WHERE m.tipo = 'ingreso'), 0)  AS total_ingresos,
    COALESCE(SUM(m.monto) FILTER (WHERE m.tipo = 'egreso'),  0)  AS total_egresos,
    COALESCE(SUM(m.monto) FILTER (WHERE m.tipo = 'ingreso'), 0)
    - COALESCE(SUM(m.monto) FILTER (WHERE m.tipo = 'egreso'), 0) AS balance
  FROM Gastos_personales.movimientos m
  JOIN Gastos_personales.cuentas c ON c.id = m.cuenta_id
  WHERE
    m.user_id = auth.uid()
    AND EXTRACT(MONTH FROM m.fecha)::INT = p_mes
    AND EXTRACT(YEAR  FROM m.fecha)::INT = p_anio
  GROUP BY c.id, c.nombre, c.tipo, m.moneda
  ORDER BY c.orden, m.moneda;
END;
$$;

GRANT EXECUTE ON FUNCTION Gastos_personales.get_resumen_mes(INT, INT) TO authenticated;


-- =============================================================
-- 10. RPC — get_gastos_por_categoria
-- =============================================================

CREATE OR REPLACE FUNCTION Gastos_personales.get_gastos_por_categoria(
  p_mes    INT,
  p_anio   INT,
  p_moneda TEXT
)
RETURNS TABLE (
  categoria_id     BIGINT,
  categoria_nombre TEXT,
  categoria_icono  TEXT,
  total_egresos    NUMERIC,
  porcentaje       NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = Gastos_personales
AS $$
DECLARE
  v_total_mes NUMERIC;
BEGIN
  SELECT COALESCE(SUM(monto), 0)
  INTO v_total_mes
  FROM Gastos_personales.movimientos
  WHERE
    user_id = auth.uid()
    AND tipo   = 'egreso'
    AND moneda = p_moneda::Gastos_personales.moneda
    AND EXTRACT(MONTH FROM fecha)::INT = p_mes
    AND EXTRACT(YEAR  FROM fecha)::INT = p_anio;

  RETURN QUERY
  SELECT
    raiz.id                                       AS categoria_id,
    raiz.nombre                                   AS categoria_nombre,
    raiz.icono                                    AS categoria_icono,
    COALESCE(SUM(m.monto), 0)                     AS total_egresos,
    CASE
      WHEN v_total_mes = 0 THEN 0
      ELSE ROUND((COALESCE(SUM(m.monto), 0) / v_total_mes) * 100, 2)
    END                                           AS porcentaje
  FROM Gastos_personales.movimientos m
  JOIN Gastos_personales.categorias cat  ON cat.id  = m.categoria_id
  JOIN Gastos_personales.categorias raiz ON raiz.id = COALESCE(cat.parent_id, cat.id)
  WHERE
    m.user_id = auth.uid()
    AND m.tipo   = 'egreso'
    AND m.moneda = p_moneda::Gastos_personales.moneda
    AND EXTRACT(MONTH FROM m.fecha)::INT = p_mes
    AND EXTRACT(YEAR  FROM m.fecha)::INT = p_anio
  GROUP BY raiz.id, raiz.nombre, raiz.icono
  ORDER BY total_egresos DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION Gastos_personales.get_gastos_por_categoria(INT, INT, TEXT) TO authenticated;


-- =============================================================
-- 11. ROLLBACK (documentado, no ejecutar en producción)
-- =============================================================
/*
  DROP SCHEMA IF EXISTS Gastos_personales CASCADE;
*/

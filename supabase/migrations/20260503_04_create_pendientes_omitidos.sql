-- =============================================================
-- MIGRACIÓN: pendientes_omitidos
-- Schema: Gastos_personales
-- Fecha: 2026-05-03
-- Descripción: Tabla para persistir items de pendientes que el
--              usuario desestimó, evitando que reaparezcan al
--              recargar la página.
-- =============================================================
-- ROLLBACK documentado al final del archivo
-- =============================================================


CREATE TABLE IF NOT EXISTS Gastos_personales.pendientes_omitidos (
  id            BIGSERIAL    PRIMARY KEY,
  user_id       UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo          TEXT         NOT NULL CHECK (tipo IN ('recurrente', 'cuota')),
  referencia_id BIGINT       NOT NULL,
  mes           INT          NOT NULL,
  anio          INT          NOT NULL,
  creado_en     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT pendientes_omitidos_unique UNIQUE (user_id, tipo, referencia_id, mes, anio)
);

COMMENT ON TABLE  Gastos_personales.pendientes_omitidos               IS 'Registro de items pendientes que el usuario desestimó para un mes/año concreto. Evita que reaparezcan al recargar.';
COMMENT ON COLUMN Gastos_personales.pendientes_omitidos.tipo          IS 'recurrente | cuota';
COMMENT ON COLUMN Gastos_personales.pendientes_omitidos.referencia_id IS 'PK del recurrente o cuota omitido.';


-- Índice de soporte para el filtro en get_pendientes_mes
CREATE INDEX IF NOT EXISTS idx_pendientes_omitidos_lookup
  ON Gastos_personales.pendientes_omitidos (user_id, tipo, mes, anio);


ALTER TABLE Gastos_personales.pendientes_omitidos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pendientes_omitidos_all"
  ON Gastos_personales.pendientes_omitidos
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- =============================================================
-- ROLLBACK
-- =============================================================
/*
  DROP TABLE IF EXISTS Gastos_personales.pendientes_omitidos CASCADE;
*/

-- =============================================================
-- Migration: add_traspaso_id_to_movimientos
-- Description: Agrega columna traspaso_id (UUID nullable) a movimientos.
--              Dos movimientos del mismo traspaso comparten el mismo traspaso_id.
--              Sin FK constraint (evita complejidad de auto-referencia).
-- Rollback: ALTER TABLE Gastos_personales.movimientos DROP COLUMN IF EXISTS traspaso_id;
-- =============================================================

ALTER TABLE Gastos_personales.movimientos
  ADD COLUMN IF NOT EXISTS traspaso_id UUID DEFAULT NULL;

-- Índice para facilitar la búsqueda del movimiento par de un traspaso
CREATE INDEX IF NOT EXISTS idx_movimientos_traspaso_id
  ON Gastos_personales.movimientos (traspaso_id)
  WHERE traspaso_id IS NOT NULL;

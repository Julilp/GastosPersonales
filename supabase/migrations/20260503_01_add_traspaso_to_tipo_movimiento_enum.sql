-- =============================================================
-- Migration: add_traspaso_to_tipo_movimiento_enum
-- Description: Agrega el valor 'traspaso' al enum tipo_movimiento
-- Rollback: No es posible eliminar valores de enum en PostgreSQL sin recrear el tipo.
--           Si se necesita rollback, hacer: UPDATE movimientos SET tipo = 'egreso' WHERE tipo = 'traspaso';
--           Luego recrear el enum sin 'traspaso' y actualizar la columna.
-- =============================================================

ALTER TYPE Gastos_personales.tipo_movimiento ADD VALUE IF NOT EXISTS 'traspaso';

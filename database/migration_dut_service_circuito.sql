-- Migración: Agregar campo circuito a dut_service
-- Fecha: 2026-04-02
-- El campo circuito es un entero que agrupa los DUT services (PT-05, PT-12, PT-14)
-- en circuitos para la generación de IED (Informes de Ensayo por Demanda).

ALTER TABLE dut_service
  ADD COLUMN circuito INT NULL DEFAULT NULL
  COMMENT 'Identificador de circuito para agrupar PT-05/PT-12/PT-14 en IED';

CREATE INDEX idx_dut_service_circuito ON dut_service(circuito);

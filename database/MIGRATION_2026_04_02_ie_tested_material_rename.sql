-- =====================================================
-- MIGRATION: Renombrar id_dcc a id_ie en ie_tested_material
-- Fecha: 2026-04-02
-- =====================================================

ALTER TABLE `ie_tested_material`
  CHANGE COLUMN `id_dcc` `id_ie` VARCHAR(255) NOT NULL COMMENT 'Id del informe IE/IED (ej. PH2378-00 IE 14 LA ANGOSTURA)';

-- Reindexar la tabla si es necesario
ALTER TABLE `ie_tested_material`
  DROP KEY `idx_ie_tested_material_id_dcc` IF EXISTS,
  ADD KEY `idx_ie_tested_material_id_ie` (`id_ie`);

-- Verificación
DESCRIBE `ie_tested_material`;
SELECT 'Columna id_ie renombrada exitosamente' AS 'Status';

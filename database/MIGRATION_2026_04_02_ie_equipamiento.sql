-- =====================================================
-- MIGRATION: Tabla ie_equipamiento para informes IE/IED
-- Fecha: 2026-04-02
-- =====================================================

CREATE TABLE IF NOT EXISTS `ie_equipamiento` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `id_ie` VARCHAR(255) NOT NULL COMMENT 'Id del informe IE/IED (ej. PH2378-00 IE 14 LA ANGOSTURA)',
  `id_equipment` VARCHAR(255) NOT NULL COMMENT 'Id del patron en equipment_catalog.idequipment',
  `deleted` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Borrado logico: 0=activo, 1=eliminado',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_ie_equipamiento_id_ie` (`id_ie`),
  KEY `idx_ie_equipamiento_id_equipment` (`id_equipment`),
  KEY `idx_ie_equipamiento_deleted` (`deleted`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Opcional recomendado: un solo registro activo de equipamiento por informe
-- CREATE UNIQUE INDEX `uk_ie_equipamiento_ie_activo`
-- ON `ie_equipamiento` (`id_ie`, `deleted`);

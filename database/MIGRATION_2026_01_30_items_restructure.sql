-- =====================================================
-- MIGRATION: Nueva estructura para Items (sin subitems)
-- Fecha: 2026-01-30
-- =====================================================

-- PASO 1: Eliminar tablas antiguas
-- =====================================================
DROP TABLE IF EXISTS `dcc_subitem_identificador`;
DROP TABLE IF EXISTS `dcc_subitem`;

-- PASO 2: Modificar tabla dcc_item para agregar description y deleted
-- =====================================================
ALTER TABLE `dcc_item` 
  DROP COLUMN `id_subitem` IF EXISTS,
  DROP COLUMN `object` IF EXISTS,
  DROP COLUMN `manufacturer` IF EXISTS,
  DROP COLUMN `model` IF EXISTS,
  DROP COLUMN `serial_number` IF EXISTS,
  DROP COLUMN `costumer_asset` IF EXISTS,
  DROP COLUMN `comment` IF EXISTS,
  ADD COLUMN `description` LONGTEXT NULL AFTER `id_dcc`,
  ADD COLUMN `deleted` INT DEFAULT 0 AFTER `description`;

-- Asegurar estructura correcta
ALTER TABLE `dcc_item`
  MODIFY COLUMN `id` INT AUTO_INCREMENT PRIMARY KEY,
  MODIFY COLUMN `id_dcc` INT NOT NULL;

-- Agregar constraint único
ALTER TABLE `dcc_item` 
  ADD UNIQUE KEY `uk_dcc_item_id_dcc` (`id_dcc`);

-- PASO 3: Crear nueva tabla dcc_items para items múltiples
-- =====================================================
CREATE TABLE IF NOT EXISTS `dcc_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `id_item` INT NOT NULL,
  `id_dcc` INT NOT NULL,
  `object` VARCHAR(255) NULL COMMENT 'Nombre del objeto/instrumento',
  `manufacturer` VARCHAR(255) NULL COMMENT 'Fabricante',
  `model` VARCHAR(255) NULL COMMENT 'Modelo',
  `serial_number` VARCHAR(255) NULL COMMENT 'Número de serie',
  `costumer_asset` VARCHAR(255) NULL COMMENT 'ID del activo del cliente',
  `comment` LONGTEXT NULL COMMENT 'Comentario adicional',
  `deleted` INT DEFAULT 0 COMMENT 'Borrado lógico: 0=activo, 1=inactivo',
  `CREATED_AT` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `UPDATED_AT` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`id_item`) REFERENCES `dcc_item`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`id_dcc`) REFERENCES `dcc_data`(`id`) ON DELETE CASCADE,
  KEY `idx_id_dcc` (`id_dcc`),
  KEY `idx_id_item` (`id_item`),
  KEY `idx_deleted` (`deleted`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='Items múltiples para cada DCC/IE';

-- PASO 4: Verificar la estructura
-- =====================================================
DESCRIBE `dcc_item`;
DESCRIBE `dcc_items`;

-- PASO 5: Verificación de relaciones
-- =====================================================
SELECT 'Tabla dcc_item creada correctamente' AS 'Status';
SELECT COUNT(*) as 'Total items en dcc_item' FROM `dcc_item`;
SELECT COUNT(*) as 'Total registros en dcc_items' FROM `dcc_items`;

-- =====================================================
-- FIN DE LA MIGRACIÓN
-- =====================================================

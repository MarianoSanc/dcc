-- =====================================================
-- MIGRATION: Cambio de estructura dcc_item y dcc_items
-- =====================================================

-- 1. Eliminar tabla dcc_subitem (si existe)
DROP TABLE IF EXISTS `dcc_subitem`;

-- 2. Modificar tabla dcc_item - Agregar columna description y reorganizar estructura
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

-- Asegurar que la estructura de dcc_item sea correcta
ALTER TABLE `dcc_item`
  MODIFY COLUMN `id` INT AUTO_INCREMENT PRIMARY KEY,
  MODIFY COLUMN `id_dcc` INT NOT NULL,
  ADD UNIQUE KEY `uk_dcc_item_id_dcc` (`id_dcc`);

-- 3. Crear nueva tabla dcc_items (plural) para los items con detalles
CREATE TABLE IF NOT EXISTS `dcc_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `id_item` INT NOT NULL,
  `id_dcc` INT NOT NULL,
  `object` VARCHAR(255) NULL,
  `manufacturer` VARCHAR(255) NULL,
  `model` VARCHAR(255) NULL,
  `serial_number` VARCHAR(255) NULL,
  `costumer_asset` VARCHAR(255) NULL,
  `comment` LONGTEXT NULL,
  `deleted` INT DEFAULT 0,
  CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UPDATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`id_item`) REFERENCES `dcc_item`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`id_dcc`) REFERENCES `dcc_data`(`id`) ON DELETE CASCADE,
  KEY `idx_id_dcc` (`id_dcc`),
  KEY `idx_id_item` (`id_item`)
);

-- 4. Verificar la estructura final
SELECT 'Estructura final:' as 'Status';
DESCRIBE `dcc_item`;
DESCRIBE `dcc_items`;

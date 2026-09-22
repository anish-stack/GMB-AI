-- Run once on an existing database (phpMyAdmin -> SQL tab, or mysql CLI).
-- New installs already have these in db/schema.sql.
USE `gmb_ai`;

ALTER TABLE `ai_tasks`
  ADD COLUMN `image_storage_provider` VARCHAR(20) NULL AFTER `image_provider`,
  ADD COLUMN `image_storage_key`      VARCHAR(300) NULL AFTER `image_storage_provider`;

CREATE TABLE IF NOT EXISTS `task_image_candidates` (
  `id`                 INT AUTO_INCREMENT PRIMARY KEY,
  `task_id`            INT NOT NULL,
  `tenant_id`          INT NULL,
  `url`                LONGTEXT,
  `storage_provider`   VARCHAR(20) NULL,
  `storage_key`        VARCHAR(300) NULL,
  `ai_provider`        VARCHAR(80) NULL,
  `ai_model`           VARCHAR(120) NULL,
  `prompt`             TEXT,
  `status`             VARCHAR(20) NOT NULL DEFAULT 'CANDIDATE',
  `created_at`         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `deleted_at`         DATETIME NULL,
  KEY `idx_imgcand_task` (`task_id`),
  KEY `idx_imgcand_status` (`status`),
  KEY `idx_imgcand_created` (`created_at`),
  CONSTRAINT `fk_imgcand_task` FOREIGN KEY (`task_id`) REFERENCES `ai_tasks`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

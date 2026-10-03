-- v8: bulk Google connect (auto-create clients), location picker, calendar keywords + Excel import,
-- auto-publish (QA >= 80), CTA links, website builder link. MariaDB 10.5+. Safe to run more than once.
-- mysql -u root -p gmb_ai < db/upgrade-v8-bulk-connect-autopost.sql

CREATE TABLE IF NOT EXISTS `google_connections` (
  `id`                 INT AUTO_INCREMENT PRIMARY KEY,
  `tenant_id`          INT NOT NULL,
  `google_email`       VARCHAR(190),
  `refresh_token_enc`  TEXT NOT NULL,
  `scope`              VARCHAR(500),
  `created_by`         VARCHAR(120),
  `last_scanned_at`    DATETIME NULL,
  `created_at`         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_gconn_tenant_email` (`tenant_id`,`google_email`),
  CONSTRAINT `fk_gconn_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE `clients`
  ADD COLUMN IF NOT EXISTS `google_connection_id` INT NULL,
  ADD COLUMN IF NOT EXISTS `auto_publish` TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `auto_publish_min_score` TINYINT NOT NULL DEFAULT 80,
  ADD COLUMN IF NOT EXISTS `website_builder_client_id` VARCHAR(64) NULL;

ALTER TABLE `content_calendar`
  ADD COLUMN IF NOT EXISTS `scheduled_time` VARCHAR(5) NULL,
  ADD COLUMN IF NOT EXISTS `primary_keyword` VARCHAR(180) NULL,
  ADD COLUMN IF NOT EXISTS `secondary_keywords` TEXT NULL,
  ADD COLUMN IF NOT EXISTS `tertiary_keywords` TEXT NULL,
  ADD COLUMN IF NOT EXISTS `cta` VARCHAR(30) NULL,
  ADD COLUMN IF NOT EXISTS `source` VARCHAR(20) NULL;

ALTER TABLE `ai_tasks`
  ADD COLUMN IF NOT EXISTS `scheduled_time` VARCHAR(5) NULL,
  ADD COLUMN IF NOT EXISTS `cta_url` VARCHAR(500) NULL,
  ADD COLUMN IF NOT EXISTS `auto_published` TINYINT(1) NOT NULL DEFAULT 0;

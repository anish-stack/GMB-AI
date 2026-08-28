-- Run once on an existing database (phpMyAdmin -> SQL tab, or mysql CLI).
-- New installs already have these columns in db/schema.sql.
USE `gmb_ai`;

ALTER TABLE `clients`
  ADD COLUMN `google_refresh_token` TEXT NULL AFTER `gmb_connection_status`,
  ADD COLUMN `google_email`         VARCHAR(180) NULL AFTER `google_refresh_token`,
  ADD COLUMN `google_account_id`    VARCHAR(120) NULL AFTER `google_email`,
  ADD COLUMN `google_location_name` VARCHAR(180) NULL AFTER `google_account_id`,
  ADD COLUMN `google_connected_at`  DATETIME NULL AFTER `google_location_name`,
  ADD COLUMN `google_scope`         VARCHAR(255) NULL AFTER `google_connected_at`;

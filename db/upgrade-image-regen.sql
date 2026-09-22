-- Run once on an existing database (phpMyAdmin -> SQL tab, or mysql CLI).
-- New installs already have this column in db/schema.sql.
USE `gmb_ai`;

ALTER TABLE `ai_tasks`
  ADD COLUMN `image_regen_count` INT NOT NULL DEFAULT 0 AFTER `regenerate_count`;

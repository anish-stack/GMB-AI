-- v7: Google import on connect, auto-reply reviews, social links, services with descriptions,
-- products, branded post images, 40/250 post rules. MariaDB 10.5+. Safe to run more than once.
-- mysql -u root -p gmb_ai < db/upgrade-v7-gmb-sync.sql

CREATE TABLE IF NOT EXISTS `gmb_products` (
  `id`               INT AUTO_INCREMENT PRIMARY KEY,
  `tenant_id`        INT NOT NULL,
  `client_id`        INT NOT NULL,
  `name`             VARCHAR(58) NOT NULL,
  `category`         VARCHAR(120),
  `price`            DECIMAL(12,2) NULL,
  `discounted_price` DECIMAL(12,2) NULL,
  `currency`         VARCHAR(8) NOT NULL DEFAULT 'INR',
  `description`      VARCHAR(1000),
  `landing_url`      VARCHAR(1500),
  `image_url`        VARCHAR(1000),
  `cta`              VARCHAR(20) NOT NULL DEFAULT 'LEARN_MORE',
  `status`           VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  `last_posted_at`   DATETIME NULL,
  `created_at`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_products_client` (`client_id`),
  CONSTRAINT `fk_products_client` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE `clients`
  ADD COLUMN IF NOT EXISTS `logo_url` VARCHAR(1000) NULL,
  ADD COLUMN IF NOT EXISTS `brand_color` VARCHAR(9) NULL,
  ADD COLUMN IF NOT EXISTS `maps_url` VARCHAR(500) NULL,
  ADD COLUMN IF NOT EXISTS `review_url` VARCHAR(500) NULL,
  ADD COLUMN IF NOT EXISTS `auto_reply_reviews` TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `auto_reply_min_stars` TINYINT NOT NULL DEFAULT 4,
  ADD COLUMN IF NOT EXISTS `google_imported_at` DATETIME NULL;

ALTER TABLE `clients` MODIFY `business_category` VARCHAR(120) NOT NULL DEFAULT 'Pending Google sync';

ALTER TABLE `ai_tasks`
  ADD COLUMN IF NOT EXISTS `tertiary_keywords` TEXT NULL,
  ADD COLUMN IF NOT EXISTS `ai_score` TINYINT NULL,
  ADD COLUMN IF NOT EXISTS `ai_score_original` TINYINT NULL,
  ADD COLUMN IF NOT EXISTS `humanized` TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `ai_signals` TEXT NULL;

ALTER TABLE `gmb_posts`
  ADD COLUMN IF NOT EXISTS `search_url` VARCHAR(500) NULL;

ALTER TABLE `users`
  ADD COLUMN IF NOT EXISTS `google_sub` VARCHAR(64) NULL,
  ADD INDEX IF NOT EXISTS `idx_users_google_sub` (`google_sub`);

ALTER TABLE `gmb_services`
  ADD COLUMN IF NOT EXISTS `category` VARCHAR(160) NULL,
  ADD COLUMN IF NOT EXISTS `price` DECIMAL(12,2) NULL;

ALTER TABLE `review_inbox`
  ADD COLUMN IF NOT EXISTS `auto_replied` TINYINT(1) NOT NULL DEFAULT 0;

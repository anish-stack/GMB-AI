-- v10: tracked keywords, auto-schedule from posting plan, smart review QR flow + poster,
-- Razorpay autopay (subscriptions). MariaDB 10.5+. Safe to run more than once.
-- mysql -u root -p gmb_ai < db/upgrade-v10-keywords-reviews-autopay.sql

CREATE TABLE IF NOT EXISTS `review_flows` (
  `client_id`     INT NOT NULL PRIMARY KEY,
  `tenant_id`     INT NOT NULL,
  `slug`          VARCHAR(80) NOT NULL,
  `mode`          VARCHAR(10) NOT NULL DEFAULT 'AI',        -- AI (smart assistant) | DIRECT (Google form)
  `steps`         LONGTEXT,                                 -- JSON questionnaire
  `poster`        LONGTEXT,                                 -- JSON poster design
  `threshold`     TINYINT NOT NULL DEFAULT 4,               -- >= stars -> Google, below -> private feedback
  `scans`         INT NOT NULL DEFAULT 0,
  `google_clicks` INT NOT NULL DEFAULT 0,
  `feedback_count` INT NOT NULL DEFAULT 0,
  `updated_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_review_flow_slug` (`slug`),
  CONSTRAINT `fk_review_flow_client` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `review_feedback` (
  `id`         INT AUTO_INCREMENT PRIMARY KEY,
  `client_id`  INT NOT NULL,
  `rating`     TINYINT NOT NULL,
  `answers`    LONGTEXT,
  `message`    TEXT,
  `name`       VARCHAR(120),
  `contact`    VARCHAR(160),
  `went_to_google` TINYINT(1) NOT NULL DEFAULT 0,
  `ip_hash`    VARCHAR(64),
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_review_feedback_client` (`client_id`,`created_at`),
  CONSTRAINT `fk_review_feedback_client` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `rzp_plans` (
  `id`            INT AUTO_INCREMENT PRIMARY KEY,
  `plan_id`       INT NOT NULL,
  `billing_cycle` VARCHAR(10) NOT NULL,
  `amount`        DECIMAL(10,2) NOT NULL,
  `rzp_plan_id`   VARCHAR(64) NOT NULL,
  `created_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_rzp_plan` (`plan_id`,`billing_cycle`,`amount`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE `keywords`
  ADD COLUMN IF NOT EXISTS `tracked` TINYINT(1) NOT NULL DEFAULT 0;

ALTER TABLE `clients`
  ADD COLUMN IF NOT EXISTS `auto_schedule` TINYINT(1) NOT NULL DEFAULT 1;

ALTER TABLE `subscriptions`
  ADD COLUMN IF NOT EXISTS `autopay_status` VARCHAR(20) NULL,         -- CREATED | AUTHENTICATED | ACTIVE | HALTED | CANCELLED | COMPLETED
  ADD COLUMN IF NOT EXISTS `rzp_subscription_id` VARCHAR(64) NULL,
  ADD COLUMN IF NOT EXISTS `autopay_next_charge_at` DATETIME NULL,
  ADD INDEX IF NOT EXISTS `idx_sub_rzp` (`rzp_subscription_id`);

-- v5: notifications + FCM, report sharing, public API keys & rate limits,
-- support tickets, CMS, client posting plans, integrations, health checks.
-- MariaDB 10.5+ (XAMPP). Safe to run more than once.
-- mysql -u root -p gmb_ai < db/upgrade-v5-platform.sql

CREATE TABLE IF NOT EXISTS `notification_broadcasts` (
  `id`                 INT AUTO_INCREMENT PRIMARY KEY,
  `type`               VARCHAR(30) NOT NULL DEFAULT 'ANNOUNCEMENT', -- ANNOUNCEMENT | MAINTENANCE | ALERT | INFO
  `title`              VARCHAR(220) NOT NULL,
  `body`               VARCHAR(1000),
  `link`               VARCHAR(255),
  `audience_type`      VARCHAR(20) NOT NULL DEFAULT 'ALL',          -- ALL | TENANTS | USERS
  `audience`           LONGTEXT,                                     -- JSON ids
  `send_push`          TINYINT(1) NOT NULL DEFAULT 1,
  `recipients`         INT NOT NULL DEFAULT 0,
  `push_sent`          INT NOT NULL DEFAULT 0,
  `push_failed`        INT NOT NULL DEFAULT 0,
  `read_count`         INT NOT NULL DEFAULT 0,
  `created_by_user_id` INT NULL,
  `created_by_name`    VARCHAR(120),
  `created_at`         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `fcm_tokens` (
  `id`           INT AUTO_INCREMENT PRIMARY KEY,
  `user_id`      INT NOT NULL,
  `tenant_id`    INT NULL,
  `token_hash`   CHAR(64) NOT NULL,
  `token_enc`    TEXT NOT NULL,
  `platform`     VARCHAR(40),
  `user_agent`   VARCHAR(255),
  `failures`     INT NOT NULL DEFAULT 0,
  `last_seen_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_fcm_token` (`token_hash`),
  KEY `idx_fcm_user` (`user_id`),
  CONSTRAINT `fk_fcm_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `report_shares` (
  `id`                INT AUTO_INCREMENT PRIMARY KEY,
  `tenant_id`         INT NOT NULL,
  `client_id`         INT NOT NULL,
  `location_name`     VARCHAR(220),
  `report_type`       VARCHAR(40) NOT NULL DEFAULT 'GMB_PERFORMANCE',
  `period_start`      DATE NULL,
  `period_end`        DATE NULL,
  `file_key`          VARCHAR(200),
  `file_size`         INT NULL,
  `view_token_hash`   CHAR(64),
  `shared_by_user_id` INT NULL,
  `shared_by_name`    VARCHAR(120),
  `shared_with_name`  VARCHAR(160),
  `shared_with_email` VARCHAR(190),
  `shared_with_phone` VARCHAR(40),
  `method`            VARCHAR(20) NOT NULL DEFAULT 'EMAIL', -- EMAIL | DOWNLOAD | LINK | WHATSAPP
  `status`            VARCHAR(20) NOT NULL DEFAULT 'QUEUED', -- QUEUED | SENT | FAILED | GENERATED
  `error`             VARCHAR(500),
  `view_count`        INT NOT NULL DEFAULT 0,
  `first_viewed_at`   DATETIME NULL,
  `last_viewed_at`    DATETIME NULL,
  `expires_at`        DATETIME NULL,
  `created_at`        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_rs_tenant` (`tenant_id`,`created_at`),
  KEY `idx_rs_client` (`client_id`),
  UNIQUE KEY `uq_rs_token` (`view_token_hash`),
  CONSTRAINT `fk_rs_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rs_client` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `api_usage_daily` (
  `id`         BIGINT AUTO_INCREMENT PRIMARY KEY,
  `tenant_id`  INT NOT NULL,
  `api_key_id` INT NOT NULL,
  `day`        DATE NOT NULL,
  `endpoint`   VARCHAR(120) NOT NULL,
  `requests`   INT NOT NULL DEFAULT 0,
  `errors`     INT NOT NULL DEFAULT 0,
  `throttled`  INT NOT NULL DEFAULT 0,
  UNIQUE KEY `uq_usage_key_day_ep` (`api_key_id`,`day`,`endpoint`),
  KEY `idx_usage_tenant_day` (`tenant_id`,`day`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `api_rate_counters` (
  `bucket`       VARCHAR(190) NOT NULL,
  `window_start` DATETIME NOT NULL,
  `hits`         INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`bucket`,`window_start`),
  KEY `idx_rate_window` (`window_start`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `support_tickets` (
  `id`                  INT AUTO_INCREMENT PRIMARY KEY,
  `ticket_no`           VARCHAR(20) NOT NULL,
  `tenant_id`           INT NOT NULL,
  `client_id`           INT NULL,
  `user_id`             INT NULL,
  `subject`             VARCHAR(200) NOT NULL,
  `category`            VARCHAR(40) NOT NULL DEFAULT 'GENERAL',  -- GENERAL | BILLING | TECHNICAL | GMB | API | FEATURE
  `priority`            VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',   -- LOW | MEDIUM | HIGH | URGENT
  `status`              VARCHAR(30) NOT NULL DEFAULT 'OPEN',     -- OPEN | IN_PROGRESS | WAITING_FOR_CLIENT | RESOLVED | CLOSED
  `assigned_to_user_id` INT NULL,
  `last_reply_by`       VARCHAR(10) NULL,                        -- CLIENT | ADMIN
  `last_reply_at`       DATETIME NULL,
  `closed_at`           DATETIME NULL,
  `created_at`          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_ticket_no` (`ticket_no`),
  KEY `idx_ticket_tenant` (`tenant_id`,`status`),
  CONSTRAINT `fk_ticket_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `support_ticket_messages` (
  `id`          INT AUTO_INCREMENT PRIMARY KEY,
  `ticket_id`   INT NOT NULL,
  `user_id`     INT NULL,
  `author_role` VARCHAR(10) NOT NULL DEFAULT 'CLIENT',  -- CLIENT | ADMIN | SYSTEM
  `author_name` VARCHAR(120),
  `body`        TEXT NOT NULL,
  `attachments` LONGTEXT,                               -- JSON [{key,name,size,type}]
  `is_internal` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_msg_ticket` (`ticket_id`),
  CONSTRAINT `fk_msg_ticket` FOREIGN KEY (`ticket_id`) REFERENCES `support_tickets`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `cms_pages` (
  `id`              INT AUTO_INCREMENT PRIMARY KEY,
  `slug`            VARCHAR(120) NOT NULL,
  `title`           VARCHAR(200) NOT NULL,
  `content`         LONGTEXT,
  `seo_title`       VARCHAR(200),
  `seo_description` VARCHAR(320),
  `status`          VARCHAR(20) NOT NULL DEFAULT 'DRAFT',  -- DRAFT | PUBLISHED
  `show_in_footer`  TINYINT(1) NOT NULL DEFAULT 0,
  `sort_order`      INT NOT NULL DEFAULT 0,
  `updated_by`      VARCHAR(120),
  `created_at`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_cms_slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `client_posting_plans` (
  `id`                 INT AUTO_INCREMENT PRIMARY KEY,
  `tenant_id`          INT NOT NULL,
  `client_id`          INT NOT NULL,
  `start_date`         DATE NOT NULL,
  `duration_months`    INT NOT NULL DEFAULT 1,
  `end_date`           DATE NOT NULL,
  `posts_per_week`     INT NOT NULL DEFAULT 3,
  `total_posts`        INT NOT NULL,
  `posting_days`       VARCHAR(40) NULL,                  -- JSON weekday numbers 0=Sun..6=Sat, NULL = any day
  `status`             VARCHAR(20) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE | EXPIRED | REPLACED
  `notes`              VARCHAR(300),
  `created_by`         VARCHAR(120),
  `created_at`         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_cpp_client` (`client_id`,`status`),
  CONSTRAINT `fk_cpp_client` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `integration_settings` (
  `provider`         VARCHAR(40) NOT NULL PRIMARY KEY,
  `enabled`          TINYINT(1) NOT NULL DEFAULT 0,
  `config_enc`       LONGTEXT,          -- AES-256-GCM encrypted JSON (secrets + values)
  `last_test_status` VARCHAR(20),       -- OK | FAILED
  `last_test_message` VARCHAR(500),
  `last_tested_at`   DATETIME NULL,
  `updated_by`       VARCHAR(120),
  `updated_at`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `system_heartbeats` (
  `name`         VARCHAR(60) NOT NULL PRIMARY KEY,  -- scheduler | mail_worker | nightly_job
  `last_run_at`  DATETIME NULL,
  `last_ok_at`   DATETIME NULL,
  `status`       VARCHAR(20),
  `message`      VARCHAR(500),
  `updated_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `health_check_runs` (
  `id`         INT AUTO_INCREMENT PRIMARY KEY,
  `overall`    VARCHAR(20) NOT NULL,
  `results`    LONGTEXT NOT NULL,
  `duration_ms` INT NOT NULL DEFAULT 0,
  `run_by`     VARCHAR(120),
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_health_time` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE `notifications`
  ADD COLUMN IF NOT EXISTS `broadcast_id` INT NULL,
  ADD COLUMN IF NOT EXISTS `read_at` DATETIME NULL,
  ADD COLUMN IF NOT EXISTS `push_status` VARCHAR(20) NULL,
  ADD INDEX IF NOT EXISTS `idx_notif_user` (`user_id`,`is_read`);

ALTER TABLE `api_keys`
  ADD COLUMN IF NOT EXISTS `scopes` VARCHAR(400) NULL,
  ADD COLUMN IF NOT EXISTS `active` TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS `expires_at` DATETIME NULL,
  ADD COLUMN IF NOT EXISTS `rate_limit_per_min` INT NULL,
  ADD COLUMN IF NOT EXISTS `last_used_ip` VARCHAR(64) NULL,
  ADD COLUMN IF NOT EXISTS `request_count` BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `created_by_user_id` INT NULL,
  ADD COLUMN IF NOT EXISTS `revoked_at` DATETIME NULL,
  ADD COLUMN IF NOT EXISTS `updated_at` DATETIME NULL,
  ADD UNIQUE INDEX IF NOT EXISTS `uq_key_hash` (`key_hash`);

ALTER TABLE `email_queue` MODIFY `meta` LONGTEXT NULL;

ALTER TABLE `ai_tasks`
  ADD COLUMN IF NOT EXISTS `created_by_user_id` INT NULL,
  ADD COLUMN IF NOT EXISTS `source` VARCHAR(20) NULL;

INSERT IGNORE INTO `cms_pages` (`slug`,`title`,`content`,`seo_title`,`seo_description`,`status`,`show_in_footer`,`sort_order`) VALUES
('terms','Terms and Conditions','## 1. Acceptance\nBy creating an account or using the service you agree to these terms.\n\n## 2. Your account\nYou are responsible for your login credentials and for all activity in your workspace.\n\n## 3. Acceptable use\nDo not use the service to publish misleading, illegal or policy-violating content on Google Business Profiles.\n\n## 4. Plans and payments\nPaid plans are billed in advance. Taxes are added as applicable. Posting limits depend on the purchased plan.\n\n## 5. Termination\nWe may suspend accounts that violate these terms.\n\n## 6. Contact\nQuestions? Write to the support email listed on this site.','Terms and Conditions','Terms of using the platform.','PUBLISHED',1,1),
('privacy','Privacy Policy','## What we collect\nAccount details (name, email, phone), business profile data you connect, and usage data.\n\n## How we use it\nTo provide the service, generate content, send notifications and invoices, and improve the product.\n\n## Google data\nGoogle Business Profile data is used only to manage the listings you connect. Tokens are stored encrypted.\n\n## Sharing\nWe do not sell personal data. Service providers (hosting, email, payments, AI) process data on our behalf.\n\n## Your rights\nYou can request access, correction or deletion of your data by contacting support.','Privacy Policy','How we collect and use data.','PUBLISHED',1,2),
('disclaimer','Disclaimer','AI-generated content is a draft. Review every post before it is published. Ranking and performance results on Google are not guaranteed. The service is provided "as is".','Disclaimer','Service disclaimer.','PUBLISHED',1,3),
('about','About us','We help agencies grow local businesses on Google with AI-assisted Business Profile management.','About us','About the platform.','PUBLISHED',1,4),
('faq','FAQ','## Is publishing automatic?\nNo. Every post can be reviewed before it goes live.\n\n## Can I cancel any time?\nYes, from Billing.\n\n## Do you support multiple Google accounts?\nYes, each client connects its own Google account.','Frequently asked questions','Answers to common questions.','PUBLISHED',1,5),
('support','Support','Raise a ticket from the Support section of your dashboard, or email our support team. We reply within one business day.','Support','How to get help.','PUBLISHED',1,6);

-- Give every existing client a posting plan so strict capping doesn't block them after upgrade.
INSERT INTO `client_posting_plans` (`tenant_id`,`client_id`,`start_date`,`duration_months`,`end_date`,`posts_per_week`,`total_posts`,`status`,`notes`,`created_by`)
SELECT c.tenant_id, c.id, CURDATE(), 12, DATE_SUB(DATE_ADD(CURDATE(), INTERVAL 12 MONTH), INTERVAL 1 DAY),
       CASE c.posting_frequency WHEN 'DAILY' THEN 7 WHEN 'THRICE_WEEKLY' THEN 3 WHEN 'TWICE_WEEKLY' THEN 2 WHEN 'WEEKLY' THEN 1 ELSE 3 END,
       12 * 4 * CASE c.posting_frequency WHEN 'DAILY' THEN 7 WHEN 'THRICE_WEEKLY' THEN 3 WHEN 'TWICE_WEEKLY' THEN 2 WHEN 'WEEKLY' THEN 1 ELSE 3 END,
       'ACTIVE', 'Auto-created on upgrade', 'system'
  FROM clients c
 WHERE NOT EXISTS (SELECT 1 FROM client_posting_plans p WHERE p.client_id=c.id);

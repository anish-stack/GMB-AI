-- v9: panel colour per workspace, Facebook page + Instagram (test mode, enabled per tenant by super admin).
-- MariaDB 10.5+. Safe to run more than once.
-- mysql -u root -p gmb_ai < db/upgrade-v9-theme-social.sql

CREATE TABLE IF NOT EXISTS `social_accounts` (
  `id`               INT AUTO_INCREMENT PRIMARY KEY,
  `tenant_id`        INT NOT NULL,
  `client_id`        INT NOT NULL,
  `platform`         VARCHAR(20) NOT NULL,            -- facebook | instagram
  `page_id`          VARCHAR(64) NOT NULL,            -- FB page id (instagram rows keep the parent page id)
  `page_name`        VARCHAR(190),
  `ig_user_id`       VARCHAR(64),
  `ig_username`      VARCHAR(120),
  `picture_url`      VARCHAR(1000),
  `access_token_enc` TEXT NOT NULL,                   -- long-lived PAGE token (encrypted)
  `auto_publish`     TINYINT(1) NOT NULL DEFAULT 0,   -- copy every published GMB post here
  `dm_auto_reply`    TINYINT(1) NOT NULL DEFAULT 0,   -- instagram only
  `dm_use_ai`        TINYINT(1) NOT NULL DEFAULT 1,
  `dm_fallback`      VARCHAR(1000),
  `connected_by`     VARCHAR(120),
  `status`           VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  `last_error`       VARCHAR(500),
  `created_at`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_social_client_platform` (`client_id`,`platform`),
  KEY `idx_social_ig` (`ig_user_id`),
  KEY `idx_social_page` (`page_id`),
  CONSTRAINT `fk_social_client` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `social_posts` (
  `id`           INT AUTO_INCREMENT PRIMARY KEY,
  `tenant_id`    INT NOT NULL,
  `client_id`    INT NOT NULL,
  `platform`     VARCHAR(20) NOT NULL,
  `task_id`      INT NULL,
  `external_id`  VARCHAR(120),
  `permalink`    VARCHAR(1000),
  `message`      TEXT,
  `image_url`    VARCHAR(1000),
  `status`       VARCHAR(20) NOT NULL DEFAULT 'PUBLISHED',
  `error`        VARCHAR(500),
  `created_by`   VARCHAR(120),
  `created_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_social_posts_client` (`client_id`,`platform`,`created_at`),
  CONSTRAINT `fk_social_posts_client` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `ig_dm_rules` (
  `id`         INT AUTO_INCREMENT PRIMARY KEY,
  `client_id`  INT NOT NULL,
  `keywords`   VARCHAR(500) NOT NULL,                 -- comma separated, matched case-insensitively
  `reply`      VARCHAR(1000) NOT NULL,
  `active`     TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_dm_rules_client` (`client_id`),
  CONSTRAINT `fk_dm_rules_client` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `ig_dm_log` (
  `id`          INT AUTO_INCREMENT PRIMARY KEY,
  `client_id`   INT NOT NULL,
  `sender_id`   VARCHAR(64) NOT NULL,
  `message`     TEXT,
  `reply`       TEXT,
  `source`      VARCHAR(20),                          -- RULE | AI | FALLBACK | NONE | ERROR
  `rule_id`     INT NULL,
  `error`       VARCHAR(500),
  `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_dm_log_client` (`client_id`,`created_at`),
  CONSTRAINT `fk_dm_log_client` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `meta_pending` (
  `id`              VARCHAR(40) PRIMARY KEY,
  `tenant_id`       INT NOT NULL,
  `client_id`       INT NOT NULL,
  `user_token_enc`  TEXT NOT NULL,
  `expires_at`      DATETIME NOT NULL,
  `created_at`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE `tenants`
  ADD COLUMN IF NOT EXISTS `theme_color` VARCHAR(9) NULL,
  ADD COLUMN IF NOT EXISTS `social_enabled` TINYINT(1) NOT NULL DEFAULT 0;

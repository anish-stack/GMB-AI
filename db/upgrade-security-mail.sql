-- =====================================================================
-- Upgrade: OTP / two-factor login, background email queue, security flags
-- Run this once against your existing database:
--   mysql -u root -p gmb_ai < db/upgrade-security-mail.sql
-- =====================================================================

-- ---------- Users: 2FA + first-login tracking ----------
ALTER TABLE `users`
  ADD COLUMN `two_factor_enabled` TINYINT(1) NOT NULL DEFAULT 1 AFTER `active`,
  ADD COLUMN `otp_verified_once`  TINYINT(1) NOT NULL DEFAULT 0 AFTER `two_factor_enabled`,
  ADD COLUMN `failed_login_count` INT NOT NULL DEFAULT 0 AFTER `otp_verified_once`,
  ADD COLUMN `locked_until`       DATETIME NULL AFTER `failed_login_count`;

-- ---------- OTP challenges (login 2FA + password reset) ----------
CREATE TABLE IF NOT EXISTS `otp_codes` (
  `id`           INT AUTO_INCREMENT PRIMARY KEY,
  `user_id`      INT NOT NULL,
  `purpose`      VARCHAR(20) NOT NULL DEFAULT 'LOGIN', -- LOGIN | RESET_PASSWORD
  `challenge`    VARCHAR(64) NOT NULL,                 -- opaque id embedded in the signed challenge token
  `code_hash`    VARCHAR(255) NOT NULL,                -- sha256(code + pepper), never store the raw code
  `attempts`     INT NOT NULL DEFAULT 0,
  `max_attempts` INT NOT NULL DEFAULT 5,
  `consumed_at`  DATETIME NULL,
  `expires_at`   DATETIME NOT NULL,
  `ip`           VARCHAR(64) NULL,
  `created_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_otp_user` (`user_id`),
  KEY `idx_otp_challenge` (`challenge`),
  CONSTRAINT `fk_otp_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------- Background email queue (a worker drains this, not the request thread) ----------
CREATE TABLE IF NOT EXISTS `email_queue` (
  `id`           INT AUTO_INCREMENT PRIMARY KEY,
  `to_email`     VARCHAR(255) NOT NULL,
  `subject`      VARCHAR(255) NOT NULL,
  `html`         MEDIUMTEXT NOT NULL,
  `text`         MEDIUMTEXT NULL,
  `template`     VARCHAR(60) NOT NULL DEFAULT 'generic',
  `tenant_id`    INT NULL,
  `meta`         TEXT NULL,
  `status`       VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING | SENT | FAILED
  `attempts`     INT NOT NULL DEFAULT 0,
  `max_attempts` INT NOT NULL DEFAULT 5,
  `last_error`   VARCHAR(500) NULL,
  `available_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, -- lets us back off failed sends
  `sent_at`      DATETIME NULL,
  `created_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_email_status` (`status`, `available_at`),
  KEY `idx_email_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------- Simple API rate-limit ledger (per key e.g. "login:1.2.3.4") ----------
CREATE TABLE IF NOT EXISTS `rate_limit_hits` (
  `id`         BIGINT AUTO_INCREMENT PRIMARY KEY,
  `rkey`       VARCHAR(160) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_rate_key_time` (`rkey`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

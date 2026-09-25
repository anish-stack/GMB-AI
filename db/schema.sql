-- ============================================================
-- GMB AI SaaS - MySQL / MariaDB schema (XAMPP)
-- Multi-tenant: SUPER_ADMIN (platform) -> TENANT (agency) -> USERS -> CLIENTS
-- Import via phpMyAdmin OR run: npm run db:setup
-- ============================================================

CREATE DATABASE IF NOT EXISTS `gmb_ai` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `gmb_ai`;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS `audit_logs`;
DROP TABLE IF EXISTS `notifications`;
DROP TABLE IF EXISTS `api_keys`;
DROP TABLE IF EXISTS `tenant_invites`;
DROP TABLE IF EXISTS `coupon_redemptions`;
DROP TABLE IF EXISTS `coupons`;
DROP TABLE IF EXISTS `payments`;
DROP TABLE IF EXISTS `invoice_items`;
DROP TABLE IF EXISTS `invoices`;
DROP TABLE IF EXISTS `credit_ledger`;
DROP TABLE IF EXISTS `credit_packs`;
DROP TABLE IF EXISTS `credit_wallets`;
DROP TABLE IF EXISTS `usage_counters`;
DROP TABLE IF EXISTS `subscription_events`;
DROP TABLE IF EXISTS `subscriptions`;
DROP TABLE IF EXISTS `plans`;
DROP TABLE IF EXISTS `gmb_performance`;
DROP TABLE IF EXISTS `employee_approvals`;
DROP TABLE IF EXISTS `ai_reviews`;
DROP TABLE IF EXISTS `ai_executions`;
DROP TABLE IF EXISTS `gmb_post_keywords`;
DROP TABLE IF EXISTS `gmb_posts`;
DROP TABLE IF EXISTS `ai_tasks`;
DROP TABLE IF EXISTS `content_calendar`;
DROP TABLE IF EXISTS `keywords`;
DROP TABLE IF EXISTS `target_locations`;
DROP TABLE IF EXISTS `gmb_services`;
DROP TABLE IF EXISTS `gmb_profiles`;
DROP TABLE IF EXISTS `clients`;
DROP TABLE IF EXISTS `employees`;
DROP TABLE IF EXISTS `users`;
DROP TABLE IF EXISTS `tenants`;
DROP TABLE IF EXISTS `platform_settings`;
SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- PLATFORM LAYER (owned by SUPER_ADMIN)
-- ============================================================

CREATE TABLE `platform_settings` (
  `skey`       VARCHAR(80) NOT NULL PRIMARY KEY,
  `svalue`     LONGTEXT,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `plans` (
  `id`                  INT AUTO_INCREMENT PRIMARY KEY,
  `name`                VARCHAR(80)  NOT NULL,
  `slug`                VARCHAR(80)  NOT NULL UNIQUE,
  `tagline`             VARCHAR(180),
  `description`         TEXT,
  `currency`            VARCHAR(8)   NOT NULL DEFAULT 'INR',
  `price_monthly`       DECIMAL(10,2) NOT NULL DEFAULT 0,
  `price_yearly`        DECIMAL(10,2) NOT NULL DEFAULT 0,
  `trial_days`          INT NOT NULL DEFAULT 0,
  -- quotas: -1 = unlimited
  `max_clients`         INT NOT NULL DEFAULT 2,
  `max_team_members`    INT NOT NULL DEFAULT 1,
  `max_gmb_profiles`    INT NOT NULL DEFAULT 2,
  `max_posts_month`     INT NOT NULL DEFAULT 10,
  `max_scheduled_posts` INT NOT NULL DEFAULT 10,
  `max_keywords_client` INT NOT NULL DEFAULT 25,
  `ai_credits_month`    INT NOT NULL DEFAULT 300,
  `credit_rollover`     TINYINT(1) NOT NULL DEFAULT 0,
  -- feature flags
  `f_image_generation`  TINYINT(1) NOT NULL DEFAULT 1,
  `f_bulk_actions`      TINYINT(1) NOT NULL DEFAULT 0,
  `f_advanced_analytics` TINYINT(1) NOT NULL DEFAULT 0,
  `f_api_access`        TINYINT(1) NOT NULL DEFAULT 0,
  `f_white_label`       TINYINT(1) NOT NULL DEFAULT 0,
  `f_google_publish`    TINYINT(1) NOT NULL DEFAULT 0,
  `f_auto_publish`      TINYINT(1) NOT NULL DEFAULT 0,
  `f_priority_support`  TINYINT(1) NOT NULL DEFAULT 0,
  `f_export_reports`    TINYINT(1) NOT NULL DEFAULT 0,
  `highlights`          LONGTEXT,
  `is_public`           TINYINT(1) NOT NULL DEFAULT 1,
  `is_active`           TINYINT(1) NOT NULL DEFAULT 1,
  `sort_order`          INT NOT NULL DEFAULT 0,
  `created_at`          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `tenants` (
  `id`             INT AUTO_INCREMENT PRIMARY KEY,
  `name`           VARCHAR(160) NOT NULL,
  `slug`           VARCHAR(120) NOT NULL UNIQUE,
  `company_email`  VARCHAR(180),
  `phone`          VARCHAR(40),
  `website`        VARCHAR(255),
  `address`        VARCHAR(255),
  `city`           VARCHAR(90),
  `state`          VARCHAR(90),
  `country`        VARCHAR(90) DEFAULT 'India',
  `gst_number`     VARCHAR(40),
  `logo_url`       VARCHAR(500),
  `brand_color`    VARCHAR(20) DEFAULT '#F53236',
  `timezone`       VARCHAR(60) DEFAULT 'Asia/Kolkata',
  `status`         VARCHAR(20) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE | SUSPENDED | CANCELLED
  `suspend_reason` VARCHAR(400),
  `notes`          TEXT,
  `owner_user_id`  INT NULL,
  `created_at`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_tenant_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `users` (
  `id`            INT AUTO_INCREMENT PRIMARY KEY,
  `tenant_id`     INT NULL,                       -- NULL = platform SUPER_ADMIN
  `name`          VARCHAR(120) NOT NULL,
  `email`         VARCHAR(180) NOT NULL UNIQUE,
  `phone`         VARCHAR(40),
  `password_hash` VARCHAR(255) NOT NULL,
  `role`          VARCHAR(20)  NOT NULL DEFAULT 'MEMBER', -- SUPER_ADMIN | OWNER | MANAGER | MEMBER
  `avatar_url`    VARCHAR(500),
  `active`        TINYINT(1)   NOT NULL DEFAULT 1,
  `two_factor_enabled` TINYINT(1) NOT NULL DEFAULT 1,     -- email OTP required at login
  `otp_verified_once`  TINYINT(1) NOT NULL DEFAULT 0,     -- has completed at least one OTP challenge
  `failed_login_count` INT NOT NULL DEFAULT 0,
  `locked_until`       DATETIME NULL,                     -- brute-force lockout
  `last_login_at` DATETIME NULL,
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_user_tenant` (`tenant_id`),
  CONSTRAINT `fk_user_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE `tenants`
  ADD CONSTRAINT `fk_tenant_owner` FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL;

CREATE TABLE `subscriptions` (
  `id`                   INT AUTO_INCREMENT PRIMARY KEY,
  `tenant_id`            INT NOT NULL,
  `plan_id`              INT NOT NULL,
  `status`               VARCHAR(20) NOT NULL DEFAULT 'TRIALING', -- TRIALING | ACTIVE | PAST_DUE | CANCELLED | EXPIRED
  `billing_cycle`        VARCHAR(10) NOT NULL DEFAULT 'MONTHLY',  -- MONTHLY | YEARLY
  `price`                DECIMAL(10,2) NOT NULL DEFAULT 0,
  `currency`             VARCHAR(8) NOT NULL DEFAULT 'INR',
  `started_at`           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `trial_ends_at`        DATETIME NULL,
  `current_period_start` DATE NOT NULL,
  `current_period_end`   DATE NOT NULL,
  `cancel_at_period_end` TINYINT(1) NOT NULL DEFAULT 0,
  `cancelled_at`         DATETIME NULL,
  `overrides`            LONGTEXT,   -- JSON: super-admin per-tenant limit overrides
  `created_at`           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_sub_tenant` (`tenant_id`),
  KEY `idx_sub_status` (`status`),
  CONSTRAINT `fk_sub_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_sub_plan` FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `subscription_events` (
  `id`              INT AUTO_INCREMENT PRIMARY KEY,
  `subscription_id` INT NOT NULL,
  `tenant_id`       INT NOT NULL,
  `event`           VARCHAR(40) NOT NULL,  -- CREATED | UPGRADED | DOWNGRADED | RENEWED | CANCELLED | SUSPENDED | RESUMED | OVERRIDE
  `from_plan_id`    INT NULL,
  `to_plan_id`      INT NULL,
  `actor`           VARCHAR(120),
  `note`            VARCHAR(500),
  `created_at`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_subev_sub` FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `usage_counters` (
  `id`           INT AUTO_INCREMENT PRIMARY KEY,
  `tenant_id`    INT NOT NULL,
  `period`       CHAR(7) NOT NULL,          -- YYYY-MM
  `metric`       VARCHAR(40) NOT NULL,      -- posts_generated | posts_published | ai_calls | images | credits
  `used`         INT NOT NULL DEFAULT 0,
  `updated_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_usage` (`tenant_id`,`period`,`metric`),
  CONSTRAINT `fk_usage_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `credit_wallets` (
  `tenant_id`        INT NOT NULL PRIMARY KEY,
  `plan_credits`     INT NOT NULL DEFAULT 0,   -- refilled each period
  `purchased_credits` INT NOT NULL DEFAULT 0,  -- top-ups, never expire
  `lifetime_granted` INT NOT NULL DEFAULT 0,
  `lifetime_used`    INT NOT NULL DEFAULT 0,
  `low_balance_alert` INT NOT NULL DEFAULT 50,
  `updated_at`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_wallet_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `credit_ledger` (
  `id`          INT AUTO_INCREMENT PRIMARY KEY,
  `tenant_id`   INT NOT NULL,
  `delta`       INT NOT NULL,               -- +grant / -debit
  `bucket`      VARCHAR(20) NOT NULL DEFAULT 'PLAN', -- PLAN | PURCHASED
  `reason`      VARCHAR(60) NOT NULL,       -- PLAN_ALLOCATION | TOPUP | AI_TEXT | AI_IMAGE | ADMIN_GRANT | REFUND
  `ref_type`    VARCHAR(30),
  `ref_id`      INT NULL,
  `balance_after` INT NOT NULL DEFAULT 0,
  `note`        VARCHAR(300),
  `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_ledger_tenant` (`tenant_id`,`created_at`),
  CONSTRAINT `fk_ledger_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `credit_packs` (
  `id`         INT AUTO_INCREMENT PRIMARY KEY,
  `name`       VARCHAR(80) NOT NULL,
  `credits`    INT NOT NULL,
  `price`      DECIMAL(10,2) NOT NULL,
  `currency`   VARCHAR(8) NOT NULL DEFAULT 'INR',
  `is_active`  TINYINT(1) NOT NULL DEFAULT 1,
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `invoices` (
  `id`             INT AUTO_INCREMENT PRIMARY KEY,
  `invoice_no`     VARCHAR(40) NOT NULL UNIQUE,
  `tenant_id`      INT NOT NULL,
  `subscription_id` INT NULL,
  `type`           VARCHAR(20) NOT NULL DEFAULT 'SUBSCRIPTION', -- SUBSCRIPTION | CREDIT_PACK | MANUAL
  `subtotal`       DECIMAL(10,2) NOT NULL DEFAULT 0,
  `discount`       DECIMAL(10,2) NOT NULL DEFAULT 0,
  `tax`            DECIMAL(10,2) NOT NULL DEFAULT 0,
  `total`          DECIMAL(10,2) NOT NULL DEFAULT 0,
  `currency`       VARCHAR(8) NOT NULL DEFAULT 'INR',
  `status`         VARCHAR(20) NOT NULL DEFAULT 'DUE', -- DUE | PAID | FAILED | REFUNDED | VOID
  `coupon_code`    VARCHAR(40),
  `period_start`   DATE NULL,
  `period_end`     DATE NULL,
  `due_date`       DATE NULL,
  `paid_at`        DATETIME NULL,
  `notes`          VARCHAR(400),
  `created_at`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_inv_tenant` (`tenant_id`),
  CONSTRAINT `fk_inv_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `invoice_items` (
  `id`         INT AUTO_INCREMENT PRIMARY KEY,
  `invoice_id` INT NOT NULL,
  `label`      VARCHAR(200) NOT NULL,
  `qty`        INT NOT NULL DEFAULT 1,
  `unit_price` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `amount`     DECIMAL(10,2) NOT NULL DEFAULT 0,
  CONSTRAINT `fk_item_inv` FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `payments` (
  `id`          INT AUTO_INCREMENT PRIMARY KEY,
  `tenant_id`   INT NOT NULL,
  `invoice_id`  INT NULL,
  `amount`      DECIMAL(10,2) NOT NULL,
  `currency`    VARCHAR(8) NOT NULL DEFAULT 'INR',
  `gateway`     VARCHAR(30) NOT NULL DEFAULT 'MANUAL', -- MANUAL | RAZORPAY
  `gateway_order_id`   VARCHAR(120),
  `gateway_payment_id` VARCHAR(120),
  `status`      VARCHAR(20) NOT NULL DEFAULT 'SUCCESS', -- CREATED | SUCCESS | FAILED
  `raw`         LONGTEXT,
  `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_pay_tenant` (`tenant_id`),
  CONSTRAINT `fk_pay_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `coupons` (
  `id`             INT AUTO_INCREMENT PRIMARY KEY,
  `code`           VARCHAR(40) NOT NULL UNIQUE,
  `description`    VARCHAR(200),
  `discount_type`  VARCHAR(10) NOT NULL DEFAULT 'PERCENT', -- PERCENT | FLAT
  `discount_value` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `max_redemptions` INT NOT NULL DEFAULT 0,   -- 0 = unlimited
  `redeemed_count` INT NOT NULL DEFAULT 0,
  `applies_to_plan_id` INT NULL,
  `valid_from`     DATE NULL,
  `valid_until`    DATE NULL,
  `is_active`      TINYINT(1) NOT NULL DEFAULT 1,
  `created_at`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `coupon_redemptions` (
  `id`         INT AUTO_INCREMENT PRIMARY KEY,
  `coupon_id`  INT NOT NULL,
  `tenant_id`  INT NOT NULL,
  `invoice_id` INT NULL,
  `amount_off` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_red_coupon` FOREIGN KEY (`coupon_id`) REFERENCES `coupons`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `tenant_invites` (
  `id`         INT AUTO_INCREMENT PRIMARY KEY,
  `tenant_id`  INT NOT NULL,
  `email`      VARCHAR(180) NOT NULL,
  `name`       VARCHAR(120),
  `role`       VARCHAR(20) NOT NULL DEFAULT 'MEMBER',
  `token`      VARCHAR(80) NOT NULL UNIQUE,
  `status`     VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING | ACCEPTED | REVOKED | EXPIRED
  `invited_by` INT NULL,
  `expires_at` DATETIME NULL,
  `accepted_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_invite_tenant` (`tenant_id`),
  CONSTRAINT `fk_invite_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `api_keys` (
  `id`          INT AUTO_INCREMENT PRIMARY KEY,
  `tenant_id`   INT NOT NULL,
  `name`        VARCHAR(120) NOT NULL,
  `key_prefix`  VARCHAR(16) NOT NULL,
  `key_hash`    VARCHAR(255) NOT NULL,
  `last_used_at` DATETIME NULL,
  `revoked`     TINYINT(1) NOT NULL DEFAULT 0,
  `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_key_tenant` (`tenant_id`),
  CONSTRAINT `fk_key_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `notifications` (
  `id`         INT AUTO_INCREMENT PRIMARY KEY,
  `tenant_id`  INT NULL,          -- NULL = platform notification for super admin
  `user_id`    INT NULL,          -- NULL = whole tenant
  `type`       VARCHAR(40) NOT NULL DEFAULT 'INFO',
  `title`      VARCHAR(220) NOT NULL,
  `body`       VARCHAR(600),
  `link`       VARCHAR(255),
  `is_read`    TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_notif_tenant` (`tenant_id`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `audit_logs` (
  `id`         INT AUTO_INCREMENT PRIMARY KEY,
  `tenant_id`  INT NULL,
  `user_id`    INT NULL,
  `user_name`  VARCHAR(120),
  `role`       VARCHAR(20),
  `action`     VARCHAR(60) NOT NULL,
  `entity`     VARCHAR(40),
  `entity_id`  INT NULL,
  `meta`       LONGTEXT,
  `ip`         VARCHAR(60),
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_audit_tenant` (`tenant_id`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- TENANT WORKSPACE (all rows carry tenant_id)
-- ============================================================

CREATE TABLE `employees` (
  `id`         INT AUTO_INCREMENT PRIMARY KEY,
  `tenant_id`  INT NOT NULL,
  `user_id`    INT NOT NULL,
  `department` VARCHAR(80) DEFAULT 'SEO',
  `capacity`   INT NOT NULL DEFAULT 40,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_emp_tenant` (`tenant_id`),
  CONSTRAINT `fk_emp_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_emp_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `clients` (
  `id`                    INT AUTO_INCREMENT PRIMARY KEY,
  `tenant_id`             INT NOT NULL,
  `business_name`         VARCHAR(180) NOT NULL,
  `business_category`     VARCHAR(120) NOT NULL,
  `description`           TEXT,
  `phone`                 VARCHAR(40),
  `website`               VARCHAR(255),
  `address`               VARCHAR(255),
  `city`                  VARCHAR(90),
  `state`                 VARCHAR(90),
  `country`               VARCHAR(90) DEFAULT 'India',
  `preferred_language`    VARCHAR(40)  NOT NULL DEFAULT 'English',
  `content_tone`          VARCHAR(40)  NOT NULL DEFAULT 'Professional',
  `posting_frequency`     VARCHAR(40)  NOT NULL DEFAULT 'WEEKLY',
  `gmb_location_id`       VARCHAR(120),
  `gmb_connection_status` VARCHAR(30)  NOT NULL DEFAULT 'MOCK_CONNECTED',
  `google_refresh_token`  TEXT NULL,
  `google_email`          VARCHAR(180) NULL,
  `google_account_id`     VARCHAR(120) NULL,
  `google_location_name`  VARCHAR(180) NULL,
  `google_connected_at`   DATETIME NULL,
  `google_scope`          VARCHAR(255) NULL,
  `assigned_employee_id`  INT NULL,
  `approved_claims`       TEXT,
  `prohibited_claims`     TEXT,
  `active`                TINYINT(1) NOT NULL DEFAULT 1,
  `created_at`            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_client_tenant` (`tenant_id`),
  KEY `idx_client_city` (`city`),
  CONSTRAINT `fk_client_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_client_emp` FOREIGN KEY (`assigned_employee_id`) REFERENCES `employees`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `gmb_profiles` (
  `id`                INT AUTO_INCREMENT PRIMARY KEY,
  `tenant_id`         INT NOT NULL,
  `client_id`         INT NOT NULL,
  `location_name`     VARCHAR(180) NOT NULL,
  `category`          VARCHAR(120),
  `address`           VARCHAR(255),
  `phone`             VARCHAR(40),
  `website`           VARCHAR(255),
  `opening_hours`     TEXT,
  `map_url`           VARCHAR(255),
  `rating`            DECIMAL(3,2) DEFAULT 0,
  `review_count`      INT DEFAULT 0,
  `connection_status` VARCHAR(30) NOT NULL DEFAULT 'MOCK_CONNECTED',
  `provider`          VARCHAR(20) NOT NULL DEFAULT 'mock',
  `last_synced_at`    DATETIME NULL,
  `created_at`        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_profile_tenant` (`tenant_id`),
  CONSTRAINT `fk_profile_client` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `gmb_services` (
  `id`          INT AUTO_INCREMENT PRIMARY KEY,
  `client_id`   INT NOT NULL,
  `name`        VARCHAR(160) NOT NULL,
  `description` VARCHAR(500),
  `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_service_client` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `target_locations` (
  `id`        INT AUTO_INCREMENT PRIMARY KEY,
  `client_id` INT NOT NULL,
  `name`      VARCHAR(160) NOT NULL,
  CONSTRAINT `fk_loc_client` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `keywords` (
  `id`              INT AUTO_INCREMENT PRIMARY KEY,
  `tenant_id`       INT NOT NULL,
  `client_id`       INT NOT NULL,
  `keyword`         VARCHAR(180) NOT NULL,
  `kw_type`         VARCHAR(20) NOT NULL DEFAULT 'PRIMARY',
  `source`          VARCHAR(20) NOT NULL DEFAULT 'CLIENT',
  `reason`          VARCHAR(500),
  `relevance_score` INT DEFAULT 0,
  `priority`        VARCHAR(20) DEFAULT 'MEDIUM',
  `has_volume_data` TINYINT(1) NOT NULL DEFAULT 0,
  `search_volume`   INT NULL,
  `created_at`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_kw_client` (`client_id`),
  KEY `idx_kw_tenant` (`tenant_id`),
  CONSTRAINT `fk_kw_client` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `content_calendar` (
  `id`                   INT AUTO_INCREMENT PRIMARY KEY,
  `tenant_id`            INT NOT NULL,
  `client_id`            INT NOT NULL,
  `scheduled_date`       DATE NOT NULL,
  `post_type`            VARCHAR(40) NOT NULL DEFAULT 'Service',
  `topic`                VARCHAR(200),
  `status`               VARCHAR(30) NOT NULL DEFAULT 'SCHEDULED',
  `assigned_employee_id` INT NULL,
  `created_at`           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_cal_date` (`scheduled_date`),
  KEY `idx_cal_tenant` (`tenant_id`),
  CONSTRAINT `fk_cal_client` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_cal_emp` FOREIGN KEY (`assigned_employee_id`) REFERENCES `employees`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `ai_tasks` (
  `id`                   INT AUTO_INCREMENT PRIMARY KEY,
  `tenant_id`            INT NOT NULL,
  `client_id`            INT NOT NULL,
  `calendar_id`          INT NULL,
  `assigned_employee_id` INT NULL,
  `status`               VARCHAR(30) NOT NULL DEFAULT 'PENDING',
  `post_type`            VARCHAR(40) DEFAULT 'Service',
  `scheduled_date`       DATE NULL,
  `research`             LONGTEXT,
  `keyword_data`         LONGTEXT,
  `topic`                VARCHAR(220),
  `topic_reason`         VARCHAR(600),
  `topic_priority`       VARCHAR(20),
  `title`                VARCHAR(255),
  `description`          TEXT,
  `cta`                  VARCHAR(120),
  `primary_keyword`      VARCHAR(180),
  `secondary_keywords`   TEXT,
  `hashtags`             TEXT,
  `image_concept`        VARCHAR(600),
  `image_url`            LONGTEXT,
  `image_provider`       VARCHAR(40) DEFAULT 'placeholder',
  `image_storage_provider` VARCHAR(20) NULL,
  `image_storage_key`    VARCHAR(300) NULL,
  `embedding`            LONGTEXT,
  `duplicate_score`      DECIMAL(5,4) DEFAULT 0,
  `duplicate_of`         INT NULL,
  `qa_score`             INT NULL,
  `qa_status`            VARCHAR(20) NULL,
  `regenerate_count`     INT NOT NULL DEFAULT 0,
  `image_regen_count`    INT NOT NULL DEFAULT 0,
  `credits_used`         INT NOT NULL DEFAULT 0,
  `error_message`        TEXT,
  `published_at`         DATETIME NULL,
  `created_at`           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_task_status` (`status`),
  KEY `idx_task_date` (`scheduled_date`),
  KEY `idx_task_tenant` (`tenant_id`),
  CONSTRAINT `fk_task_client` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_task_cal` FOREIGN KEY (`calendar_id`) REFERENCES `content_calendar`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Every AI-generated image for a task, including ones never picked. The
-- currently-used image is the row with status='SELECTED' (its url/provider
-- are mirrored onto ai_tasks.image_url/image_provider for fast reads).
-- 'CANDIDATE' rows are pending options from "generate N images and choose
-- one"; 'DELETED' rows are kept for the audit trail after their storage
-- object has been removed (regenerate, un-picked option, or 90-day cleanup).
CREATE TABLE `task_image_candidates` (
  `id`                 INT AUTO_INCREMENT PRIMARY KEY,
  `task_id`            INT NOT NULL,
  `tenant_id`          INT NULL,
  `url`                LONGTEXT,
  `storage_provider`   VARCHAR(20) NULL,
  `storage_key`        VARCHAR(300) NULL,
  `ai_provider`        VARCHAR(80) NULL,
  `ai_model`           VARCHAR(120) NULL,
  `prompt`             TEXT,
  `content_hash`       VARCHAR(64) NULL,
  `status`             VARCHAR(20) NOT NULL DEFAULT 'CANDIDATE',
  `created_at`         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `deleted_at`         DATETIME NULL,
  KEY `idx_imgcand_task` (`task_id`),
  KEY `idx_imgcand_status` (`status`),
  KEY `idx_imgcand_created` (`created_at`),
  KEY `idx_imgcand_hash` (`content_hash`),
  CONSTRAINT `fk_imgcand_task` FOREIGN KEY (`task_id`) REFERENCES `ai_tasks`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `gmb_posts` (
  `id`           INT AUTO_INCREMENT PRIMARY KEY,
  `tenant_id`    INT NOT NULL,
  `client_id`    INT NOT NULL,
  `task_id`      INT NULL,
  `title`        VARCHAR(255) NOT NULL,
  `description`  TEXT,
  `cta`          VARCHAR(120),
  `image_url`    LONGTEXT,
  `post_type`    VARCHAR(40),
  `status`       VARCHAR(30) NOT NULL DEFAULT 'PUBLISHED',
  `provider`     VARCHAR(20) NOT NULL DEFAULT 'mock',
  `is_mock`      TINYINT(1) NOT NULL DEFAULT 1,
  `external_id`  VARCHAR(120),
  `published_at` DATETIME NULL,
  `created_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_post_client` (`client_id`),
  KEY `idx_post_tenant` (`tenant_id`),
  CONSTRAINT `fk_post_client` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_post_task` FOREIGN KEY (`task_id`) REFERENCES `ai_tasks`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `gmb_post_keywords` (
  `id`         INT AUTO_INCREMENT PRIMARY KEY,
  `post_id`    INT NOT NULL,
  `keyword_id` INT NULL,
  `keyword`    VARCHAR(180) NOT NULL,
  `kw_type`    VARCHAR(20) DEFAULT 'PRIMARY',
  CONSTRAINT `fk_pk_post` FOREIGN KEY (`post_id`) REFERENCES `gmb_posts`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pk_kw` FOREIGN KEY (`keyword_id`) REFERENCES `keywords`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `ai_executions` (
  `id`             INT AUTO_INCREMENT PRIMARY KEY,
  `tenant_id`      INT NULL,
  `task_id`        INT NULL,
  `client_id`      INT NULL,
  `agent`          VARCHAR(40) NOT NULL,
  `provider`       VARCHAR(30) NOT NULL,
  `model`          VARCHAR(180),
  `input_tokens`   INT NULL,
  `output_tokens`  INT NULL,
  `estimated_cost` DECIMAL(10,6) NULL,
  `credits_charged` INT NOT NULL DEFAULT 0,
  `duration_ms`    INT NOT NULL DEFAULT 0,
  `status`         VARCHAR(20) NOT NULL DEFAULT 'SUCCESS',
  `attempt`        INT NOT NULL DEFAULT 1,
  `error`          TEXT,
  `prompt_preview` TEXT,
  `output_preview` LONGTEXT,
  `created_at`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_exec_task` (`task_id`),
  KEY `idx_exec_tenant` (`tenant_id`),
  CONSTRAINT `fk_exec_task` FOREIGN KEY (`task_id`) REFERENCES `ai_tasks`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `ai_reviews` (
  `id`         INT AUTO_INCREMENT PRIMARY KEY,
  `task_id`    INT NOT NULL,
  `score`      INT NOT NULL DEFAULT 0,
  `status`     VARCHAR(20) NOT NULL DEFAULT 'PASS',
  `checks`     TEXT,
  `issues`     TEXT,
  `warnings`   TEXT,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_review_task` FOREIGN KEY (`task_id`) REFERENCES `ai_tasks`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `employee_approvals` (
  `id`          INT AUTO_INCREMENT PRIMARY KEY,
  `task_id`     INT NOT NULL,
  `employee_id` INT NULL,
  `user_name`   VARCHAR(120),
  `action`      VARCHAR(30) NOT NULL,
  `notes`       VARCHAR(600),
  `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_appr_task` FOREIGN KEY (`task_id`) REFERENCES `ai_tasks`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `gmb_performance` (
  `id`                 INT AUTO_INCREMENT PRIMARY KEY,
  `tenant_id`          INT NOT NULL,
  `client_id`          INT NOT NULL,
  `post_id`            INT NULL,
  `stat_date`          DATE NOT NULL,
  `views`              INT DEFAULT 0,
  `clicks`             INT DEFAULT 0,
  `calls`              INT DEFAULT 0,
  `direction_requests` INT DEFAULT 0,
  `is_mock`            TINYINT(1) NOT NULL DEFAULT 1,
  KEY `idx_perf_tenant` (`tenant_id`),
  CONSTRAINT `fk_perf_client` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_perf_post` FOREIGN KEY (`post_id`) REFERENCES `gmb_posts`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================================
-- Security / notifications: OTP 2FA challenges + background email queue
-- (kept in sync with db/upgrade-security-mail.sql for existing installs)
-- =====================================================================
CREATE TABLE `otp_codes` (
  `id`           INT AUTO_INCREMENT PRIMARY KEY,
  `user_id`      INT NOT NULL,
  `purpose`      VARCHAR(20) NOT NULL DEFAULT 'LOGIN', -- LOGIN | RESET_PASSWORD
  `challenge`    VARCHAR(64) NOT NULL,
  `code_hash`    VARCHAR(255) NOT NULL,
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

CREATE TABLE `email_queue` (
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
  `available_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `sent_at`      DATETIME NULL,
  `created_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_email_status` (`status`, `available_at`),
  KEY `idx_email_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `rate_limit_hits` (
  `id`         BIGINT AUTO_INCREMENT PRIMARY KEY,
  `rkey`       VARCHAR(160) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_rate_key_time` (`rkey`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

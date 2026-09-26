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
DROP TABLE IF EXISTS `signup_intents`;
DROP TABLE IF EXISTS `health_check_runs`;
DROP TABLE IF EXISTS `system_heartbeats`;
DROP TABLE IF EXISTS `integration_settings`;
DROP TABLE IF EXISTS `client_posting_plans`;
DROP TABLE IF EXISTS `cms_pages`;
DROP TABLE IF EXISTS `support_ticket_messages`;
DROP TABLE IF EXISTS `support_tickets`;
DROP TABLE IF EXISTS `api_rate_counters`;
DROP TABLE IF EXISTS `api_usage_daily`;
DROP TABLE IF EXISTS `report_shares`;
DROP TABLE IF EXISTS `fcm_tokens`;
DROP TABLE IF EXISTS `notification_broadcasts`;
DROP TABLE IF EXISTS `task_image_candidates`;
DROP TABLE IF EXISTS `otp_codes`;
DROP TABLE IF EXISTS `email_queue`;
DROP TABLE IF EXISTS `rate_limit_hits`;
DROP TABLE IF EXISTS `rank_scans`;
DROP TABLE IF EXISTS `listing_health`;
DROP TABLE IF EXISTS `review_inbox`;
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

-- Email-verified signup + payment at registration
CREATE TABLE IF NOT EXISTS `signup_intents` (
  `id`                 INT AUTO_INCREMENT PRIMARY KEY,
  `email`              VARCHAR(190) NOT NULL,
  `company_name`       VARCHAR(180) NOT NULL,
  `owner_name`         VARCHAR(120) NOT NULL,
  `phone`              VARCHAR(40),
  `password_hash`      VARCHAR(100) NOT NULL,
  `plan_id`            INT NOT NULL,
  `billing_cycle`      VARCHAR(10) NOT NULL DEFAULT 'MONTHLY',
  `amount`             DECIMAL(10,2) NOT NULL DEFAULT 0,
  `currency`           VARCHAR(8) NOT NULL DEFAULT 'INR',
  `code_hash`          VARCHAR(80),
  `attempts`           INT NOT NULL DEFAULT 0,
  `code_expires_at`    DATETIME NULL,
  `email_verified_at`  DATETIME NULL,
  `gateway_order_id`   VARCHAR(120),
  `gateway_payment_id` VARCHAR(120),
  `status`             VARCHAR(20) NOT NULL DEFAULT 'PENDING_OTP', -- PENDING_OTP | VERIFIED | PAYMENT_PENDING | PROVISIONING | COMPLETED | FAILED
  `tenant_id`          INT NULL,
  `ip`                 VARCHAR(64),
  `created_at`         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_si_email` (`email`),
  KEY `idx_si_order` (`gateway_order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ===================== v5 platform =====================
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

-- ===================== v6 reviews / health / rank =====================
CREATE TABLE IF NOT EXISTS `review_inbox` (
  `id`               INT AUTO_INCREMENT PRIMARY KEY,
  `tenant_id`        INT NOT NULL,
  `client_id`        INT NOT NULL,
  `review_id`        VARCHAR(190) NOT NULL,
  `author`           VARCHAR(160),
  `rating`           TINYINT NULL,
  `comment`          TEXT,
  `review_created_at` DATETIME NULL,
  `review_updated_at` DATETIME NULL,
  `reply_comment`    TEXT,
  `replied_at`       DATETIME NULL,
  `status`           VARCHAR(20) NOT NULL DEFAULT 'UNREPLIED',  -- UNREPLIED | REPLIED | IGNORED
  `ai_draft`         TEXT,
  `ai_draft_tone`    VARCHAR(20),
  `ai_draft_at`      DATETIME NULL,
  `replied_by`       VARCHAR(120),
  `source`           VARCHAR(20) NOT NULL DEFAULT 'SYNC',       -- SYNC | PUBSUB
  `first_seen_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_inbox_review` (`client_id`,`review_id`),
  KEY `idx_inbox_tenant` (`tenant_id`,`status`,`review_created_at`),
  CONSTRAINT `fk_inbox_client` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `listing_health` (
  `client_id`        INT NOT NULL PRIMARY KEY,
  `tenant_id`        INT NOT NULL,
  `status`           VARCHAR(20) NOT NULL DEFAULT 'UNKNOWN',     -- OK | WARNING | CRITICAL | UNKNOWN
  `issues`           LONGTEXT,                                  -- JSON [{code,severity,message}]
  `verified`         TINYINT(1) NULL,
  `has_voice_of_merchant` TINYINT(1) NULL,
  `duplicate`        TINYINT(1) NULL,
  `open_status`      VARCHAR(40),
  `checked_at`       DATETIME NULL,
  `status_changed_at` DATETIME NULL,
  CONSTRAINT `fk_health_client` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `rank_scans` (
  `id`            INT AUTO_INCREMENT PRIMARY KEY,
  `tenant_id`     INT NOT NULL,
  `client_id`     INT NOT NULL,
  `keyword`       VARCHAR(160) NOT NULL,
  `grid_size`     TINYINT NOT NULL DEFAULT 5,
  `spacing_km`    DECIMAL(5,2) NOT NULL DEFAULT 1.00,
  `center_lat`    DECIMAL(10,7) NOT NULL,
  `center_lng`    DECIMAL(10,7) NOT NULL,
  `place_id`      VARCHAR(190) NOT NULL,
  `status`        VARCHAR(20) NOT NULL DEFAULT 'QUEUED',  -- QUEUED | RUNNING | DONE | FAILED
  `is_sample`     TINYINT(1) NOT NULL DEFAULT 0,
  `points_done`   INT NOT NULL DEFAULT 0,
  `avg_rank`      DECIMAL(5,2) NULL,
  `top3_pct`      INT NULL,
  `found_pct`     INT NULL,
  `results`       LONGTEXT,     -- JSON [{row,col,lat,lng,rank,top:[{name,rating,reviews}]}]
  `competitors`   LONGTEXT,     -- JSON [{place_id,name,rating,reviews,appearances,avg_rank}]
  `error`         VARCHAR(500),
  `created_by`    VARCHAR(120),
  `created_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `finished_at`   DATETIME NULL,
  KEY `idx_rank_client` (`client_id`,`keyword`,`created_at`),
  KEY `idx_rank_tenant` (`tenant_id`,`created_at`),
  CONSTRAINT `fk_rank_client` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE `clients`
  ADD COLUMN IF NOT EXISTS `place_id` VARCHAR(190) NULL,
  ADD COLUMN IF NOT EXISTS `latitude` DECIMAL(10,7) NULL,
  ADD COLUMN IF NOT EXISTS `longitude` DECIMAL(10,7) NULL;

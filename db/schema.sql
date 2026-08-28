-- ============================================================
-- GMB AI Manager - MySQL / MariaDB schema (XAMPP)
-- Import via phpMyAdmin OR run: npm run db:setup
-- ============================================================

CREATE DATABASE IF NOT EXISTS `gmb_ai` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `gmb_ai`;

SET FOREIGN_KEY_CHECKS = 0;
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
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE `users` (
  `id`            INT AUTO_INCREMENT PRIMARY KEY,
  `name`          VARCHAR(120) NOT NULL,
  `email`         VARCHAR(180) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `role`          VARCHAR(20)  NOT NULL DEFAULT 'EMPLOYEE',
  `active`        TINYINT(1)   NOT NULL DEFAULT 1,
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `employees` (
  `id`         INT AUTO_INCREMENT PRIMARY KEY,
  `user_id`    INT NOT NULL,
  `department` VARCHAR(80) DEFAULT 'SEO',
  `capacity`   INT NOT NULL DEFAULT 40,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_emp_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `clients` (
  `id`                    INT AUTO_INCREMENT PRIMARY KEY,
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
  -- filled after the client completes Google OAuth on your panel
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
  KEY `idx_client_city` (`city`),
  CONSTRAINT `fk_client_emp` FOREIGN KEY (`assigned_employee_id`) REFERENCES `employees`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `gmb_profiles` (
  `id`                INT AUTO_INCREMENT PRIMARY KEY,
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
  CONSTRAINT `fk_kw_client` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `content_calendar` (
  `id`                   INT AUTO_INCREMENT PRIMARY KEY,
  `client_id`            INT NOT NULL,
  `scheduled_date`       DATE NOT NULL,
  `post_type`            VARCHAR(40) NOT NULL DEFAULT 'Service',
  `topic`                VARCHAR(200),
  `status`               VARCHAR(30) NOT NULL DEFAULT 'SCHEDULED',
  `assigned_employee_id` INT NULL,
  `created_at`           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_cal_date` (`scheduled_date`),
  CONSTRAINT `fk_cal_client` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_cal_emp` FOREIGN KEY (`assigned_employee_id`) REFERENCES `employees`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `ai_tasks` (
  `id`                   INT AUTO_INCREMENT PRIMARY KEY,
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
  `embedding`            LONGTEXT,
  `duplicate_score`      DECIMAL(5,4) DEFAULT 0,
  `duplicate_of`         INT NULL,
  `qa_score`             INT NULL,
  `qa_status`            VARCHAR(20) NULL,
  `regenerate_count`     INT NOT NULL DEFAULT 0,
  `error_message`        TEXT,
  `published_at`         DATETIME NULL,
  `created_at`           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_task_status` (`status`),
  KEY `idx_task_date` (`scheduled_date`),
  CONSTRAINT `fk_task_client` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_task_cal` FOREIGN KEY (`calendar_id`) REFERENCES `content_calendar`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `gmb_posts` (
  `id`           INT AUTO_INCREMENT PRIMARY KEY,
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
  `task_id`        INT NULL,
  `client_id`      INT NULL,
  `agent`          VARCHAR(40) NOT NULL,
  `provider`       VARCHAR(30) NOT NULL,
  `model`          VARCHAR(180),
  `input_tokens`   INT NULL,
  `output_tokens`  INT NULL,
  `estimated_cost` DECIMAL(10,6) NULL,
  `duration_ms`    INT NOT NULL DEFAULT 0,
  `status`         VARCHAR(20) NOT NULL DEFAULT 'SUCCESS',
  `attempt`        INT NOT NULL DEFAULT 1,
  `error`          TEXT,
  `prompt_preview` TEXT,
  `output_preview` LONGTEXT,
  `created_at`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_exec_task` (`task_id`),
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
  `client_id`          INT NOT NULL,
  `post_id`            INT NULL,
  `stat_date`          DATE NOT NULL,
  `views`              INT DEFAULT 0,
  `clicks`             INT DEFAULT 0,
  `calls`              INT DEFAULT 0,
  `direction_requests` INT DEFAULT 0,
  `is_mock`            TINYINT(1) NOT NULL DEFAULT 1,
  CONSTRAINT `fk_perf_client` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_perf_post` FOREIGN KEY (`post_id`) REFERENCES `gmb_posts`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

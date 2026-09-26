-- v6: real-time review inbox (Pub/Sub + sync), listing health monitor, local rank grid.
-- MariaDB 10.5+. Safe to run more than once.
-- mysql -u root -p gmb_ai < db/upgrade-v6-reviews-rank.sql

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

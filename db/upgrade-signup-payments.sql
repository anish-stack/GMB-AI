-- v4: email-verified signup + Razorpay checkout at registration.
-- Run once: mysql -u root -p gmb_ai < db/upgrade-signup-payments.sql
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

INSERT IGNORE INTO platform_settings (skey, svalue) VALUES ('razorpay_webhook_secret', '');

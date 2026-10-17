-- v11: per-member permissions, admin-managed AI prompts + image styles,
-- HBS Suite rename, agency white-label, own-company (internal) accounts.
-- MariaDB 10.5+. Safe to run more than once.
-- mysql -u root -p gmb_ai < db/upgrade-v11-roles-prompts-brand.sql

-- per-member permissions (NULL = role default: everything except billing & settings)
ALTER TABLE `users`
  ADD COLUMN IF NOT EXISTS `permissions` TEXT NULL;

-- white-label + own-company
ALTER TABLE `tenants`
  ADD COLUMN IF NOT EXISTS `brand_name` VARCHAR(60) NULL,
  ADD COLUMN IF NOT EXISTS `brand_logo_url` VARCHAR(1000) NULL,
  ADD COLUMN IF NOT EXISTS `account_type` VARCHAR(20) NOT NULL DEFAULT 'CUSTOMER';  -- CUSTOMER | INTERNAL

-- admin prompt overrides (defaults live in code)
CREATE TABLE IF NOT EXISTS `ai_prompts` (
  `pkey`        VARCHAR(80) NOT NULL PRIMARY KEY,
  `content`     MEDIUMTEXT NOT NULL,
  `updated_by`  VARCHAR(120) NULL,
  `updated_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- admin image styles
CREATE TABLE IF NOT EXISTS `image_styles` (
  `id`          INT AUTO_INCREMENT PRIMARY KEY,
  `name`        VARCHAR(80) NOT NULL,
  `description` VARCHAR(300) NULL,
  `mode`        VARCHAR(20) NOT NULL DEFAULT 'BRANDED_PHOTO',   -- BRANDED_PHOTO | AI_POSTER | PHOTO_ONLY
  `overlay`     VARCHAR(10) NOT NULL DEFAULT 'FULL',            -- FULL | LOGO | NONE
  `aspect`      VARCHAR(8)  NOT NULL DEFAULT '4:3',
  `prompt`      TEXT NOT NULL,
  `preview_url` VARCHAR(1000) NULL,
  `is_default`  TINYINT(1) NOT NULL DEFAULT 0,
  `active`      TINYINT(1) NOT NULL DEFAULT 1,
  `sort`        INT NOT NULL DEFAULT 0,
  `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE `clients`
  ADD COLUMN IF NOT EXISTS `image_style_id` INT NULL;

-- default image styles (only when the table is empty)
INSERT INTO `image_styles` (`name`,`description`,`mode`,`overlay`,`aspect`,`prompt`,`is_default`,`active`,`sort`)
  SELECT 'Branded photo (classic)','AI photo with your logo, headline and button added on top. Always readable.','BRANDED_PHOTO','FULL','4:3','{{visual}}. Main subject: {{service}}. Location and context: authentic Indian {{category}} environment in {{city}}, with realistic local surroundings and real people where appropriate. Composition: ONE single full-bleed photograph covering the entire canvas edge-to-edge. Do not create a split-screen composition, side panel, white panel, empty text column, framed card, collage, poster layout, brochure layout, or separate content section. Keep the main subject slightly right or center-right when possible, while preserving natural negative space in the upper-left and lower-left areas for later text overlays. The background photograph must continue naturally behind all areas of the canvas. Photography: natural daylight or soft interior lighting, realistic 35mm photography, professional commercial photo, true-to-life colours, natural depth of field, candid composition. Visual quality: premium, realistic, clean, modern Indian business advertising photography. Important: generate photography only. No text, letters, typography, logos, watermarks, signage, brand names, CTA buttons, banners, borders, coloured bars, white boxes, or graphic panels. No before-and-after layout, no medical gore, fully clothed people',1,1,1
  FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM `image_styles` WHERE `name`='Branded photo (classic)');
INSERT INTO `image_styles` (`name`,`description`,`mode`,`overlay`,`aspect`,`prompt`,`is_default`,`active`,`sort`)
  SELECT 'Designed poster','AI designs the full ad - headline, 4 points with icons and a call button, with a real photo on the side.','AI_POSTER','LOGO','4:3','Design a professional, premium Google Business Profile post creative in landscape format for "{{business}}", a {{category}} in {{city}}.

LAYOUT
- Left side (about 55%): clean light background with the text.
- Right side (about 45%): a realistic, high-quality photo of {{visual}} - authentic Indian people and setting.
- Leave the top-left corner empty (logo goes there).

TEXT - render EXACTLY as written, correct spelling, no other words:
1. Large bold headline (2 lines max): "{{headline}}"
2. Smaller line under it: "{{subtitle}}"
3. A vertical list of 4 short points, each with a simple round line icon in {{brand_color}}:
   "{{point1}}" / "{{point2}}" / "{{point3}}" / "{{point4}}"
4. A rounded button at the bottom-left in {{brand_color}} with a phone icon and the text "{{cta}}"

STYLE
Modern Indian service advertising, clean and trustworthy, soft shadows, generous white space, brand colour {{brand_color}} accents with dark navy text, sharp readable typography.
No phone numbers, no website addresses, no watermarks, no extra text, no misspellings.',0,1,2
  FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM `image_styles` WHERE `name`='Designed poster');
INSERT INTO `image_styles` (`name`,`description`,`mode`,`overlay`,`aspect`,`prompt`,`is_default`,`active`,`sort`)
  SELECT 'Clean photo','Just a realistic photo, no text.','PHOTO_ONLY','NONE','4:3','{{visual}}. Main subject: {{service}}. Location and context: authentic Indian {{category}} environment in {{city}}, with realistic local surroundings and real people where appropriate. Composition: ONE single full-bleed photograph covering the entire canvas edge-to-edge. Do not create a split-screen composition, side panel, white panel, empty text column, framed card, collage, poster layout, brochure layout, or separate content section. Keep the main subject slightly right or center-right when possible, while preserving natural negative space in the upper-left and lower-left areas for later text overlays. The background photograph must continue naturally behind all areas of the canvas. Photography: natural daylight or soft interior lighting, realistic 35mm photography, professional commercial photo, true-to-life colours, natural depth of field, candid composition. Visual quality: premium, realistic, clean, modern Indian business advertising photography. Important: generate photography only. No text, letters, typography, logos, watermarks, signage, brand names, CTA buttons, banners, borders, coloured bars, white boxes, or graphic panels. No before-and-after layout, no medical gore, fully clothed people',0,1,3
  FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM `image_styles` WHERE `name`='Clean photo');

-- v10.1 review collection (included again in case it was skipped)
ALTER TABLE `review_feedback`
  ADD COLUMN IF NOT EXISTS `kind` VARCHAR(20) NOT NULL DEFAULT 'PRIVATE',
  ADD COLUMN IF NOT EXISTS `status` VARCHAR(20) NOT NULL DEFAULT 'SAVED',
  ADD COLUMN IF NOT EXISTS `lang` VARCHAR(20) NULL,
  ADD COLUMN IF NOT EXISTS `matched_review_id` VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS `matched_at` DATETIME NULL;


-- HBS Suite (only replaces the old default name, never a custom one)
UPDATE `platform_settings` SET `svalue`='HBS Suite' WHERE `skey`='platform_name' AND `svalue` IN ('GMB AI Cloud','"GMB AI Cloud"');
UPDATE `platform_settings` SET `svalue`='HBS Suite - AI Google Business Profile management' WHERE `skey`='seo_title' AND `svalue` LIKE '%GMB AI Cloud%';

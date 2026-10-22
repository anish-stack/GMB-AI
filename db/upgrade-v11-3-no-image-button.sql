-- v11.3.2: no CTA button on post images by default (Admin -> Web settings -> "Button on post images").
-- Safe to run more than once.
INSERT IGNORE INTO platform_settings (skey, svalue) VALUES ('image_cta_button', '0');

-- seeded "Designed poster" style: drop the button line from the stored prompt + update descriptions
UPDATE image_styles
   SET prompt = REPLACE(prompt, '4. A rounded button at the bottom-left in {{brand_color}} with a phone icon and the text "{{cta}}"\n', ''),
       description = 'AI designs the full ad - headline and 4 points with icons, with a real photo on the side.'
 WHERE name = 'Designed poster';
UPDATE image_styles
   SET description = 'AI photo with your logo and headline added on top. Always readable.'
 WHERE name = 'Branded photo (classic)';

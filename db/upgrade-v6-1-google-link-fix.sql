-- v6.1: repair clients that connected Google but still show mock provider / mock_loc_ id.
-- Safe to run more than once. (Clicking "Sync" on each client also repairs it.)
UPDATE clients
   SET gmb_location_id = SUBSTRING_INDEX(google_location_name, '/', -1),
       gmb_connection_status = 'GOOGLE_CONNECTED'
 WHERE google_location_name IS NOT NULL AND google_account_id IS NOT NULL;

UPDATE gmb_profiles p JOIN clients c ON c.id = p.client_id
   SET p.provider = 'google', p.connection_status = 'GOOGLE_CONNECTED'
 WHERE c.google_location_name IS NOT NULL AND c.google_account_id IS NOT NULL;

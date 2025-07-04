@@ .. @@
 -- Update migration function to include account_code with proper type conversion
 CREATE OR REPLACE FUNCTION migrate_carriers_from_data()
 RETURNS void AS $$
 DECLARE
   carrier_record RECORD;
   new_carrier_id uuid;
 BEGIN
   -- Create carriers from unique carrier names in CustomerCarriers
   FOR carrier_record IN 
     SELECT DISTINCT 
       "P44CarrierCode" as name, 
-      CAST("CarrierId" AS text) as account_code
+      CASE 
+        WHEN "CarrierId" IS NOT NULL THEN CAST("CarrierId" AS text) 
+        ELSE NULL 
+      END as account_code
     FROM "CustomerCarriers" 
     WHERE "P44CarrierCode" IS NOT NULL 
     AND "P44CarrierCode" != ''
   LOOP
     -- Insert carrier if not exists
     INSERT INTO carriers (name, account_code)
     VALUES (carrier_record.name, carrier_record.account_code)
     ON CONFLICT (name) DO UPDATE
-    SET account_code = COALESCE(carriers.account_code, EXCLUDED.account_code)
+    SET account_code = CASE
+      WHEN carriers.account_code IS NULL AND EXCLUDED.account_code IS NOT NULL THEN EXCLUDED.account_code
+      ELSE carriers.account_code
+    END
     RETURNING id INTO new_carrier_id;
     
     -- Get the carrier ID if it already existed
     IF new_carrier_id IS NULL THEN
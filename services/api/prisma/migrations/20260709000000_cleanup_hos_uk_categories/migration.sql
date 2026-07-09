-- Rename "Collectibles HOS UK" and variants to "Collectibles" in products table
UPDATE "products"
SET    "category" = 'Collectibles'
WHERE  LOWER(TRIM("category")) IN (
         'collectibles hos uk',
         'collectibles-hos-uk',
         'hos uk'
       );

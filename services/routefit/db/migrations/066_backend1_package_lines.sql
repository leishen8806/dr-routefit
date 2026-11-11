CREATE TABLE orders.package_line (
 id uuid PRIMARY KEY,
 company_id uuid NOT NULL,
 order_id uuid NOT NULL,
 line_number integer NOT NULL CHECK(line_number>0),
 length_cm integer NOT NULL CHECK(length_cm>0),
 width_cm integer NOT NULL CHECK(width_cm>0),
 height_cm integer NOT NULL CHECK(height_cm>0),
 weight_grams integer NOT NULL CHECK(weight_grams>0),
 quantity integer NOT NULL CHECK(quantity>0),
 volumetric_weight_kg integer NOT NULL CHECK(volumetric_weight_kg>0),
 chargeable_weight_kg integer NOT NULL CHECK(chargeable_weight_kg>=volumetric_weight_kg),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(company_id,id), UNIQUE(company_id,order_id,line_number),
 FOREIGN KEY(company_id,order_id) REFERENCES orders.draft(company_id,id)
);
ALTER TABLE orders.draft
 ADD COLUMN cod_amount_minor bigint NULL CHECK(cod_amount_minor>=0),
 ADD COLUMN payment_method text NULL CHECK(payment_method IN ('PREPAID','COD')),
 ADD COLUMN value_added_service_codes text[] NOT NULL DEFAULT ARRAY[]::text[] CHECK(value_added_service_codes <@ ARRAY['STAIRS','WAITING','INSURANCE','LONG_ITEM']),
 ADD COLUMN quote_expires_at timestamptz NULL;

ALTER TABLE orders.package_line ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders.package_line FORCE ROW LEVEL SECURITY;
CREATE POLICY company_scope ON orders.package_line USING(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid) WITH CHECK(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid);
GRANT SELECT,INSERT,UPDATE ON orders.package_line TO routefit_api;

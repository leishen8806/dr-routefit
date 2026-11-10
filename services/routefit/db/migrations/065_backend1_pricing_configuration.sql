CREATE TABLE pricing.dimension_rule (
 id uuid PRIMARY KEY,
 company_id uuid NOT NULL REFERENCES org.company(id),
 version bigint NOT NULL CHECK(version BETWEEN 1 AND 9000000000000),
 volumetric_divisor integer NOT NULL CHECK(volumetric_divisor>0),
 long_item_threshold_cm integer NOT NULL CHECK(long_item_threshold_cm>0),
 exclusive_vehicle_threshold_cm integer NOT NULL CHECK(exclusive_vehicle_threshold_cm>long_item_threshold_cm),
 effective_at timestamptz NOT NULL,
 state text NOT NULL CHECK(state IN ('DRAFT','APPROVED','RETIRED')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(company_id,id), UNIQUE(company_id,version)
);
CREATE TABLE pricing.vehicle_tariff (
 id uuid PRIMARY KEY,
 company_id uuid NOT NULL REFERENCES org.company(id),
 version bigint NOT NULL CHECK(version BETWEEN 1 AND 9000000000000),
 vehicle_type text NOT NULL CHECK(length(btrim(vehicle_type)) BETWEEN 1 AND 80),
 currency text NOT NULL CHECK(currency IN ('USD','KHR')),
 base_minor bigint NOT NULL CHECK(base_minor>=0),
 included_km integer NOT NULL CHECK(included_km>=0),
 extra_km_minor bigint NOT NULL CHECK(extra_km_minor>=0),
 effective_at timestamptz NOT NULL,
 state text NOT NULL CHECK(state IN ('DRAFT','APPROVED','RETIRED')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(company_id,id), UNIQUE(company_id,version,vehicle_type)
);
CREATE TABLE pricing.value_added_service (
 id uuid PRIMARY KEY,
 company_id uuid NOT NULL REFERENCES org.company(id),
 version bigint NOT NULL CHECK(version BETWEEN 1 AND 9000000000000),
 code text NOT NULL CHECK(code IN ('STAIRS','WAITING','INSURANCE','LONG_ITEM')),
 currency text NOT NULL CHECK(currency IN ('USD','KHR')),
 amount_minor bigint NOT NULL CHECK(amount_minor>=0),
 unit text NOT NULL CHECK(unit IN ('FIXED','FLOOR','MINUTE')),
 effective_at timestamptz NOT NULL,
 state text NOT NULL CHECK(state IN ('DRAFT','APPROVED','RETIRED')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(company_id,id), UNIQUE(company_id,version,code)
);
CREATE TABLE pricing.fx_rate (
 id uuid PRIMARY KEY,
 company_id uuid NOT NULL REFERENCES org.company(id),
 version bigint NOT NULL CHECK(version BETWEEN 1 AND 9000000000000),
 source_currency text NOT NULL CHECK(source_currency='USD'),
 target_currency text NOT NULL CHECK(target_currency='KHR'),
 rate_numerator bigint NOT NULL CHECK(rate_numerator>0),
 rate_denominator bigint NOT NULL CHECK(rate_denominator>0),
 rounding_minor integer NOT NULL CHECK(rounding_minor>0),
 effective_at timestamptz NOT NULL,
 state text NOT NULL CHECK(state IN ('DRAFT','APPROVED','RETIRED')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(company_id,id), UNIQUE(company_id,version)
);


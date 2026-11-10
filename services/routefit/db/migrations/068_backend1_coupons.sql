CREATE SCHEMA marketing;
CREATE TABLE marketing.coupon_batch (
 id uuid PRIMARY KEY,
 company_id uuid NOT NULL REFERENCES org.company(id),
 kind text NOT NULL CHECK(kind IN ('AMOUNT_OFF','THRESHOLD_OFF')),
 currency text NOT NULL CHECK(currency IN ('USD','KHR')),
 amount_minor bigint NOT NULL CHECK(amount_minor>=0),
 minimum_spend_minor bigint NOT NULL CHECK(minimum_spend_minor>=0),
 budget_minor bigint NOT NULL CHECK(budget_minor>=0),
 idempotency_key text NOT NULL CHECK(length(btrim(idempotency_key)) BETWEEN 1 AND 128),
 state text NOT NULL CHECK(state IN ('DRAFT','APPROVED','STOPPED')),
 version bigint NOT NULL CHECK(version BETWEEN 1 AND 9000000000000),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(company_id,id), UNIQUE(company_id,idempotency_key)
);
CREATE TABLE marketing.coupon (
 id uuid PRIMARY KEY,
 company_id uuid NOT NULL,
 batch_id uuid NOT NULL,
 subject_principal_id uuid NULL,
 state text NOT NULL CHECK(state IN ('ISSUED','LOCKED','REDEEMED','RELEASED','VOID')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(company_id,id),
 FOREIGN KEY(company_id,batch_id) REFERENCES marketing.coupon_batch(company_id,id),
 FOREIGN KEY(company_id,subject_principal_id) REFERENCES org.principal(company_id,id)
);

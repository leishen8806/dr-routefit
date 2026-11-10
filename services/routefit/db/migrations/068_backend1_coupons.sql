CREATE SCHEMA marketing;
CREATE TABLE marketing.coupon_batch (
 id uuid PRIMARY KEY,
 company_id uuid NOT NULL REFERENCES org.company(id),
 kind text NOT NULL CHECK(kind IN ('AMOUNT_OFF','THRESHOLD_OFF')),
 currency text NOT NULL CHECK(currency IN ('USD','KHR')),
 amount_minor bigint NOT NULL CHECK(amount_minor>=0),
 minimum_spend_minor bigint NOT NULL CHECK(minimum_spend_minor>=0),
 budget_minor bigint NOT NULL CHECK(budget_minor>=0),
 state text NOT NULL CHECK(state IN ('DRAFT','APPROVED','STOPPED')),
 version bigint NOT NULL CHECK(version BETWEEN 1 AND 9000000000000),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(company_id,id)
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
CREATE TABLE marketing.coupon_redemption (
 id uuid PRIMARY KEY,
 company_id uuid NOT NULL,
 coupon_id uuid NOT NULL,
 order_id uuid NOT NULL,
 state text NOT NULL CHECK(state IN ('LOCKED','REDEEMED','RELEASED')),
 discount_minor bigint NOT NULL CHECK(discount_minor>=0),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(company_id,id), UNIQUE(company_id,coupon_id), UNIQUE(company_id,order_id),
 FOREIGN KEY(company_id,coupon_id) REFERENCES marketing.coupon(company_id,id),
 FOREIGN KEY(company_id,order_id) REFERENCES orders.draft(company_id,id)
);
CREATE TABLE marketing.risk_flag (
 id uuid PRIMARY KEY,
 company_id uuid NOT NULL REFERENCES org.company(id),
 coupon_id uuid NULL,
 order_id uuid NULL,
 code text NOT NULL CHECK(code='COUPON_REVIEW_REQUIRED'),
 state text NOT NULL CHECK(state IN ('OPEN','RESOLVED')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(company_id,id),
 FOREIGN KEY(company_id,coupon_id) REFERENCES marketing.coupon(company_id,id),
 FOREIGN KEY(company_id,order_id) REFERENCES orders.draft(company_id,id),
 CHECK(coupon_id IS NOT NULL OR order_id IS NOT NULL)
);


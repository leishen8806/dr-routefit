DO $$ DECLARE c text; BEGIN
 SELECT conname INTO c FROM pg_constraint WHERE conrelid='finance.receipt'::regclass AND pg_get_constraintdef(oid) LIKE '%method%';
 IF c IS NOT NULL THEN EXECUTE format('ALTER TABLE finance.receipt DROP CONSTRAINT %I',c); END IF;
 SELECT conname INTO c FROM pg_constraint WHERE conrelid='finance.receipt'::regclass AND pg_get_constraintdef(oid) LIKE '%custody_type%';
 IF c IS NOT NULL THEN EXECUTE format('ALTER TABLE finance.receipt DROP CONSTRAINT %I',c); END IF;
END $$;
ALTER TABLE finance.receipt ADD CONSTRAINT receipt_method_allowed CHECK(method IN ('BANK_TRANSFER','CASH','KESS'));
ALTER TABLE finance.receipt ADD CONSTRAINT receipt_custody_allowed CHECK(custody_type IN ('DRIVER','COMPANY','CHANNEL'));
CREATE UNIQUE INDEX one_kess_transaction ON finance.receipt(company_id,external_reference) WHERE method='KESS';

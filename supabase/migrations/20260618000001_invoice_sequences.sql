-- MN Enterprises: Auto-incrementing invoice numbers
-- Format: MNE/{TYPE}/{FYYYYY}/{NNNN}
--   TYPE: SAL (sales), PUR (purchases), REC (payment received), PAY (payment made)
--   FY: two-digit start + two-digit end year, e.g. 2627 for FY 2026-27 (Apr 2026 – Mar 2027)
--   NNNN: zero-padded sequential number, resets each financial year

CREATE TABLE invoice_sequences (
  id             UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  type           TEXT     NOT NULL,
  financial_year TEXT     NOT NULL,
  next_number    INTEGER  NOT NULL DEFAULT 1,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(type, financial_year)
);

-- Add our internal invoice number column to invoices (sales)
ALTER TABLE invoices      ADD COLUMN IF NOT EXISTS invoice_number    TEXT;

-- purchase_bills already has invoice_number for the supplier's ref; add our own
ALTER TABLE purchase_bills ADD COLUMN IF NOT EXISTS mn_invoice_number TEXT;

-- payments get a voucher number (REC or PAY)
ALTER TABLE payments       ADD COLUMN IF NOT EXISTS mn_number         TEXT;

-- Atomically increment and return the next formatted invoice number.
-- Safe under concurrent requests: the UPDATE is a serialized row lock.
CREATE OR REPLACE FUNCTION next_invoice_number(p_type TEXT, p_year TEXT)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  v_num INTEGER;
BEGIN
  INSERT INTO invoice_sequences (type, financial_year, next_number)
  VALUES (p_type, p_year, 1)
  ON CONFLICT (type, financial_year) DO NOTHING;

  UPDATE invoice_sequences
  SET    next_number = next_number + 1
  WHERE  type = p_type AND financial_year = p_year
  RETURNING next_number - 1 INTO v_num;

  RETURN 'MNE/' || p_type || '/' || p_year || '/' || LPAD(v_num::TEXT, 4, '0');
END;
$$;

-- MN Enterprises: Damage / defective stock tracking
-- Two damage scenarios:
--   brand_claim: damage received from brand (on inward), claim pending against brand
--   customer_complaint: customer reports damage against a past sale

CREATE TYPE damage_type_enum AS ENUM ('brand_claim', 'customer_complaint');
CREATE TYPE damage_status_enum AS ENUM ('pending', 'resolved');
CREATE TYPE damage_resolution_enum AS ENUM ('credit_note', 'replacement', 'written_off', 'rejected');

CREATE TABLE damage_records (
  id                    UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  type                  damage_type_enum NOT NULL,
  date                  DATE     NOT NULL,
  sku_id                UUID     REFERENCES skus(id) ON DELETE SET NULL,
  units                 INTEGER  NOT NULL DEFAULT 0,
  -- For brand_claim: brand responsible
  brand_id              UUID     REFERENCES brands(id) ON DELETE SET NULL,
  -- For customer_complaint: customer and optionally the invoice
  customer_id           UUID     REFERENCES customers(id) ON DELETE SET NULL,
  linked_invoice_id     UUID     REFERENCES invoices(id) ON DELETE SET NULL,
  -- The stock_movements row that records the stock deduction (movement_type='damage')
  stock_movement_id     UUID     REFERENCES stock_movements(id) ON DELETE SET NULL,
  -- Credit applied to customer invoice (reduces amount_paid or creates credit)
  credit_amount         NUMERIC(12,2),
  status                damage_status_enum     NOT NULL DEFAULT 'pending',
  resolution            damage_resolution_enum,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_damage_records_brand    ON damage_records(brand_id)    WHERE brand_id    IS NOT NULL;
CREATE INDEX idx_damage_records_customer ON damage_records(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX idx_damage_records_status   ON damage_records(status);

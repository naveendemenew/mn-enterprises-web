-- MN Enterprises: Initial database schema
-- Run this in Supabase SQL Editor or via Supabase CLI

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE movement_type_enum AS ENUM ('inward', 'outward', 'damage', 'adjustment');
CREATE TYPE payment_status_enum AS ENUM ('paid', 'partial', 'unpaid');
CREATE TYPE payment_type_enum AS ENUM ('received_from_customer', 'paid_to_brand');
CREATE TYPE payment_mode_enum AS ENUM ('cash', 'upi', 'bank');
CREATE TYPE expense_category_enum AS ENUM ('diesel', 'driver_payment', 'maintenance', 'misc');
CREATE TYPE indent_status_enum AS ENUM ('pending', 'received');

-- ============================================================
-- TABLES
-- ============================================================

-- 1. categories
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. brands
CREATE TABLE brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  contact_name TEXT,
  contact_phone TEXT,
  payment_terms TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. skus (products)
CREATE TABLE skus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  units_per_case INTEGER NOT NULL DEFAULT 1,
  default_purchase_price_per_bottle NUMERIC(10,4),
  default_selling_price_per_bottle NUMERIC(10,4),
  reorder_level_bottles INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. customers
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  credit_period_days INTEGER NOT NULL DEFAULT 7,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. vehicles
CREATE TABLE vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  registration_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. drivers
CREATE TABLE drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. invoices (created before stock_movements due to FK reference)
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_status payment_status_enum NOT NULL DEFAULT 'unpaid',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. stock_movements (core ledger)
-- IMPORTANT: total_bottles is a regular stored column (not generated) because
-- it requires units_per_case from the skus table. App must compute:
--   total_bottles = cases * sku.units_per_case + loose_units
-- 'adjustment' movements use positive total_bottles for additions,
-- negative total_bottles for reductions.
CREATE TABLE stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_id UUID NOT NULL REFERENCES skus(id) ON DELETE RESTRICT,
  movement_type movement_type_enum NOT NULL,
  date DATE NOT NULL,
  cases INTEGER NOT NULL DEFAULT 0,
  loose_units INTEGER NOT NULL DEFAULT 0,
  total_bottles INTEGER NOT NULL DEFAULT 0,
  price_per_bottle NUMERIC(10,4),
  is_free_stock BOOLEAN NOT NULL DEFAULT FALSE,
  brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  reference_invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. purchase_bills
CREATE TABLE purchase_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  invoice_number TEXT,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_status payment_status_enum NOT NULL DEFAULT 'unpaid',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. payments (both inflow from customers and outflow to brands)
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type payment_type_enum NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  purchase_bill_id UUID REFERENCES purchase_bills(id) ON DELETE SET NULL,
  amount NUMERIC(12,2) NOT NULL,
  date DATE NOT NULL,
  mode payment_mode_enum NOT NULL DEFAULT 'cash',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. expenses
-- source_vehicle_log_id: set when a diesel expense is auto-created from vehicle_logs
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category expense_category_enum NOT NULL DEFAULT 'misc',
  date DATE NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
  notes TEXT,
  source_vehicle_log_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. vehicle_logs
-- km_travelled and diesel_amount are GENERATED (computed from same-row columns)
CREATE TABLE vehicle_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
  date DATE NOT NULL,
  odo_start INTEGER,
  odo_end INTEGER,
  km_travelled INTEGER GENERATED ALWAYS AS (
    CASE WHEN odo_start IS NOT NULL AND odo_end IS NOT NULL
         THEN odo_end - odo_start
         ELSE NULL END
  ) STORED,
  diesel_litres NUMERIC(8,2),
  diesel_rate NUMERIC(8,2),
  diesel_amount NUMERIC(10,2) GENERATED ALWAYS AS (
    CASE WHEN diesel_litres IS NOT NULL AND diesel_rate IS NOT NULL
         THEN ROUND(diesel_litres * diesel_rate, 2)
         ELSE NULL END
  ) STORED,
  driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add FK from expenses back to vehicle_logs (deferred: vehicle_logs created after expenses)
ALTER TABLE expenses
  ADD CONSTRAINT fk_expenses_source_vehicle_log
  FOREIGN KEY (source_vehicle_log_id) REFERENCES vehicle_logs(id) ON DELETE SET NULL;

-- 13. indents (purchase orders raised to brands)
CREATE TABLE indents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  status indent_status_enum NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. indent_items
CREATE TABLE indent_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  indent_id UUID NOT NULL REFERENCES indents(id) ON DELETE CASCADE,
  sku_id UUID NOT NULL REFERENCES skus(id) ON DELETE RESTRICT,
  cases_requested INTEGER NOT NULL DEFAULT 0
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_stock_movements_sku_id    ON stock_movements(sku_id);
CREATE INDEX idx_stock_movements_date      ON stock_movements(date);
CREATE INDEX idx_stock_movements_customer  ON stock_movements(customer_id);
CREATE INDEX idx_stock_movements_brand     ON stock_movements(brand_id);
CREATE INDEX idx_invoices_customer         ON invoices(customer_id);
CREATE INDEX idx_invoices_status           ON invoices(payment_status);
CREATE INDEX idx_purchase_bills_brand      ON purchase_bills(brand_id);
CREATE INDEX idx_payments_customer         ON payments(customer_id);
CREATE INDEX idx_payments_brand            ON payments(brand_id);
CREATE INDEX idx_expenses_date             ON expenses(date);
CREATE INDEX idx_vehicle_logs_vehicle      ON vehicle_logs(vehicle_id);
CREATE INDEX idx_vehicle_logs_date         ON vehicle_logs(date);
CREATE INDEX idx_skus_brand                ON skus(brand_id);
CREATE INDEX idx_brands_category           ON brands(category_id);

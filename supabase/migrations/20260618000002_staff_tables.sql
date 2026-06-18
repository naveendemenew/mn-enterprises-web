-- MN Enterprises: Staff and salary management tables

-- Core staff table (separate from drivers — drivers are for vehicle operations,
-- staff here covers sales/warehouse/office personnel)
CREATE TABLE staff (
  id             UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT     NOT NULL,
  role           TEXT,
  phone          TEXT,
  monthly_salary NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_active      BOOLEAN  NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Monthly salary disbursement entries
CREATE TABLE salary_entries (
  id         UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id   UUID     NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  month      TEXT     NOT NULL,  -- 'YYYY-MM', e.g. '2026-06'
  amount     NUMERIC(10,2) NOT NULL,
  paid_date  DATE,
  notes      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(staff_id, month)       -- one salary entry per staff per month
);

-- Advance payments given to staff (can be multiple per month)
CREATE TABLE staff_advances (
  id         UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id   UUID     NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  date       DATE     NOT NULL,
  amount     NUMERIC(10,2) NOT NULL,
  reason     TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Casual / daily labour (no advance tracking; no fixed staff link)
CREATE TABLE casual_labour_entries (
  id               UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  date             DATE     NOT NULL,
  num_people       INTEGER  NOT NULL DEFAULT 1,
  amount_per_person NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_amount     NUMERIC(10,2) GENERATED ALWAYS AS (num_people * amount_per_person) STORED,
  purpose          TEXT,          -- 'loading', 'unloading', 'cleaning', etc.
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Owner salary — tracked separately; deducted from gross profit to get true net profit
CREATE TABLE owner_salary_entries (
  id         UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  month      TEXT     NOT NULL UNIQUE,  -- 'YYYY-MM'
  amount     NUMERIC(10,2) NOT NULL,
  notes      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_salary_entries_staff    ON salary_entries(staff_id);
CREATE INDEX idx_salary_entries_month    ON salary_entries(month);
CREATE INDEX idx_staff_advances_staff    ON staff_advances(staff_id);
CREATE INDEX idx_staff_advances_date     ON staff_advances(date);
CREATE INDEX idx_casual_labour_date      ON casual_labour_entries(date);

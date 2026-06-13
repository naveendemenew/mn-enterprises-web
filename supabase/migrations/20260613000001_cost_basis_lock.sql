-- MN Enterprises: Lock COGS to cost-at-time-of-sale
--
-- Previously, the Profit Analysis page computed COGS for every outward
-- movement using TODAY's overall weighted-average cost (current_stock_per_sku),
-- so historical profit figures shifted whenever new purchases were recorded.
--
-- This migration adds a cost_per_bottle snapshot column to stock_movements,
-- populated automatically (via trigger) at insert time from the SKU's
-- weighted-average cost just before that movement. Existing outward rows are
-- backfilled with the current weighted-average cost as a one-time approximation.

-- ============================================================
-- 1. New column
-- ============================================================
ALTER TABLE stock_movements
  ADD COLUMN cost_per_bottle NUMERIC(10,4);

-- ============================================================
-- 2. Backfill existing outward / damage movements
--    (one-time approximation using today's weighted-average cost)
-- ============================================================
UPDATE stock_movements sm
SET cost_per_bottle = cs.weighted_avg_cost_per_bottle
FROM current_stock_per_sku cs
WHERE sm.sku_id = cs.sku_id
  AND sm.movement_type IN ('outward', 'damage')
  AND sm.cost_per_bottle IS NULL;

-- ============================================================
-- 3. Trigger: snapshot weighted-avg cost at insert time
--    Runs BEFORE INSERT so current_stock_per_sku reflects stock
--    state just prior to this movement.
-- ============================================================
CREATE OR REPLACE FUNCTION fn_snapshot_cost_per_bottle()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.movement_type IN ('outward', 'damage') AND NEW.cost_per_bottle IS NULL THEN
    SELECT weighted_avg_cost_per_bottle INTO NEW.cost_per_bottle
    FROM current_stock_per_sku WHERE sku_id = NEW.sku_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_stock_movement_cost_snapshot
BEFORE INSERT ON stock_movements
FOR EACH ROW EXECUTE FUNCTION fn_snapshot_cost_per_bottle();

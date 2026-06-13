-- MN Enterprises: Database triggers
--
-- DIESEL EXPENSE SYNC
-- When a vehicle_log row is inserted or updated with diesel data (litres + rate),
-- a matching row is automatically created/updated in the expenses table with
-- category='diesel'. This ensures diesel costs appear in unified expense totals
-- without requiring duplicate manual entry.
-- The link is stored in expenses.source_vehicle_log_id for easy cleanup/update.

CREATE OR REPLACE FUNCTION fn_sync_diesel_expense()
RETURNS TRIGGER AS $$
BEGIN
  -- On UPDATE: remove the old auto-generated expense first
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM expenses WHERE source_vehicle_log_id = OLD.id;
  END IF;

  -- Create a new expense row if diesel data is present and non-zero
  IF NEW.diesel_amount IS NOT NULL AND NEW.diesel_amount > 0 THEN
    INSERT INTO expenses (
      category,
      date,
      amount,
      vehicle_id,
      driver_id,
      notes,
      source_vehicle_log_id
    ) VALUES (
      'diesel',
      NEW.date,
      NEW.diesel_amount,
      NEW.vehicle_id,
      NEW.driver_id,
      'Diesel – auto from vehicle log',
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_vehicle_log_diesel_expense
AFTER INSERT OR UPDATE ON vehicle_logs
FOR EACH ROW EXECUTE FUNCTION fn_sync_diesel_expense();

-- On DELETE of a vehicle_log: cascade-delete the linked diesel expense
CREATE OR REPLACE FUNCTION fn_delete_diesel_expense()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM expenses WHERE source_vehicle_log_id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_vehicle_log_diesel_expense_delete
AFTER DELETE ON vehicle_logs
FOR EACH ROW EXECUTE FUNCTION fn_delete_diesel_expense();

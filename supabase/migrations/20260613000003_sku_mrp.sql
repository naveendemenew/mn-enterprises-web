-- MN Enterprises: Add MRP per bottle to SKUs
ALTER TABLE skus
  ADD COLUMN mrp_per_bottle NUMERIC(10,4);

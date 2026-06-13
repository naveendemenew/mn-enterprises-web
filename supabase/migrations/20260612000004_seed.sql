-- MN Enterprises: Sample seed data for development
-- Run AFTER the schema migrations.

-- Categories
INSERT INTO categories (id, name) VALUES
  ('a0000001-0000-0000-0000-000000000001', 'Water Bottles'),
  ('a0000001-0000-0000-0000-000000000002', 'Beverages');

-- Brands
INSERT INTO brands (id, category_id, name, contact_name, contact_phone, payment_terms) VALUES
  ('b0000002-0000-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000001', 'Bisleri',  'Rajesh Kumar', '9876543210', 'Net 30 days'),
  ('b0000002-0000-0000-0000-000000000002', 'a0000001-0000-0000-0000-000000000001', 'Kinley',   'Priya Sharma', '9876543211', 'Net 15 days'),
  ('b0000002-0000-0000-0000-000000000003', 'a0000001-0000-0000-0000-000000000001', 'Aquafina', 'Amit Singh',   '9876543212', 'Net 30 days');

-- SKUs
INSERT INTO skus (id, brand_id, name, units_per_case, default_purchase_price_per_bottle, default_selling_price_per_bottle, reorder_level_bottles) VALUES
  -- Bisleri
  ('c0000003-0000-0000-0000-000000000001', 'b0000002-0000-0000-0000-000000000001', '500ml Bottle', 24,  7.50, 10.00, 240),
  ('c0000003-0000-0000-0000-000000000002', 'b0000002-0000-0000-0000-000000000001', '1L Bottle',    12, 14.00, 18.00, 120),
  ('c0000003-0000-0000-0000-000000000003', 'b0000002-0000-0000-0000-000000000001', '20L Jar',       1, 45.00, 60.00,  50),
  -- Kinley
  ('c0000003-0000-0000-0000-000000000004', 'b0000002-0000-0000-0000-000000000002', '500ml Bottle', 24,  7.00,  9.50, 240),
  ('c0000003-0000-0000-0000-000000000005', 'b0000002-0000-0000-0000-000000000002', '1L Bottle',    12, 13.50, 17.50, 120),
  -- Aquafina
  ('c0000003-0000-0000-0000-000000000006', 'b0000002-0000-0000-0000-000000000003', '500ml Bottle', 24,  7.20,  9.80, 240),
  ('c0000003-0000-0000-0000-000000000007', 'b0000002-0000-0000-0000-000000000003', '1L Bottle',    12, 13.80, 17.80, 120);

-- Customers
INSERT INTO customers (id, name, phone, address, credit_period_days) VALUES
  ('d0000004-0000-0000-0000-000000000001', 'Hotel Grand Palace',       '9811223344', '12, MG Road, Bangalore',        15),
  ('d0000004-0000-0000-0000-000000000002', 'Green Leaf Cafe',          '9822334455', '45, Indiranagar, Bangalore',     7),
  ('d0000004-0000-0000-0000-000000000003', 'TechPark Offices',         '9833445566', '100, Electronic City, Bangalore',30),
  ('d0000004-0000-0000-0000-000000000004', 'Sri Venkateshwara Stores', '9844556677', '78, Jayanagar, Bangalore',        7);

-- Vehicles
INSERT INTO vehicles (id, name, registration_number) VALUES
  ('e0000005-0000-0000-0000-000000000001', 'Van 1', 'KA-01-AB-1234'),
  ('e0000005-0000-0000-0000-000000000002', 'Van 2', 'KA-01-CD-5678');

-- Drivers
INSERT INTO drivers (id, name, phone) VALUES
  ('f0000006-0000-0000-0000-000000000001', 'Suresh Kumar', '9855667788'),
  ('f0000006-0000-0000-0000-000000000002', 'Ravi Shankar',  '9866778899');

-- Sample inward stock (purchase)
INSERT INTO stock_movements (sku_id, movement_type, date, cases, loose_units, total_bottles, price_per_bottle, is_free_stock, brand_id, notes)
VALUES
  ('c0000003-0000-0000-0000-000000000001', 'inward', CURRENT_DATE - 10, 50, 0, 1200, 7.50, false, 'b0000002-0000-0000-0000-000000000001', 'Opening stock - Bisleri 500ml'),
  ('c0000003-0000-0000-0000-000000000002', 'inward', CURRENT_DATE - 10, 20, 0,  240, 14.00, false, 'b0000002-0000-0000-0000-000000000001', 'Opening stock - Bisleri 1L'),
  ('c0000003-0000-0000-0000-000000000003', 'inward', CURRENT_DATE - 10,  0,100,  100, 45.00, false, 'b0000002-0000-0000-0000-000000000001', 'Opening stock - Bisleri 20L'),
  ('c0000003-0000-0000-0000-000000000004', 'inward', CURRENT_DATE -  8, 30, 0,  720,  7.00, false, 'b0000002-0000-0000-0000-000000000002', 'Opening stock - Kinley 500ml'),
  ('c0000003-0000-0000-0000-000000000005', 'inward', CURRENT_DATE -  8, 15, 0,  180, 13.50, false, 'b0000002-0000-0000-0000-000000000002', 'Opening stock - Kinley 1L'),
  -- Free scheme stock from Bisleri: 2 cases 500ml free on every 50 cases
  ('c0000003-0000-0000-0000-000000000001', 'inward', CURRENT_DATE - 10,  2, 0,   48,  0.00, true,  'b0000002-0000-0000-0000-000000000001', 'Scheme: 2 free cases on 50 case purchase');

-- Sample outward stock (sales)
INSERT INTO stock_movements (sku_id, movement_type, date, cases, loose_units, total_bottles, price_per_bottle, is_free_stock, customer_id, notes)
VALUES
  ('c0000003-0000-0000-0000-000000000001', 'outward', CURRENT_DATE - 5, 10,  0, 240, 10.00, false, 'd0000004-0000-0000-0000-000000000001', 'Hotel Grand Palace'),
  ('c0000003-0000-0000-0000-000000000002', 'outward', CURRENT_DATE - 5,  5,  0,  60, 18.00, false, 'd0000004-0000-0000-0000-000000000001', 'Hotel Grand Palace'),
  ('c0000003-0000-0000-0000-000000000003', 'outward', CURRENT_DATE - 3,  0, 30,  30, 60.00, false, 'd0000004-0000-0000-0000-000000000002', 'Green Leaf Cafe'),
  ('c0000003-0000-0000-0000-000000000004', 'outward', CURRENT_DATE - 2,  8,  0, 192,  9.50, false, 'd0000004-0000-0000-0000-000000000003', 'TechPark Offices'),
  ('c0000003-0000-0000-0000-000000000001', 'outward', CURRENT_DATE - 1,  5,  0, 120, 10.00, false, 'd0000004-0000-0000-0000-000000000004', 'Sri Venkateshwara Stores');

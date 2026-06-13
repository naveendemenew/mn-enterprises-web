-- MN Enterprises: Calculated views

-- ============================================================
-- VIEW: current_stock_per_sku
-- Current inventory level per SKU.
-- Stock value uses weighted-average cost where free stock (is_free_stock=true)
-- contributes 0 cost but still counts toward denominator, pulling average down.
-- ============================================================
CREATE VIEW current_stock_per_sku AS
SELECT
  s.id                              AS sku_id,
  s.name                            AS sku_name,
  b.id                              AS brand_id,
  b.name                            AS brand_name,
  cat.id                            AS category_id,
  cat.name                          AS category_name,
  s.units_per_case,
  s.reorder_level_bottles,
  s.default_purchase_price_per_bottle,
  s.default_selling_price_per_bottle,
  COALESCE(mv.net_bottles, 0)       AS total_bottles,
  FLOOR(COALESCE(mv.net_bottles, 0)::NUMERIC
        / NULLIF(s.units_per_case, 0))::INTEGER  AS cases,
  MOD(GREATEST(COALESCE(mv.net_bottles, 0), 0),
      NULLIF(s.units_per_case, 1))               AS loose_units,
  -- Weighted avg cost: only paid-for inward stock in numerator
  CASE
    WHEN COALESCE(mv.total_inward_bottles, 0) = 0 THEN 0
    ELSE ROUND(COALESCE(mv.total_paid_cost, 0)
               / mv.total_inward_bottles, 4)
  END                               AS weighted_avg_cost_per_bottle,
  -- Stock value = current bottles × weighted avg cost
  ROUND(
    GREATEST(COALESCE(mv.net_bottles, 0), 0) *
    CASE
      WHEN COALESCE(mv.total_inward_bottles, 0) = 0 THEN 0
      ELSE COALESCE(mv.total_paid_cost, 0) / mv.total_inward_bottles
    END,
    2
  )                                 AS stock_value
FROM skus s
JOIN brands b   ON s.brand_id    = b.id
JOIN categories cat ON b.category_id = cat.id
LEFT JOIN (
  SELECT
    sku_id,
    SUM(
      CASE movement_type
        WHEN 'inward'     THEN  total_bottles
        WHEN 'outward'    THEN -total_bottles
        WHEN 'damage'     THEN -total_bottles
        WHEN 'adjustment' THEN  total_bottles  -- negative value = downward adjustment
        ELSE 0
      END
    )                                            AS net_bottles,
    SUM(CASE WHEN movement_type = 'inward'
             THEN total_bottles ELSE 0 END)      AS total_inward_bottles,
    SUM(
      CASE WHEN movement_type = 'inward'
                AND is_free_stock = FALSE
           THEN COALESCE(price_per_bottle, 0) * total_bottles
           ELSE 0 END
    )                                            AS total_paid_cost
  FROM stock_movements
  GROUP BY sku_id
) mv ON mv.sku_id = s.id;

-- ============================================================
-- VIEW: customer_outstanding_dues
-- ============================================================
CREATE VIEW customer_outstanding_dues AS
SELECT
  c.id                                           AS customer_id,
  c.name                                         AS customer_name,
  c.phone,
  c.credit_period_days,
  COUNT(i.id)                                    AS invoice_count,
  COALESCE(SUM(i.total_amount - i.amount_paid), 0) AS total_due,
  MIN(i.date)                                    AS oldest_invoice_date,
  (CURRENT_DATE - MIN(i.date))                   AS days_outstanding
FROM customers c
LEFT JOIN invoices i
  ON i.customer_id = c.id
 AND i.payment_status IN ('unpaid', 'partial')
GROUP BY c.id, c.name, c.phone, c.credit_period_days;

-- ============================================================
-- VIEW: brand_payables
-- ============================================================
CREATE VIEW brand_payables AS
SELECT
  b.id                                              AS brand_id,
  b.name                                            AS brand_name,
  b.payment_terms,
  COUNT(pb.id)                                      AS bill_count,
  COALESCE(SUM(pb.total_amount - pb.amount_paid), 0) AS total_payable
FROM brands b
LEFT JOIN purchase_bills pb
  ON pb.brand_id = b.id
 AND pb.payment_status IN ('unpaid', 'partial')
GROUP BY b.id, b.name, b.payment_terms;

-- ============================================================
-- VIEW: sku_profit_summary
-- Profit per SKU: outward price - weighted avg cost at time of sale
-- For simplicity, uses current overall weighted avg cost (not per-batch FIFO).
-- ============================================================
CREATE VIEW sku_profit_summary AS
SELECT
  sm.sku_id,
  s.name                                   AS sku_name,
  b.name                                   AS brand_name,
  sm.date,
  sm.total_bottles,
  sm.price_per_bottle                      AS selling_price,
  sm.is_free_stock                         AS is_free_outward,
  cs.weighted_avg_cost_per_bottle          AS cost_price,
  ROUND(
    (COALESCE(sm.price_per_bottle, 0) - COALESCE(cs.weighted_avg_cost_per_bottle, 0))
    * sm.total_bottles, 2
  )                                        AS gross_profit,
  CASE
    WHEN cs.weighted_avg_cost_per_bottle > 0
    THEN ROUND(
      ((COALESCE(sm.price_per_bottle, 0) - cs.weighted_avg_cost_per_bottle)
       / cs.weighted_avg_cost_per_bottle * 100), 2
    )
    ELSE NULL
  END                                      AS margin_pct
FROM stock_movements sm
JOIN skus s  ON sm.sku_id   = s.id
JOIN brands b ON s.brand_id = b.id
JOIN current_stock_per_sku cs ON cs.sku_id = sm.sku_id
WHERE sm.movement_type = 'outward';

// TypeScript types mirroring the Supabase database schema
// Regenerate with: npx supabase gen types typescript --project-id <ref> > types/database.ts

export type MovementType = 'inward' | 'outward' | 'damage' | 'adjustment'
export type PaymentStatus = 'paid' | 'partial' | 'unpaid'
export type PaymentType = 'received_from_customer' | 'paid_to_brand'
export type PaymentMode = 'cash' | 'upi' | 'bank'
export type ExpenseCategory = 'diesel' | 'driver_payment' | 'maintenance' | 'misc'
export type IndentStatus = 'pending' | 'received'

export interface Category {
  id: string
  name: string
  created_at: string
}

export interface Brand {
  id: string
  category_id: string | null
  name: string
  contact_name: string | null
  contact_phone: string | null
  payment_terms: string | null
  created_at: string
  // joined
  categories?: Category
}

export interface Sku {
  id: string
  brand_id: string
  name: string
  units_per_case: number
  default_purchase_price_per_bottle: number | null
  default_selling_price_per_bottle: number | null
  reorder_level_bottles: number
  created_at: string
  // joined
  brands?: Brand & { categories?: Category }
}

export interface Customer {
  id: string
  name: string
  phone: string | null
  address: string | null
  credit_period_days: number
  created_at: string
}

export interface Vehicle {
  id: string
  name: string
  registration_number: string | null
  created_at: string
}

export interface Driver {
  id: string
  name: string
  phone: string | null
  created_at: string
}

export interface Invoice {
  id: string
  customer_id: string | null
  date: string
  total_amount: number
  amount_paid: number
  payment_status: PaymentStatus
  created_at: string
  customers?: Customer
}

export interface StockMovement {
  id: string
  sku_id: string
  movement_type: MovementType
  date: string
  cases: number
  loose_units: number
  total_bottles: number
  price_per_bottle: number | null
  is_free_stock: boolean
  brand_id: string | null
  customer_id: string | null
  reference_invoice_id: string | null
  notes: string | null
  created_at: string
  // joined
  skus?: Sku
  brands?: Brand
  customers?: Customer
  invoices?: Invoice
}

export interface PurchaseBill {
  id: string
  brand_id: string | null
  date: string
  invoice_number: string | null
  total_amount: number
  amount_paid: number
  payment_status: PaymentStatus
  created_at: string
  brands?: Brand
}

export interface Payment {
  id: string
  type: PaymentType
  customer_id: string | null
  brand_id: string | null
  invoice_id: string | null
  purchase_bill_id: string | null
  amount: number
  date: string
  mode: PaymentMode
  notes: string | null
  created_at: string
  customers?: Customer
  brands?: Brand
}

export interface Expense {
  id: string
  category: ExpenseCategory
  date: string
  amount: number
  vehicle_id: string | null
  driver_id: string | null
  notes: string | null
  source_vehicle_log_id: string | null
  created_at: string
  vehicles?: Vehicle
  drivers?: Driver
}

export interface VehicleLog {
  id: string
  vehicle_id: string
  date: string
  odo_start: number | null
  odo_end: number | null
  km_travelled: number | null   // generated column
  diesel_litres: number | null
  diesel_rate: number | null
  diesel_amount: number | null  // generated column
  driver_id: string | null
  created_at: string
  vehicles?: Vehicle
  drivers?: Driver
}

export interface Indent {
  id: string
  brand_id: string | null
  date: string
  status: IndentStatus
  created_at: string
  brands?: Brand
}

export interface IndentItem {
  id: string
  indent_id: string
  sku_id: string
  cases_requested: number
  skus?: Sku
}

// View types
export interface CurrentStockRow {
  sku_id: string
  sku_name: string
  brand_id: string
  brand_name: string
  category_id: string
  category_name: string
  units_per_case: number
  reorder_level_bottles: number
  default_purchase_price_per_bottle: number | null
  default_selling_price_per_bottle: number | null
  total_bottles: number
  cases: number
  loose_units: number
  weighted_avg_cost_per_bottle: number
  stock_value: number
}

export interface CustomerDueRow {
  customer_id: string
  customer_name: string
  phone: string | null
  credit_period_days: number
  invoice_count: number
  total_due: number
  oldest_invoice_date: string | null
  days_outstanding: number | null
}

export interface BrandPayableRow {
  brand_id: string
  brand_name: string
  payment_terms: string | null
  bill_count: number
  total_payable: number
}

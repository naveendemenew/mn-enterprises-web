// Indian number formatting utilities for MN Enterprises

export function formatINR(amount: number | null | undefined, decimals = 0): string {
  if (amount == null) return '—'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount)
}

export function formatNumber(n: number | null | undefined): string {
  if (n == null) return '—'
  return new Intl.NumberFormat('en-IN').format(n)
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  }).format(new Date(dateStr))
}

export function formatDateShort(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit', month: 'short',
  }).format(new Date(dateStr))
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

/** e.g. 5 cases + 3 loose → "5c 3L"  or just "5c" / "3L" */
export function formatStock(cases: number, loose: number, unitsPerCase?: number): string {
  const parts: string[] = []
  if (cases > 0) parts.push(`${formatNumber(cases)}c`)
  if (loose > 0) parts.push(`${formatNumber(loose)}L`)
  if (parts.length === 0) return '0'
  const total = unitsPerCase ? ` (${formatNumber(cases * unitsPerCase + loose)} btl)` : ''
  return parts.join(' + ') + total
}

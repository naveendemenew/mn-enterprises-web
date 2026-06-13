import PageHeader from '@/components/ui/PageHeader'

export default function CustomersPage() {
  return (
    <div>
      <PageHeader title="Customers / Dues" subtitle="Pending dues, ledger, and payment tracking per customer" />
      <div className="p-6">
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-400">
          Customers ledger — coming soon
        </div>
      </div>
    </div>
  )
}

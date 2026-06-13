import PageHeader from '@/components/ui/PageHeader'

export default function ExpensesPage() {
  return (
    <div>
      <PageHeader title="Expenses" subtitle="Diesel, driver payments, maintenance, and miscellaneous expenses" />
      <div className="p-6">
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-400">
          Expenses — coming soon
        </div>
      </div>
    </div>
  )
}

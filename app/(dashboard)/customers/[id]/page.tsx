import PageHeader from '@/components/ui/PageHeader'

export default function CustomerDetailPage({ params }: { params: { id: string } }) {
  return (
    <div>
      <PageHeader title="Customer Ledger" subtitle={`Customer ID: ${params.id}`} />
      <div className="p-6">
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-400">
          Customer detail ledger — coming soon
        </div>
      </div>
    </div>
  )
}

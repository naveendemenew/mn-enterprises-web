import PageHeader from '@/components/ui/PageHeader'

export default function SupplierDetailPage({ params }: { params: { id: string } }) {
  return (
    <div>
      <PageHeader title="Supplier Ledger" subtitle={`Brand ID: ${params.id}`} />
      <div className="p-6">
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-400">
          Supplier detail ledger — coming soon
        </div>
      </div>
    </div>
  )
}

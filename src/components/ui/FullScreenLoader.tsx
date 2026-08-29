import { Loader2 } from 'lucide-react'

export function FullScreenLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50">
      <Loader2 className="animate-spin text-brand-600" size={28} />
      <p className="text-sm font-medium text-slate-500">{label}</p>
    </div>
  )
}

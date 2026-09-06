import { FileText } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { YearlyReportSheet } from '@/components/reports/YearlyReportSheet'

export default function ReportsPage() {
  const { profile } = useAuth()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2.5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <FileText size={20} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Fiche de Suivi</h1>
          <p className="text-sm text-slate-500">{profile?.club?.name} — vue annuelle (Septembre → Août)</p>
        </div>
      </div>

      {profile?.club_id ? (
        <YearlyReportSheet clubId={profile.club_id} createdByProfileId={profile.id} />
      ) : (
        <div className="card p-6 text-sm text-slate-500">Aucun club associé à votre compte.</div>
      )}
    </div>
  )
}

import { FileText } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useCurrentReport } from '@/hooks/useReports'
import { ReportForm } from '@/components/reports/ReportForm'
import { CardSkeleton } from '@/components/ui/Skeleton'
import { MONTH_NAMES } from '@/utils/reportStatus'

export default function ReportsPage() {
  const { profile } = useAuth()
  const { report, loading, reload, month, year } = useCurrentReport(profile?.club_id)

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-2.5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <FileText size={20} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Monthly Report</h1>
          <p className="text-sm text-slate-500">
            {profile?.club?.name} — {MONTH_NAMES[month - 1]} {year}
          </p>
        </div>
      </div>

      <div className="card p-5 sm:p-6">
        {loading || !profile?.club_id ? (
          <CardSkeleton />
        ) : (
          <ReportForm
            clubId={profile.club_id}
            month={month}
            year={year}
            existing={report}
            createdByProfileId={profile.id}
            onSuccess={reload}
          />
        )}
      </div>
    </div>
  )
}

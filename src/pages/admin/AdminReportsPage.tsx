import { useEffect, useMemo, useState } from 'react'
import { FileText, Users, UserCheck, CalendarCheck2, Users2 } from 'lucide-react'
import { useClubs } from '@/hooks/useClubs'
import { listAllReports } from '@/services/reports'
import type { ReportWithClub } from '@/types/database'
import { MONTH_NAMES } from '@/utils/reportStatus'
import { CardSkeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'

const currentYear = new Date().getFullYear()
const YEAR_OPTIONS = [currentYear - 1, currentYear, currentYear + 1]

export default function AdminReportsPage() {
  const { clubs } = useClubs()
  const [reports, setReports] = useState<ReportWithClub[]>([])
  const [loading, setLoading] = useState(true)
  const [clubFilter, setClubFilter] = useState('all')
  const [monthFilter, setMonthFilter] = useState(new Date().getMonth() + 1)
  const [yearFilter, setYearFilter] = useState(currentYear)

  useEffect(() => {
    listAllReports()
      .then(setReports)
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    return reports.filter((r) => {
      if (r.month !== monthFilter || r.year !== yearFilter) return false
      if (clubFilter !== 'all' && r.club_id !== clubFilter) return false
      return true
    })
  }, [reports, clubFilter, monthFilter, yearFilter])

  const submitted = filtered.filter((r) => r.status === 'submitted').length
  const draft = filtered.filter((r) => r.status === 'draft').length
  const missing = Math.max((clubFilter === 'all' ? clubs.length : 1) - filtered.length, 0)

  const clubsWithoutReport = useMemo(() => {
    const reportedClubIds = new Set(filtered.map((r) => r.club_id))
    const pool = clubFilter === 'all' ? clubs : clubs.filter((c) => c.id === clubFilter)
    return pool.filter((c) => !reportedClubIds.has(c.id))
  }, [clubs, filtered, clubFilter])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2.5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <FileText size={20} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Reports</h1>
          <p className="text-sm text-slate-500">Monthly submissions across all clubs</p>
        </div>
      </div>

      <div className="card grid grid-cols-1 gap-3 p-4 sm:grid-cols-3 sm:p-5">
        <div>
          <label className="label">Club</label>
          <select className="input" value={clubFilter} onChange={(e) => setClubFilter(e.target.value)}>
            <option value="all">All Clubs</option>
            {clubs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Month</label>
          <select className="input" value={monthFilter} onChange={(e) => setMonthFilter(Number(e.target.value))}>
            {MONTH_NAMES.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Year</label>
          <select className="input" value={yearFilter} onChange={(e) => setYearFilter(Number(e.target.value))}>
            {YEAR_OPTIONS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <SummaryCard icon={Users2} label="Total" value={clubFilter === 'all' ? clubs.length : 1} />
        <SummaryCard icon={CalendarCheck2} label="Submitted" value={submitted} accent="text-emerald-600" />
        <SummaryCard icon={Users} label="Missing" value={missing} accent="text-rose-600" />
      </div>

      {loading ? (
        <CardSkeleton />
      ) : filtered.length === 0 && clubsWithoutReport.length === 0 ? (
        <EmptyState icon={FileText} title="No data for this selection" />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/70 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3">Club</th>
                <th className="px-4 py-3">Status</th>
                <th className="hidden px-4 py-3 sm:table-cell">Members</th>
                <th className="hidden px-4 py-3 sm:table-cell">Active</th>
                <th className="hidden px-4 py-3 md:table-cell">Events</th>
                <th className="hidden px-4 py-3 md:table-cell">Meetings</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 font-medium text-slate-800">{r.club?.name}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${r.status === 'submitted' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                      {r.status === 'submitted' ? 'Submitted' : 'Draft'}
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 text-slate-600 sm:table-cell">{r.members}</td>
                  <td className="hidden px-4 py-3 text-slate-600 sm:table-cell">{r.active_members}</td>
                  <td className="hidden px-4 py-3 text-slate-600 md:table-cell">{r.events}</td>
                  <td className="hidden px-4 py-3 text-slate-600 md:table-cell">{r.meetings}</td>
                </tr>
              ))}
              {clubsWithoutReport.map((c) => (
                <tr key={c.id} className="bg-rose-50/30">
                  <td className="px-4 py-3 font-medium text-slate-800">{c.name}</td>
                  <td className="px-4 py-3">
                    <span className="badge bg-rose-50 text-rose-700">
                      <UserCheck size={12} /> Not submitted
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 text-slate-400 sm:table-cell">—</td>
                  <td className="hidden px-4 py-3 text-slate-400 sm:table-cell">—</td>
                  <td className="hidden px-4 py-3 text-slate-400 md:table-cell">—</td>
                  <td className="hidden px-4 py-3 text-slate-400 md:table-cell">—</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function SummaryCard({ icon: Icon, label, value, accent = 'text-brand-600' }: { icon: typeof Users; label: string; value: number; accent?: string }) {
  return (
    <div className="card p-4">
      <div className={`mb-1.5 flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 ${accent}`}>
        <Icon size={16} />
      </div>
      <p className="text-xs font-semibold text-slate-400">{label}</p>
      <p className="text-xl font-bold text-slate-900">{value}</p>
    </div>
  )
}

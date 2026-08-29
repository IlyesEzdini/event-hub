import { Link } from 'react-router-dom'
import { Building2, Users, CalendarCheck, FileCheck2, AlertTriangle, CalendarDays } from 'lucide-react'
import { useEvents } from '@/hooks/useEvents'
import { useClubs } from '@/hooks/useClubs'
import { useManagers } from '@/hooks/useManagers'
import { useEffect, useState } from 'react'
import { listAllReports } from '@/services/reports'
import type { ReportWithClub } from '@/types/database'
import { getCurrentMonthYear } from '@/utils/reportStatus'
import { CardSkeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'

export default function AdminDashboard() {
  const { events, loading: eventsLoading } = useEvents()
  const { clubs, loading: clubsLoading } = useClubs()
  const { managers, loading: managersLoading } = useManagers()
  const [reports, setReports] = useState<ReportWithClub[]>([])
  const [reportsLoading, setReportsLoading] = useState(true)
  const { month, year } = getCurrentMonthYear()

  useEffect(() => {
    listAllReports()
      .then(setReports)
      .finally(() => setReportsLoading(false))
  }, [])

  const thisMonthReports = reports.filter((r) => r.month === month && r.year === year)
  const submittedCount = thisMonthReports.filter((r) => r.status === 'submitted').length
  const draftCount = thisMonthReports.filter((r) => r.status === 'draft').length
  const missingCount = Math.max(clubs.length - thisMonthReports.length, 0)

  const eventsThisMonth = events.filter((e) => {
    const d = new Date(e.event_date)
    return d.getMonth() + 1 === month && d.getFullYear() === year
  })

  const upcoming = events
    .filter((e) => new Date(e.event_date) >= new Date(new Date().toDateString()))
    .slice(0, 6)

  const loading = eventsLoading || clubsLoading || managersLoading || reportsLoading

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Admin Overview</h1>
        <p className="mt-1 text-sm text-slate-500">Coordinating {clubs.length} clubs and {managers.length} managers</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Building2} label="Total Clubs" value={clubs.length} loading={loading} />
        <StatCard icon={Users} label="Total Managers" value={managers.length} loading={loading} />
        <StatCard icon={CalendarCheck} label="Events This Month" value={eventsThisMonth.length} loading={loading} />
        <StatCard icon={FileCheck2} label="Reports Submitted" value={submittedCount} loading={loading} accent="text-emerald-600" />
      </div>

      <div className="card p-5">
        <h2 className="mb-4 text-sm font-bold text-slate-900">Report Completion — This Month</h2>
        {loading ? (
          <CardSkeleton />
        ) : (
          <>
            <div className="mb-3 flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
              {clubs.length > 0 && (
                <>
                  <div className="bg-emerald-500" style={{ width: `${(submittedCount / clubs.length) * 100}%` }} />
                  <div className="bg-amber-400" style={{ width: `${(draftCount / clubs.length) * 100}%` }} />
                  <div className="bg-rose-400" style={{ width: `${(missingCount / clubs.length) * 100}%` }} />
                </>
              )}
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <LegendItem color="bg-emerald-500" label={`${submittedCount} Submitted`} />
              <LegendItem color="bg-amber-400" label={`${draftCount} Draft`} />
              <LegendItem color="bg-rose-400" label={`${missingCount} Missing`} />
              <span className="ml-auto font-semibold text-slate-500">{clubs.length} clubs total</span>
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">Upcoming Events</h2>
            <Link to="/calendar" className="text-xs font-semibold text-brand-600 hover:text-brand-700">
              View calendar
            </Link>
          </div>
          {loading ? (
            <CardSkeleton />
          ) : upcoming.length === 0 ? (
            <EmptyState icon={CalendarDays} title="No upcoming events" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {upcoming.map((ev) => (
                <li key={ev.id} className="flex items-center justify-between py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">{ev.event_name}</p>
                    <p className="text-xs text-slate-400">{ev.club?.name}</p>
                  </div>
                  <span className="shrink-0 text-xs font-medium text-slate-500">
                    {new Date(ev.event_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">Clubs</h2>
            <Link to="/admin/clubs" className="text-xs font-semibold text-brand-600 hover:text-brand-700">
              Manage
            </Link>
          </div>
          {loading ? (
            <CardSkeleton />
          ) : clubs.length === 0 ? (
            <EmptyState icon={Building2} title="No clubs yet" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {clubs.slice(0, 6).map((club) => {
                const mgr = managers.find((m) => m.club_id === club.id)
                return (
                  <li key={club.id} className="flex items-center justify-between py-2.5">
                    <p className="text-sm font-medium text-slate-800">{club.name}</p>
                    <p className="text-xs text-slate-400">{mgr?.manager_name ?? 'No manager'}</p>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      {missingCount > 0 && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle size={18} className="shrink-0" />
          <span>
            <strong>{missingCount}</strong> club{missingCount === 1 ? '' : 's'} {missingCount === 1 ? 'has' : 'have'} not started this month's report yet.
          </span>
          <Link to="/admin/reports" className="ml-auto shrink-0 font-semibold hover:underline">
            Review
          </Link>
        </div>
      )}
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  loading,
  accent = 'text-brand-600',
}: {
  icon: typeof Building2
  label: string
  value: number
  loading: boolean
  accent?: string
}) {
  return (
    <div className="card p-4 sm:p-5">
      <div className={`mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 ${accent}`}>
        <Icon size={18} />
      </div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      {loading ? (
        <div className="mt-1 h-7 w-12 animate-pulse rounded bg-slate-200" />
      ) : (
        <p className="mt-0.5 text-2xl font-bold text-slate-900">{value}</p>
      )}
    </div>
  )
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-slate-600">
      <span className={`h-2 w-2 rounded-full ${color}`} /> {label}
    </span>
  )
}

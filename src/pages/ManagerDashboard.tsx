import { Link } from 'react-router-dom'
import { CalendarDays, FileText, FolderOpen, Plus, ArrowRight } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useEvents } from '@/hooks/useEvents'
import { useCurrentReport } from '@/hooks/useReports'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { CardSkeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { getCurrentMonthStatus, MONTH_NAMES } from '@/utils/reportStatus'

export default function ManagerDashboard() {
  const { profile } = useAuth()
  const { events, loading: eventsLoading } = useEvents()
  const { report, loading: reportLoading, month, year } = useCurrentReport(profile?.club_id)

  const status = getCurrentMonthStatus(report, month, year)
  const myClubUpcoming = events
    .filter((e) => e.club_id === profile?.club_id && new Date(e.event_date) >= new Date(new Date().toDateString()))
    .slice(0, 5)
  const allUpcoming = events
    .filter((e) => new Date(e.event_date) >= new Date(new Date().toDateString()))
    .slice(0, 5)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Welcome, {profile?.manager_name}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {profile?.club?.name ?? 'No club assigned'} · {MONTH_NAMES[month - 1]} {year}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">This Month's Report</p>
          {reportLoading ? (
            <div className="mt-2">
              <CardSkeleton />
            </div>
          ) : (
            <div className="mt-2.5 flex items-center justify-between">
              <StatusBadge status={status} />
              <Link to="/reports" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
                {status === 'Submitted' ? 'View' : 'Complete'} →
              </Link>
            </div>
          )}
        </div>

        <div className="card p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Upcoming Events (My Club)</p>
          <p className="mt-2.5 text-3xl font-bold text-slate-900">{myClubUpcoming.length}</p>
        </div>

        <div className="card p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Quick Action</p>
          <Link to="/calendar" className="mt-2.5 flex items-center gap-2 text-sm font-semibold text-brand-600 hover:text-brand-700">
            <Plus size={16} /> Add an event
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">Upcoming — All Clubs</h2>
            <Link to="/calendar" className="text-xs font-semibold text-brand-600 hover:text-brand-700">
              View calendar
            </Link>
          </div>
          {eventsLoading ? (
            <CardSkeleton />
          ) : allUpcoming.length === 0 ? (
            <EmptyState icon={CalendarDays} title="No upcoming events" description="Nothing scheduled yet across clubs." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {allUpcoming.map((ev) => (
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
          <h2 className="mb-3 text-sm font-bold text-slate-900">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            <QuickAction to="/calendar" icon={Plus} label="Add Event" />
            <QuickAction to="/reports" icon={FileText} label="Monthly Report" />
            <QuickAction to="/calendar" icon={CalendarDays} label="Calendar" />
            <QuickAction to="/resources" icon={FolderOpen} label="Resources" />
          </div>
        </div>
      </div>
    </div>
  )
}

function QuickAction({ to, icon: Icon, label }: { to: string; icon: typeof Plus; label: string }) {
  return (
    <Link
      to={to}
      className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
    >
      <span className="flex items-center gap-2">
        <Icon size={16} /> {label}
      </span>
      <ArrowRight size={14} className="text-slate-300" />
    </Link>
  )
}

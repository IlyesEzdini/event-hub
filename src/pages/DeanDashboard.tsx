import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, ClipboardList, FileText, Users, ClipboardCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useClubs } from '@/hooks/useClubs'
import { listEventsForClubs } from '@/services/events'
import { listReportsForClubs } from '@/services/reports'
import { listEventRequestsForClubs, type EventRequestWithClub } from '@/services/eventRequests'
import type { EventWithClub, ReportWithClub } from '@/types/database'
import { CardSkeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'

export default function DeanDashboard() {
  const { profile } = useAuth()
  const { clubs, loading: clubsLoading } = useClubs()
  const [events, setEvents] = useState<EventWithClub[]>([])
  const [reports, setReports] = useState<ReportWithClub[]>([])
  const [requests, setRequests] = useState<EventRequestWithClub[]>([])
  const [loading, setLoading] = useState(true)

  const responsibleNames = useMemo(() => {
    if (!profile) return []
    const fromJson = Array.isArray(profile.clubs) ? profile.clubs : []
    return fromJson.length > 0 ? fromJson : profile.responsible_clubs ?? []
  }, [profile])

  const responsibleClubs = useMemo(
    () => clubs.filter((club) => responsibleNames.includes(club.name)),
    [clubs, responsibleNames],
  )

  const responsibleClubIds = useMemo(
    () => responsibleClubs.map((club) => club.id),
    [responsibleClubs],
  )

  useEffect(() => {
    if (clubsLoading) return
    setLoading(true)
    Promise.all([
      listEventsForClubs(responsibleClubIds),
      listReportsForClubs(responsibleClubIds),
      listEventRequestsForClubs(responsibleClubIds),
    ])
      .then(([nextEvents, nextReports, nextRequests]) => {
        setEvents(nextEvents)
        setReports(nextReports)
        setRequests(nextRequests)
      })
      .catch((error) => {
        console.error('Failed to load dean dashboard', error)
      })
      .finally(() => setLoading(false))
  }, [clubsLoading, responsibleClubIds.join(',')])

  const upcomingEvents = events
    .filter((event) => new Date(`${event.event_date}T00:00:00`) >= new Date(new Date().toDateString()))
    .slice(0, 6)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Welcome, {profile?.manager_name}</h1>
        <p className="mt-1 text-sm text-slate-500">
          Dean overview · {responsibleClubs.length} responsible club{responsibleClubs.length === 1 ? '' : 's'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat icon={Users} label="Responsible clubs" value={responsibleClubs.length} />
        <Stat icon={CalendarDays} label="Upcoming events" value={upcomingEvents.length} />
        <Stat icon={FileText} label="Submitted reports" value={reports.length} />
        <Stat icon={ClipboardList} label="Event requests" value={requests.length} />
      </div>

      <div className="card p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Managers' upcoming events</h2>
            <p className="mt-1 text-xs text-slate-400">Only your responsible clubs are shown here.</p>
          </div>
          <Link to="/calendar" className="text-xs font-semibold text-brand-600 hover:text-brand-700">
            Full calendar
          </Link>
        </div>
        {loading ? (
          <CardSkeleton />
        ) : upcomingEvents.length === 0 ? (
          <EmptyState icon={CalendarDays} title="No upcoming events" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {upcomingEvents.map((event) => (
              <li key={event.id} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">{event.event_name}</p>
                  <p className="text-xs text-slate-400">{event.club?.name} · {event.event_location}</p>
                </div>
                <span className="shrink-0 text-xs font-medium text-slate-500">
                  {new Date(`${event.event_date}T00:00:00`).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">Submitted reports</h2>
            <FileText size={17} className="text-brand-500" />
          </div>
          {loading ? <CardSkeleton /> : reports.length === 0 ? (
            <EmptyState icon={FileText} title="No submitted reports" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {reports.slice(0, 6).map((report) => (
                <li key={report.id} className="flex items-center justify-between py-2.5">
                  <span className="text-sm text-slate-700">{report.club?.name}</span>
                  <span className="text-xs text-slate-400">{report.month}/{report.year}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">Event requests</h2>
            <ClipboardList size={17} className="text-brand-500" />
          </div>
          {loading ? <CardSkeleton /> : requests.length === 0 ? (
            <EmptyState icon={ClipboardList} title="No event requests" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {requests.slice(0, 6).map((request) => (
                <li key={request.id} className="py-2.5">
                  <p className="truncate text-sm text-slate-700">{request.club?.name} · {request.objectifs || 'Event request'}</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {new Date(request.submitted_at).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <Link to="/interviews" className="card flex items-center justify-between p-5 hover:border-brand-200 hover:bg-brand-50/30">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <ClipboardCheck size={19} />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">Interviews</p>
            <p className="text-xs text-slate-500">Create and follow up recruitment interviews.</p>
          </div>
        </div>
        <span className="text-sm font-semibold text-brand-600">Open →</span>
      </Link>
    </div>
  )
}

function Stat({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number }) {
  return (
    <div className="card p-4 sm:p-5">
      <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 text-brand-600">
        <Icon size={18} />
      </div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  )
}

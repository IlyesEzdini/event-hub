import { useMemo, useState } from 'react'
import { CalendarDays, Plus, Search, SlidersHorizontal, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/contexts/AuthContext'
import { useEvents } from '@/hooks/useEvents'
import { useClubs } from '@/hooks/useClubs'
import { useManagers } from '@/hooks/useManagers'
import { MonthCalendar } from '@/components/calendar/MonthCalendar'
import { EventForm } from '@/components/events/EventForm'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { CardSkeleton } from '@/components/ui/Skeleton'
import { deleteEvent } from '@/services/events'
import type { EventWithClub, ProfileWithRelations } from '@/types/database'

export default function CalendarPage() {
  const { profile } = useAuth()
  const { events, loading, reload } = useEvents()
  const { clubs } = useClubs()
  const { managers } = useManagers()
  const [formOpen, setFormOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<EventWithClub | undefined>(undefined)
  const [deleteTarget, setDeleteTarget] = useState<EventWithClub | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [selectedClubId, setSelectedClubId] = useState('all')

  const isAdmin = profile?.role === 'admin'
  const isManager = profile?.role === 'manager'
  const canCreateEvents = isAdmin || isManager

  function canManage(event: EventWithClub) {
    return isAdmin || (isManager && event.club_id === profile?.club_id)
  }

  function openCreate() {
    setEditingEvent(undefined)
    setFormOpen(true)
  }

  function openEdit(event: EventWithClub) {
    setEditingEvent(event)
    setFormOpen(true)
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteEvent(deleteTarget.id)
      toast.success('Event deleted.')
      setDeleteTarget(null)
      reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to delete the event.')
    } finally {
      setDeleting(false)
    }
  }

  const filteredEvents = useMemo(
    () => selectedClubId === 'all' ? events : events.filter((event) => event.club_id === selectedClubId),
    [events, selectedClubId],
  )

  const managerForEvent = (event: EventWithClub): ProfileWithRelations | undefined =>
    managers.find((manager) => manager.id === event.created_by) ??
    managers.find((manager) => manager.club_id === event.club_id)

  return (
    <div className="min-h-full space-y-5">
      <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-white to-indigo-50/80 p-5 shadow-sm sm:p-7">
        <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-indigo-100/60 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-700 text-white shadow-lg shadow-indigo-500/20">
              <CalendarDays size={27} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-600">EventHub · Club coordination</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Shared Calendar</h1>
              <p className="mt-1 text-sm text-slate-500">Every club’s events, organized by manager</p>
            </div>
          </div>
          {canCreateEvents && (
            <button onClick={openCreate} className="btn-primary inline-flex items-center justify-center gap-2 self-start sm:self-auto">
              <Plus size={16} /> Add Event
            </button>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
          <SlidersHorizontal size={14} /> Calendar filters
        </div>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-500">Filter by club</span>
            <span className="relative block">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <select className="input pl-9" value={selectedClubId} onChange={(e) => setSelectedClubId(e.target.value)}>
                <option value="all">All clubs</option>
                {[...clubs].sort((a, b) => a.name.localeCompare(b.name)).map((club) => (
                  <option key={club.id} value={club.id}>{club.name}</option>
                ))}
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            </span>
          </label>
          <div className="flex items-end justify-between rounded-xl bg-slate-50 px-4 py-3">
            <div>
              <p className="text-xs font-semibold text-slate-500">Events shown</p>
              <p className="mt-0.5 text-lg font-bold text-slate-900">{filteredEvents.length}</p>
            </div>
            {selectedClubId !== 'all' && (
              <button className="text-xs font-semibold text-indigo-600 hover:text-indigo-800" onClick={() => setSelectedClubId('all')}>Clear club filter</button>
            )}
          </div>
        </div>
      </section>

      {loading ? <CardSkeleton /> : (
        <MonthCalendar
          events={filteredEvents}
          managers={managers}
          onEditEvent={openEdit}
          onDeleteEvent={setDeleteTarget}
          canManageEvent={canManage}
        />
      )}

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editingEvent ? 'Edit Event' : 'Add Event'}>
        <EventForm
          clubId={isAdmin ? undefined : profile?.club_id ?? undefined}
          clubs={isAdmin ? clubs : undefined}
          event={editingEvent}
          createdByProfileId={profile?.id ?? null}
          onSuccess={() => { setFormOpen(false); reload() }}
          onCancel={() => setFormOpen(false)}
        />
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete event?"
        message={`This will permanently remove "${deleteTarget?.event_name}". This cannot be undone.`}
        confirmLabel="Delete"
        danger
        loading={deleting}
      />
    </div>
  )
}

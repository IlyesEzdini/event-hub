import { useState } from 'react'
import { Plus, CalendarDays } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/contexts/AuthContext'
import { useEvents } from '@/hooks/useEvents'
import { useClubs } from '@/hooks/useClubs'
import { MonthCalendar } from '@/components/calendar/MonthCalendar'
import { EventForm } from '@/components/events/EventForm'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { CardSkeleton } from '@/components/ui/Skeleton'
import { deleteEvent } from '@/services/events'
import type { EventWithClub } from '@/types/database'

export default function CalendarPage() {
  const { profile } = useAuth()
  const { events, loading, reload } = useEvents()
  const { clubs } = useClubs()
  const [formOpen, setFormOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<EventWithClub | undefined>(undefined)
  const [deleteTarget, setDeleteTarget] = useState<EventWithClub | null>(null)
  const [deleting, setDeleting] = useState(false)

  const isAdmin = profile?.role === 'admin'

  function canManage(event: EventWithClub) {
    return isAdmin || event.club_id === profile?.club_id
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <CalendarDays size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Shared Calendar</h1>
            <p className="text-sm text-slate-500">Every club's events in one place</p>
          </div>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <Plus size={16} /> Add Event
        </button>
      </div>

      {loading ? (
        <CardSkeleton />
      ) : (
        <MonthCalendar
          events={events}
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
          onSuccess={() => {
            setFormOpen(false)
            reload()
          }}
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

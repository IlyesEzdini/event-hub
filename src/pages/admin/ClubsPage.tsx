import { useState, type FormEvent } from 'react'
import toast from 'react-hot-toast'
import { Building2, Plus } from 'lucide-react'
import { useClubs } from '@/hooks/useClubs'
import { useManagers } from '@/hooks/useManagers'
import { useEvents } from '@/hooks/useEvents'
import { createClub } from '@/services/clubs'
import { Modal } from '@/components/ui/Modal'
import { CardSkeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'

export default function ClubsPage() {
  const { clubs, loading, reload } = useClubs()
  const { managers } = useManagers()
  const { events } = useEvents()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSubmitting(true)
    try {
      await createClub(name.trim())
      toast.success('Club added.')
      setName('')
      setOpen(false)
      reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to add this club.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <Building2 size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Clubs</h1>
            <p className="text-sm text-slate-500">{clubs.length} clubs registered</p>
          </div>
        </div>
        <button className="btn-primary" onClick={() => setOpen(true)}>
          <Plus size={16} /> Add Club
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : clubs.length === 0 ? (
        <EmptyState icon={Building2} title="No clubs yet" description="Add your first club to start assigning managers." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clubs.map((club) => {
            const manager = managers.find((m) => m.club_id === club.id)
            const eventCount = events.filter((e) => e.club_id === club.id).length
            return (
              <div key={club.id} className="card p-5">
                <h3 className="text-sm font-bold text-slate-900">{club.name}</h3>
                <p className="mt-1 text-sm text-slate-500">{manager ? manager.manager_name : 'No manager assigned'}</p>
                <div className="mt-4 flex items-center gap-4 text-xs text-slate-400">
                  <span>{eventCount} event{eventCount === 1 ? '' : 's'}</span>
                  <span>Added {new Date(club.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Add Club" maxWidth="max-w-sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Club Name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Club Delta" autoFocus />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Adding…' : 'Add club'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

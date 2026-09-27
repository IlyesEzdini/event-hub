import { useMemo, useState, type FormEvent } from 'react'
import toast from 'react-hot-toast'
import { CalendarCheck2, CheckCircle2, Clock3, MapPin, Pencil, Plus, UserRound } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useClubs } from '@/hooks/useClubs'
import { useCoordinators } from '@/hooks/useCoordinators'
import { useInterviews } from '@/hooks/useInterviews'
import { createInterview, markInterviewDone, updateInterview } from '@/services/interviews'
import { Modal } from '@/components/ui/Modal'
import { CardSkeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import type {
  CoordinatorField,
  InterviewDepartment,
  InterviewPoste,
  InterviewWithClub,
} from '@/types/database'

const POSTES: { value: InterviewPoste; label: string }[] = [
  { value: 'manager', label: 'Manager' },
  { value: 'assistant', label: 'Assistant' },
  { value: 'president', label: 'President' },
  { value: 'vice_president', label: 'Vice-president' },
]

const DEPARTMENTS: { value: InterviewDepartment; label: string }[] = [
  { value: 'event', label: 'Event' },
  { value: 'COM', label: 'COM' },
  { value: 'RH', label: 'RH' },
  { value: 'partenariat', label: 'Partenariat' },
  { value: 'PAP', label: 'PAP' },
]

function requiredCoordinatorField(
  poste: InterviewPoste,
  department: InterviewDepartment
) {
  if (poste === 'president' || poste === 'vice_president') {
    return 'regional'
  }

  return department
}

export default function InterviewsPage() {
  const { profile } = useAuth()
  const { clubs } = useClubs()
  const { coordinators } = useCoordinators()
  const { interviews, loading, reload } = useInterviews()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<InterviewWithClub | null>(null)
  const [saving, setSaving] = useState(false)
  const isDean = profile?.role === 'dean'
  const isCoordinator = profile?.role === 'coordinator'

  const responsibleNames = useMemo(() => {
    if (!profile) return []
    return profile.clubs?.length ? profile.clubs : profile.responsible_clubs ?? []
  }, [profile])

  const responsibleClubs = useMemo(
    () => clubs.filter((club) => responsibleNames.includes(club.name)),
    [clubs, responsibleNames],
  )

  const upcoming = interviews.filter((item) => item.status === 'pending')
  const done = interviews.filter((item) => item.status === 'done')

  function openCreate() {
    setEditing(null)
    setFormOpen(true)
  }

  function openEdit(interview: InterviewWithClub) {
    setEditing(interview)
    setFormOpen(true)
  }

  async function handleSave(input: InterviewFormState) {
    setSaving(true)
    try {
      if (editing) {
        await updateInterview(editing.id, {
          ...(isDean ? { dean_profile_id: profile?.id ?? editing.dean_profile_id, club_id: input.club_id } : {}),
          interview_date: input.interview_date,
          interview_time: input.interview_time,
          place: input.place,
          poste: input.poste,
          department: input.department,
          coordinator_emails: input.coordinator_email,
        })
        toast.success('Interview updated.')
      } else {
        if (!profile?.id) throw new Error('Dean profile not found.')
        await createInterview({
          dean_profile_id: profile.id,
          club_id: input.club_id,
          interview_date: input.interview_date,
          interview_time: input.interview_time,
          place: input.place,
          poste: input.poste,
          department: input.department,
          coordinator_emails: input.coordinator_email,
        })
        toast.success('Interview created.')
      }
      setFormOpen(false)
      setEditing(null)
      await reload()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save the interview.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDone(interview: InterviewWithClub) {
    try {
      await markInterviewDone(interview.id)
      toast.success('Interview marked as done.')
      await reload()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update the interview.')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <CalendarCheck2 size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Interviews</h1>
            <p className="text-sm text-slate-500">
              {isDean ? 'Create and manage interviews for your responsible clubs.' : 'Interviews assigned to you.'}
            </p>
          </div>
        </div>
        {isDean && (
          <button className="btn-primary" onClick={openCreate}>
            <Plus size={16} /> Create interview
          </button>
        )}
      </div>

      {loading ? (
        <CardSkeleton />
      ) : interviews.length === 0 ? (
        <div className="card p-8">
          <EmptyState icon={CalendarCheck2} title="No interviews yet" description={isDean ? 'Create your first interview.' : 'No interview has been assigned to you.'} />
        </div>
      ) : (
        <div className="space-y-6">
          <InterviewSection
            title="Pending"
            items={upcoming}
            onEdit={openEdit}
            onDone={handleDone}
            canEdit={isDean || isCoordinator}
            emptyText="No pending interviews."
          />
          <InterviewSection
            title="Done"
            items={done}
            onEdit={openEdit}
            onDone={handleDone}
            canEdit={isDean || isCoordinator}
            emptyText="No completed interviews."
          />
        </div>
      )}

      <Modal
        open={formOpen}
        onClose={() => !saving && setFormOpen(false)}
        title={editing ? 'Edit interview' : 'Create interview'}
      >
        <InterviewForm
          isDean={isDean}
          profileName={profile?.manager_name ?? ''}
          responsibleClubs={responsibleClubs}
          coordinators={coordinators}
          interview={editing}
          saving={saving}
          onSubmit={handleSave}
          onCancel={() => setFormOpen(false)}
        />
      </Modal>
    </div>
  )
}

interface InterviewFormState {
  club_id: string
  interview_date: string
  interview_time: string
  place: string
  poste: InterviewPoste
  department: InterviewDepartment
  coordinator_email: string
}

function InterviewForm({
  isDean,
  profileName,
  responsibleClubs,
  coordinators,
  interview,
  saving,
  onSubmit,
  onCancel,
}: {
  isDean: boolean
  profileName: string
  responsibleClubs: { id: string; name: string }[]
  coordinators: { email: string; username: string; field: CoordinatorField }[]
  interview: InterviewWithClub | null
  saving: boolean
  onSubmit: (input: InterviewFormState) => Promise<void>
  onCancel: () => void
}) {
  const [form, setForm] = useState<InterviewFormState>(() => ({
    club_id: interview?.club_id ?? responsibleClubs[0]?.id ?? '',
    interview_date: interview?.interview_date ?? '',
    interview_time: interview?.interview_time?.slice(0, 5) ?? '',
    place: interview?.place ?? '',
    poste: interview?.poste ?? 'manager',
    department: interview?.department ?? 'event',
    coordinator_email: interview?.coordinator_email ?? '',
  }))
  const requiredField = requiredCoordinatorField(form.poste, form.department)
  const availableCoordinators = coordinators.filter((coordinator) => coordinator.field === requiredField)

  function set<K extends keyof InterviewFormState>(key: K, value: InterviewFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function handlePoste(value: InterviewPoste) {
    const field = requiredCoordinatorField(value, form.department)
    const available = coordinators.filter((coordinator) => coordinator.field === field)
    setForm((current) => ({
      ...current,
      poste: value,
      coordinator_email: available.some((coordinator) => coordinator.email === current.coordinator_email)
        ? current.coordinator_email
        : '',
    }))
  }

  function handleDepartment(value: InterviewDepartment) {
    const field = requiredCoordinatorField(form.poste, value)
    const available = coordinators.filter((coordinator) => coordinator.field === field)
    setForm((current) => ({
      ...current,
      department: value,
      coordinator_email: available.some((coordinator) => coordinator.email === current.coordinator_email)
        ? current.coordinator_email
        : '',
    }))
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!form.club_id || !form.interview_date || !form.interview_time || !form.place || !form.coordinator_email) {
      toast.error('Please complete all interview fields.')
      return
    }
    await onSubmit(form)
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label">Dean</label>
        <input className="input bg-slate-50" value={profileName} readOnly />
      </div>

      <div>
        <label className="label">Club</label>
        {isDean ? (
          <select className="input" value={form.club_id} onChange={(e) => set('club_id', e.target.value)}>
            <option value="">Select a club</option>
            {responsibleClubs.map((club) => <option key={club.id} value={club.id}>{club.name}</option>)}
          </select>
        ) : (
          <input className="input bg-slate-50" value={interview?.club?.name ?? ''} readOnly />
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Date</label>
          <input className="input" type="date" value={form.interview_date} onChange={(e) => set('interview_date', e.target.value)} />
        </div>
        <div>
          <label className="label">Time</label>
          <input className="input" type="time" value={form.interview_time} onChange={(e) => set('interview_time', e.target.value)} />
        </div>
      </div>

      <div>
        <label className="label">Place</label>
        <input className="input" value={form.place} onChange={(e) => set('place', e.target.value)} placeholder="Meeting room / venue" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Poste</label>
          <select className="input" value={form.poste} onChange={(e) => handlePoste(e.target.value as InterviewPoste)}>
            {POSTES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Department</label>
          <select className="input" value={form.department} onChange={(e) => handleDepartment(e.target.value as InterviewDepartment)}>
            {DEPARTMENTS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="label">Coordinator</label>
        <select className="input" value={form.coordinator_email} onChange={(e) => set('coordinator_email', e.target.value)}>
          <option value="">Select a coordinator</option>
          {availableCoordinators.map((coordinator) => (
            <option key={coordinator.email} value={coordinator.email}>
              {coordinator.username} · {coordinator.field}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-slate-400">
          Required field: <strong>{requiredField}</strong>
        </p>
        {availableCoordinators.length === 0 && (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            No coordinator is configured for this field yet.
          </p>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={saving}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={saving || availableCoordinators.length === 0}>
          {saving ? 'Saving…' : interview ? 'Save changes' : 'Create interview'}
        </button>
      </div>
    </form>
  )
}

function InterviewSection({
  title,
  items,
  onEdit,
  onDone,
  canEdit,
  emptyText,
}: {
  title: string
  items: InterviewWithClub[]
  onEdit: (item: InterviewWithClub) => void
  onDone: (item: InterviewWithClub) => void
  canEdit: boolean
  emptyText: string
}) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        {title === 'Done' ? <CheckCircle2 size={17} className="text-emerald-500" /> : <Clock3 size={17} className="text-amber-500" />}
        <h2 className="text-sm font-bold text-slate-900">{title}</h2>
      </div>
      {items.length === 0 ? (
        <div className="card p-5 text-sm text-slate-400">{emptyText}</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {items.map((interview) => (
            <div key={interview.id} className="card p-5">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-900">{interview.club?.name ?? 'Unknown club'}</p>
                  <p className="mt-1 text-xs text-slate-500 capitalize">{interview.poste.replace('_', ' ')} · {interview.department}</p>
                </div>
                <span className={`badge ${interview.status === 'done' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                  {interview.status === 'done' ? 'Done' : 'Pending'}
                </span>
              </div>

              <div className="space-y-2 text-sm text-slate-600">
                <p className="flex items-center gap-2"><CalendarCheck2 size={15} /> {new Date(`${interview.interview_date}T00:00:00`).toLocaleDateString('fr-FR')}</p>
                <p className="flex items-center gap-2"><Clock3 size={15} /> {interview.interview_time.slice(0, 5)}</p>
                <p className="flex items-center gap-2"><MapPin size={15} /> {interview.place}</p>
                <p className="flex items-center gap-2"><UserRound size={15} /> {interview.coordinator_email}</p>
              </div>

              {canEdit && (
                <div className="mt-4 flex justify-end gap-2 border-t border-slate-100 pt-4">
                  <button className="btn-secondary text-xs" onClick={() => onEdit(interview)}>
                    <Pencil size={14} /> Edit
                  </button>
                  {interview.status !== 'done' && (
                    <button className="btn-primary text-xs" onClick={() => onDone(interview)}>
                      <CheckCircle2 size={14} /> Mark done
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

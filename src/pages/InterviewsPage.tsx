import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import toast from 'react-hot-toast'
import {
  CalendarCheck2,
  CheckCircle2,
  Clock3,
  MapPin,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  UserRound,
  UsersRound,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useClubs } from '@/hooks/useClubs'
import { useCoordinators } from '@/hooks/useCoordinators'
import { useDeans } from '@/hooks/useDeans'
import { useInterviews } from '@/hooks/useInterviews'
import {
  createInterview,
  deleteInterview,
  markInterviewDone,
  updateInterview,
} from '@/services/interviews'
import { Modal } from '@/components/ui/Modal'
import { CardSkeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import {
  getInitials,
  getInterviewDeanColor,
} from '@/utils/interviewColors'
import type {
  CoordinatorField,
  InterviewDepartment,
  InterviewPoste,
  InterviewWithClub,
  Profile,
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
  department: InterviewDepartment,
): CoordinatorField {
  if (poste === 'president' || poste === 'vice_president') return 'regional'
  return department
}

function canManageInterview(
  profile: ReturnType<typeof useAuth>['profile'],
  interview: InterviewWithClub,
) {
  if (!profile) return false
  if (profile.role === 'admin') return true
  return profile.role === 'dean' && profile.id === interview.dean_id
}

export default function InterviewsPage() {
  const { profile } = useAuth()
  const { clubs } = useClubs()
  const { coordinators } = useCoordinators()
  const { deans } = useDeans()
  const { interviews, loading, reload } = useInterviews()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<InterviewWithClub | null>(null)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const isAdmin = profile?.role === 'admin'
  const isDean = profile?.role === 'dean'

  const responsibleNames = useMemo(() => {
    if (!profile) return []
    return profile.responsible_clubs?.length
      ? profile.responsible_clubs
      : profile.clubs ?? []
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
    if (!canManageInterview(profile, interview)) {
      toast.error('You can only edit your own interviews.')
      return
    }

    setEditing(interview)
    setFormOpen(true)
  }

  async function handleSave(input: InterviewFormState) {
    setSaving(true)

    try {
      if (editing) {
        const payload = {
          dean_id: input.dean_id,
          club_id: input.club_id,
          interview_date: input.interview_date,
          interview_time: input.interview_time,
          place: input.place,
          poste: input.poste,
          department: input.department,
          coordinator_emails: [input.coordinator_email],
        }

        await updateInterview(editing.id, payload)
        toast.success('Interview updated.')
      } else {
        if (!input.dean_id) {
          throw new Error('Please select a dean.')
        }

        await createInterview({
          dean_id: input.dean_id,
          club_id: input.club_id,
          interview_date: input.interview_date,
          interview_time: input.interview_time,
          place: input.place,
          poste: input.poste,
          department: input.department,
          coordinator_emails: [input.coordinator_email],
        })

        toast.success('Interview created.')
      }

      setFormOpen(false)
      setEditing(null)
      await reload()
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Unable to save the interview.',
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleDone(interview: InterviewWithClub) {
    if (!canManageInterview(profile, interview)) {
      toast.error('You can only update your own interviews.')
      return
    }

    try {
      await markInterviewDone(interview.id)
      toast.success('Interview marked as done.')
      await reload()
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Unable to update the interview.',
      )
    }
  }

  async function handleDelete(interview: InterviewWithClub) {
    if (!isAdmin) return

    const confirmed = window.confirm(
      `Delete the interview for ${interview.club?.name ?? 'this club'}? This action cannot be undone.`,
    )

    if (!confirmed) return

    setDeletingId(interview.id)

    try {
      await deleteInterview(interview.id)
      toast.success('Interview deleted.')
      await reload()
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Unable to delete the interview.',
      )
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <CalendarCheck2 size={21} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Interviews</h1>
            <p className="text-sm text-slate-500">
              All interviews are visible. Editing is limited to admins and the dean concerned.
            </p>
          </div>
        </div>

        {(isAdmin || isDean) && (
          <button className="btn-primary shrink-0" onClick={openCreate}>
            <Plus size={16} /> Create interview
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <InterviewStat label="Total" value={interviews.length} />
        <InterviewStat label="Pending" value={upcoming.length} tone="amber" />
        <InterviewStat label="Done" value={done.length} tone="emerald" />
        <InterviewStat label="Deans" value={new Set(interviews.map((item) => item.dean_id).filter(Boolean)).size} tone="brand" />
      </div>

      {loading ? (
        <CardSkeleton />
      ) : interviews.length === 0 ? (
        <div className="card p-8">
          <EmptyState
            icon={CalendarCheck2}
            title="No interviews yet"
            description={isAdmin || isDean ? 'Create your first interview.' : 'No interviews have been created yet.'}
          />
        </div>
      ) : (
        <div className="space-y-7">
          <InterviewSection
            title="Pending"
            items={upcoming}
            profile={profile}
            onEdit={openEdit}
            onDone={handleDone}
            onDelete={handleDelete}
            deletingId={deletingId}
            emptyText="No pending interviews."
          />

          <InterviewSection
            title="Done"
            items={done}
            profile={profile}
            onEdit={openEdit}
            onDone={handleDone}
            onDelete={handleDelete}
            deletingId={deletingId}
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
          isAdmin={isAdmin}
          isDean={isDean}
          profileName={profile?.manager_name ?? ''}
          profileId={profile?.id ?? ''}
          responsibleClubs={responsibleClubs}
          allClubs={clubs}
          deans={deans}
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

function InterviewStat({
  label,
  value,
  tone = 'slate',
}: {
  label: string
  value: number
  tone?: 'slate' | 'amber' | 'emerald' | 'brand'
}) {
  const toneClasses = {
    slate: 'bg-white text-slate-900',
    amber: 'bg-amber-50 text-amber-800',
    emerald: 'bg-emerald-50 text-emerald-800',
    brand: 'bg-brand-50 text-brand-800',
  }

  return (
    <div className={`rounded-2xl border border-slate-200 px-4 py-3 shadow-soft ${toneClasses[tone]}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  )
}

interface InterviewFormState {
  dean_id: string
  club_id: string
  interview_date: string
  interview_time: string
  place: string
  poste: InterviewPoste
  department: InterviewDepartment
  coordinator_email: string
}

function InterviewForm({
  isAdmin,
  isDean,
  profileName,
  profileId,
  responsibleClubs,
  allClubs,
  deans,
  coordinators,
  interview,
  saving,
  onSubmit,
  onCancel,
}: {
  isAdmin: boolean
  isDean: boolean
  profileName: string
  profileId: string
  responsibleClubs: { id: string; name: string }[]
  allClubs: { id: string; name: string }[]
  deans: Profile[]
  coordinators: { email: string; username: string; field: CoordinatorField }[]
  interview: InterviewWithClub | null
  saving: boolean
  onSubmit: (input: InterviewFormState) => Promise<void>
  onCancel: () => void
}) {
  const availableClubs = isAdmin ? allClubs : responsibleClubs

  const initialDeanId = interview?.dean_id ?? (isDean ? profileId : '')
  const initialCoordinatorEmail = interview?.coordinator_emails?.[0] ?? ''

  const [form, setForm] = useState<InterviewFormState>(() => ({
    dean_id: initialDeanId,
    club_id: interview?.club_id ?? availableClubs[0]?.id ?? '',
    interview_date: interview?.interview_date ?? '',
    interview_time: interview?.interview_time?.slice(0, 5) ?? '',
    place: interview?.place ?? '',
    poste: interview?.poste ?? 'manager',
    department: interview?.department ?? 'event',
    coordinator_email: initialCoordinatorEmail,
  }))

  const requiredField = requiredCoordinatorField(
    form.poste,
    form.department,
  )

  const availableCoordinators = coordinators.filter(
    (coordinator) => coordinator.field === requiredField,
  )

  function set<K extends keyof InterviewFormState>(
    key: K,
    value: InterviewFormState[K],
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }))
  }

  function handleDean(value: string) {
    setForm((current) => ({
      ...current,
      dean_id: value,
    }))
  }

  function handlePoste(value: InterviewPoste) {
    const field = requiredCoordinatorField(
      value,
      form.department,
    )

    const available = coordinators.filter(
      (coordinator) => coordinator.field === field,
    )

    setForm((current) => ({
      ...current,
      poste: value,
      coordinator_email: available.some(
        (coordinator) =>
          coordinator.email === current.coordinator_email,
      )
        ? current.coordinator_email
        : '',
    }))
  }

  function handleDepartment(value: InterviewDepartment) {
    const field = requiredCoordinatorField(
      form.poste,
      value,
    )

    const available = coordinators.filter(
      (coordinator) => coordinator.field === field,
    )

    setForm((current) => ({
      ...current,
      department: value,
      coordinator_email: available.some(
        (coordinator) =>
          coordinator.email === current.coordinator_email,
      )
        ? current.coordinator_email
        : '',
    }))
  }

  async function submit(e: FormEvent) {
    e.preventDefault()

    if (
      !form.dean_id ||
      !form.club_id ||
      !form.interview_date ||
      !form.interview_time ||
      !form.place ||
      !form.coordinator_email
    ) {
      toast.error('Please complete all interview fields.')
      return
    }

    await onSubmit(form)
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label">Dean</label>

        {isAdmin ? (
          <select
            className="input"
            value={form.dean_id}
            onChange={(e) => handleDean(e.target.value)}
          >
            <option value="">Select a dean</option>
            {deans.map((dean) => (
              <option key={dean.id} value={dean.id}>
                {dean.manager_name}
              </option>
            ))}
          </select>
        ) : (
          <input
            className="input bg-slate-50"
            value={profileName}
            readOnly
          />
        )}
      </div>

      <div>
        <label className="label">Club</label>

        <select
          className="input"
          value={form.club_id}
          onChange={(e) => set('club_id', e.target.value)}
        >
          <option value="">Select a club</option>
          {availableClubs.map((club) => (
            <option key={club.id} value={club.id}>
              {club.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Date</label>
          <input
            className="input"
            type="date"
            value={form.interview_date}
            onChange={(e) =>
              set('interview_date', e.target.value)
            }
          />
        </div>

        <div>
          <label className="label">Time</label>
          <input
            className="input"
            type="time"
            value={form.interview_time}
            onChange={(e) =>
              set('interview_time', e.target.value)
            }
          />
        </div>
      </div>

      <div>
        <label className="label">Place</label>
        <input
          className="input"
          value={form.place}
          onChange={(e) => set('place', e.target.value)}
          placeholder="Meeting room / venue"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Poste</label>
          <select
            className="input"
            value={form.poste}
            onChange={(e) =>
              handlePoste(e.target.value as InterviewPoste)
            }
          >
            {POSTES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Department</label>
          <select
            className="input"
            value={form.department}
            onChange={(e) =>
              handleDepartment(
                e.target.value as InterviewDepartment,
              )
            }
          >
            {DEPARTMENTS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="label">Coordinator</label>
        <select
          className="input"
          value={form.coordinator_email}
          onChange={(e) =>
            set('coordinator_email', e.target.value)
          }
        >
          <option value="">Select a coordinator</option>
          {availableCoordinators.map((coordinator) => (
            <option
              key={coordinator.email}
              value={coordinator.email}
            >
              {coordinator.username} · {coordinator.field}
            </option>
          ))}
        </select>

        <p className="mt-1 text-xs text-slate-400">
          Required field:{' '}
          <strong>{requiredField}</strong>
        </p>

        {availableCoordinators.length === 0 && (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            No coordinator is configured for this field yet.
          </p>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          className="btn-secondary"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </button>

        <button
          type="submit"
          className="btn-primary"
          disabled={
            saving ||
            availableCoordinators.length === 0 ||
            (isAdmin && deans.length === 0)
          }
        >
          {saving
            ? 'Saving…'
            : interview
              ? 'Save changes'
              : 'Create interview'}
        </button>
      </div>
    </form>
  )
}

function InterviewSection({
  title,
  items,
  profile,
  onEdit,
  onDone,
  onDelete,
  deletingId,
  emptyText,
}: {
  title: string
  items: InterviewWithClub[]
  profile: ReturnType<typeof useAuth>['profile']
  onEdit: (item: InterviewWithClub) => void
  onDone: (item: InterviewWithClub) => void
  onDelete: (item: InterviewWithClub) => void
  deletingId: string | null
  emptyText: string
}) {
  const isAdmin = profile?.role === 'admin'

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        {title === 'Done' ? (
          <CheckCircle2
            size={17}
            className="text-emerald-500"
          />
        ) : (
          <Clock3
            size={17}
            className="text-amber-500"
          />
        )}
        <h2 className="text-sm font-bold text-slate-900">
          {title}
        </h2>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
          {items.length}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="card p-5 text-sm text-slate-400">
          {emptyText}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {items.map((interview) => {
            const color = getInterviewDeanColor(
              interview.dean_id,
            )

            const canManage = canManageInterview(
              profile,
              interview,
            )

            const deanName =
              interview.dean_name ?? 'Unknown dean'

            const coordinatorName =
              interview.coordinator_name ??
              interview.coordinator_emails?.[0] ??
              'Unknown coordinator'

            const isDeleting =
              deletingId === interview.id

            return (
              <article
                key={interview.id}
                className={`group overflow-hidden rounded-2xl border border-slate-200 border-l-4 ${color.border} bg-white shadow-soft transition duration-200 hover:-translate-y-0.5 hover:shadow-card`}
              >
                <div className={`border-b border-slate-100 ${color.softBackground} px-5 py-4`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-bold ring-4 ${color.avatar} ${color.ring}`}>
                          {getInitials(deanName)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-bold text-slate-900">
                              {interview.club?.name ?? 'Unknown club'}
                            </p>
                            {interview.dean_id === profile?.id && (
                              <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-700 ring-1 ring-inset ring-brand-200">
                                Your interview
                              </span>
                            )}
                          </div>
                          <p className={`mt-1 text-xs font-semibold ${color.text}`}>
                            {deanName}
                          </p>
                        </div>
                      </div>
                    </div>

                    <span className={`badge shrink-0 ${interview.status === 'done' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                      {interview.status === 'done' ? 'Done' : 'Pending'}
                    </span>
                  </div>
                </div>

                <div className="space-y-4 p-5">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <InfoRow
                      icon={<CalendarCheck2 size={15} />}
                      label="Date"
                      value={new Date(
                        `${interview.interview_date}T00:00:00`,
                      ).toLocaleDateString('fr-FR')}
                    />
                    <InfoRow
                      icon={<Clock3 size={15} />}
                      label="Time"
                      value={interview.interview_time.slice(0, 5)}
                    />
                    <InfoRow
                      icon={<MapPin size={15} />}
                      label="Place"
                      value={interview.place}
                    />
                    <InfoRow
                      icon={<UsersRound size={15} />}
                      label="Coordinator"
                      value={coordinatorName}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Poste
                      </p>
                      <p className="mt-1 text-sm font-semibold capitalize text-slate-700">
                        {interview.poste.replace('_', ' ')}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Department
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-700">
                        {interview.department}
                      </p>
                    </div>
                  </div>

                  {(canManage || isAdmin) && (
                    <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
                      {canManage && (
                        <button
                          className="btn-secondary text-xs"
                          onClick={() => onEdit(interview)}
                          disabled={isDeleting}
                        >
                          <Pencil size={14} /> Edit
                        </button>
                      )}

                      {canManage && interview.status !== 'done' && (
                        <button
                          className="btn-primary text-xs"
                          onClick={() => onDone(interview)}
                          disabled={isDeleting}
                        >
                          <CheckCircle2 size={14} /> Mark done
                        </button>
                      )}

                      {isAdmin && (
                        <button
                          className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                          onClick={() => onDelete(interview)}
                          disabled={isDeleting}
                        >
                          <Trash2 size={14} />
                          {isDeleting ? 'Deleting…' : 'Delete'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 rounded-xl bg-slate-50 px-3 py-2.5">
      <span className="shrink-0 text-slate-400">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          {label}
        </p>
        <p className="truncate text-sm font-medium text-slate-700">
          {value}
        </p>
      </div>
    </div>
  )
}

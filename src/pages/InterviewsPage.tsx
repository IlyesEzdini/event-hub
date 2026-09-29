import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import toast from 'react-hot-toast'
import {
  CalendarCheck2,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Filter,
  MapPin,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useClubs } from '@/hooks/useClubs'
import { useCoordinators } from '@/hooks/useCoordinators'
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
import { supabase } from '@/lib/supabase'
import { getInitials, getInterviewDeanColor } from '@/utils/interviewColors'
import type {
  CoordinatorField,
  InterviewDepartment,
  InterviewPoste,
  InterviewStatus,
  InterviewWithClub,
  Profile,
} from '@/types/database'

const POSTES: { value: InterviewPoste; label: string }[] = [
  { value: 'manager', label: 'Manager' },
  { value: 'assistant', label: 'Assistant' },
  { value: 'vice_president', label: 'Vice-president' },
  { value: 'president', label: 'President' },
  { value: 'general_secretary', label: 'General Secretary' },
]

const DEPARTMENTS: { value: InterviewDepartment; label: string }[] = [
  { value: 'event', label: 'Event' },
  { value: 'COM', label: 'COM' },
  { value: 'RH', label: 'RH' },
  { value: 'partenariat', label: 'Partenariat' },
  { value: 'PAP', label: 'PAP' },
  { value: 'partenariat', label: 'Treasury' },
  { value: 'executive_bureau', label: 'Executive Bureau' },
]

const DATE_PRESETS = [
  { value: 'all', label: 'All dates' },
  { value: 'today', label: 'Today' },
  { value: 'tomorrow', label: 'Tomorrow' },
  { value: 'this_week', label: 'This week' },
  { value: 'next_week', label: 'Next week' },
  { value: 'this_month', label: 'This month' },
  { value: 'custom', label: 'Custom range' },
] as const

type DatePreset = (typeof DATE_PRESETS)[number]['value']
type ViewMode = 'all' | 'mine'
type StatusFilter = 'all' | InterviewStatus

function requiredCoordinatorField(
  poste: InterviewPoste,
  department: InterviewDepartment,
): CoordinatorField {
  if (poste === 'president' || poste === 'vice_president' || poste === 'general_secretary') return 'regional'
  if (department === 'executive_bureau') return 'regional'
  return department
}

function isExecutivePoste(poste: InterviewPoste) {
  return (
    poste === 'president' ||
    poste === 'vice_president' ||
    poste === 'general_secretary'
  )
}

function getPosteLabel(poste: InterviewPoste) {
  return POSTES.find((item) => item.value === poste)?.label ?? poste.replace('_', ' ')
}

function getDepartmentLabel(department: InterviewDepartment) {
  return DEPARTMENTS.find((item) => item.value === department)?.label ?? department
}

function canManageInterview(
  profile: ReturnType<typeof useAuth>['profile'],
  interview: InterviewWithClub,
) {
  if (!profile) return false
  if (profile.role === 'admin') return true
  return profile.role === 'dean' && profile.id === interview.dean_id
}

function toDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function startOfLocalWeek(date: Date) {
  const result = new Date(date)
  const day = result.getDay()
  const diff = day === 0 ? -6 : 1 - day
  result.setDate(result.getDate() + diff)
  result.setHours(0, 0, 0, 0)
  return result
}

function endOfLocalWeek(date: Date) {
  const result = startOfLocalWeek(date)
  result.setDate(result.getDate() + 6)
  return result
}

function getDateRange(preset: DatePreset): { from?: string; to?: string } {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (preset === 'all' || preset === 'custom') return {}

  if (preset === 'today') {
    const key = toDateKey(today)
    return { from: key, to: key }
  }

  if (preset === 'tomorrow') {
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const key = toDateKey(tomorrow)
    return { from: key, to: key }
  }

  if (preset === 'this_week') {
    return {
      from: toDateKey(startOfLocalWeek(today)),
      to: toDateKey(endOfLocalWeek(today)),
    }
  }

  if (preset === 'next_week') {
    const nextWeekStart = startOfLocalWeek(today)
    nextWeekStart.setDate(nextWeekStart.getDate() + 7)
    const nextWeekEnd = new Date(nextWeekStart)
    nextWeekEnd.setDate(nextWeekEnd.getDate() + 6)
    return {
      from: toDateKey(nextWeekStart),
      to: toDateKey(nextWeekEnd),
    }
  }

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)
  return {
    from: toDateKey(monthStart),
    to: toDateKey(monthEnd),
  }
}

function formatInterviewDate(value: string) {
  if (!value) return 'No date selected'

  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return 'Invalid date'

  return date.toLocaleDateString('fr-FR')
}

/**
 * Database values are typed as text[], but this extra normalization keeps the
 * UI safe if an older row contains null/empty/non-string values. A malformed
 * coordinator value should never be able to crash the whole Interviews page.
 */
function getCoordinatorEmails(interview: InterviewWithClub): string[] {
  if (!Array.isArray(interview.coordinator_emails)) return []

  return interview.coordinator_emails.filter(
    (email): email is string => typeof email === 'string' && email.trim().length > 0,
  )
}

function interviewHasCoordinator(
  interview: InterviewWithClub,
  coordinatorEmail: string,
) {
  const target = coordinatorEmail.trim().toLowerCase()
  if (!target) return false

  return getCoordinatorEmails(interview).some(
    (email) => email.trim().toLowerCase() === target,
  )
}

function safeInterviewTime(value: unknown) {
  return typeof value === 'string' ? value.slice(0, 5) : ''
}

export default function InterviewsPage() {
  const { profile } = useAuth()
  const { clubs } = useClubs()
  const { coordinators } = useCoordinators()
  const { interviews, loading, reload } = useInterviews()

  const [deanProfiles, setDeanProfiles] = useState<Profile[]>([])
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<InterviewWithClub | null>(null)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [viewMode, setViewMode] = useState<ViewMode>('all')
  const [search, setSearch] = useState('')
  const [datePreset, setDatePreset] = useState<DatePreset>('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [department, setDepartment] = useState<InterviewDepartment | 'all'>('all')
  const [poste, setPoste] = useState<InterviewPoste | 'all'>('all')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [deanId, setDeanId] = useState('all')
  const [coordinatorEmail, setCoordinatorEmail] = useState('all')
  const [showFilters, setShowFilters] = useState(false)
  const [availabilityOpen, setAvailabilityOpen] = useState(false)
  const [availabilityCoordinator, setAvailabilityCoordinator] = useState('')
  const [availabilityDate, setAvailabilityDate] = useState(toDateKey(new Date()))

  const isAdmin = profile?.role === 'admin'
  const isDean = profile?.role === 'dean'

  useEffect(() => {
    async function loadDeanProfiles() {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'dean')
        .order('manager_name', { ascending: true })

      if (error) {
        console.error('Failed to load dean profiles:', error)
        return
      }

      setDeanProfiles((data ?? []) as Profile[])
    }

    loadDeanProfiles()
  }, [])

  const responsibleNames = useMemo(() => {
    if (!profile) return []
    return profile.responsible_clubs?.length ? profile.responsible_clubs : profile.clubs ?? []
  }, [profile])

  const responsibleClubs = useMemo(
    () => clubs.filter((club) => responsibleNames.includes(club.name)),
    [clubs, responsibleNames],
  )

  const dateRange = useMemo(() => {
    if (datePreset === 'custom') {
      return { from: customFrom || undefined, to: customTo || undefined }
    }
    return getDateRange(datePreset)
  }, [datePreset, customFrom, customTo])

  const filteredInterviews = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return interviews.filter((interview) => {
      if (viewMode === 'mine' && interview.dean_id !== profile?.id) return false
      if (status !== 'all' && interview.status !== status) return false
      if (department !== 'all' && interview.department !== department) return false
      if (poste !== 'all' && interview.poste !== poste) return false
      if (deanId !== 'all' && interview.dean_id !== deanId) return false
      if (
        coordinatorEmail !== 'all' &&
        !interviewHasCoordinator(interview, coordinatorEmail)
      ) {
        return false
      }

      if (dateRange.from && interview.interview_date < dateRange.from) return false
      if (dateRange.to && interview.interview_date > dateRange.to) return false

      if (normalizedSearch) {
        const haystack = [
          interview.club?.name,
          interview.dean_name,
          interview.coordinator_name,
          ...(interview.coordinator_emails ?? []),
          interview.place,
          interview.department,
          interview.poste,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()

        if (!haystack.includes(normalizedSearch)) return false
      }

      return true
    })
  }, [
    interviews,
    viewMode,
    profile?.id,
    status,
    department,
    poste,
    deanId,
    coordinatorEmail,
    dateRange.from,
    dateRange.to,
    search,
  ])

  const pending = filteredInterviews.filter((item) => item.status === 'pending')
  const done = filteredInterviews.filter((item) => item.status === 'done')

  const activeFilterCount = [
    search.trim(),
    datePreset !== 'all',
    department !== 'all',
    poste !== 'all',
    status !== 'all',
    deanId !== 'all',
    coordinatorEmail !== 'all',
    viewMode === 'mine',
  ].filter(Boolean).length

  const availabilityInterviews = useMemo(() => {
    if (!availabilityCoordinator || !availabilityDate) return []

    return interviews
      .filter(
        (interview) =>
          interview.interview_date === availabilityDate &&
          interview.status === 'pending' &&
          interviewHasCoordinator(interview, availabilityCoordinator),
      )
      .sort((a, b) =>
        safeInterviewTime(a.interview_time).localeCompare(
          safeInterviewTime(b.interview_time),
        ),
      )
  }, [interviews, availabilityCoordinator, availabilityDate])

  const availabilitySlots = useMemo(() => {
    const slots: { time: string; interview: InterviewWithClub | null }[] = []
    for (let hour = 8; hour <= 20; hour += 1) {
      const time = `${String(hour).padStart(2, '0')}:00`
      const interview = availabilityInterviews.find(
        (item) => safeInterviewTime(item.interview_time) === time,
      ) ?? null
      slots.push({ time, interview })
    }
    return slots
  }, [availabilityInterviews])

  function resetFilters() {
    setSearch('')
    setDatePreset('all')
    setCustomFrom('')
    setCustomTo('')
    setDepartment('all')
    setPoste('all')
    setStatus('all')
    setDeanId('all')
    setCoordinatorEmail('all')
    setViewMode('all')
  }

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
        await updateInterview(editing.id, {
          dean_id: input.dean_id,
          club_id: input.club_id,
          interview_date: input.interview_date,
          interview_time: input.interview_time,
          place: input.place,
          poste: input.poste,
          department: input.department,
          coordinator_emails: [input.coordinator_email],
        })
        toast.success('Interview updated.')
      } else {
        if (!input.dean_id) throw new Error('Please select a dean.')

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
      toast.error(error instanceof Error ? error.message : 'Unable to save the interview.')
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
      toast.error(error instanceof Error ? error.message : 'Unable to update the interview.')
    }
  }

async function handleDelete(interview: InterviewWithClub) {
  if (!canManageInterview(profile, interview)) {
    toast.error('You can only delete your own interviews.')
    return
  }

  const confirmed = window.confirm(
    `Delete the interview with ${interview.dean_name ?? 'this dean'}?`,
  )

  if (!confirmed) return

  setDeletingId(interview.id)

  try {
    await deleteInterview(interview.id)

    toast.success('Interview deleted.')

    await reload()
  } catch (error) {
    console.error('Failed to delete interview:', error)

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
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <CalendarCheck2 size={21} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Interviews</h1>
            <p className="text-sm text-slate-500">
              Search, filter and manage interviews from one place.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isDean && (
            <div className="flex rounded-xl border border-slate-200 bg-white p-1 shadow-soft">
              <button
                type="button"
                onClick={() => setViewMode('all')}
                className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                  viewMode === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                All interviews
              </button>
              <button
                type="button"
                onClick={() => setViewMode('mine')}
                className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                  viewMode === 'mine'
                    ? 'bg-brand-600 text-white'
                    : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                My interviews
              </button>
            </div>
          )}

          {(isAdmin || isDean) && (
            <button className="btn-primary" onClick={openCreate}>
              <Plus size={16} /> Create interview
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <InterviewStat label="Showing" value={filteredInterviews.length} />
        <InterviewStat label="Pending" value={pending.length} tone="amber" />
        <InterviewStat label="Done" value={done.length} tone="emerald" />
        <InterviewStat
          label={viewMode === 'mine' ? 'My interviews' : 'Total'}
          value={viewMode === 'mine' ? filteredInterviews.length : interviews.length}
          tone="brand"
        />
      </div>

      <section className="card overflow-visible p-4 sm:p-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="relative min-w-0 flex-1">
            <Search
              size={17}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              className="input pl-10 pr-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by dean, coordinator, club, place, department..."
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowFilters((value) => !value)}
            className="btn-secondary shrink-0"
          >
            <Filter size={16} />
            Filters
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
            <ChevronDown
              size={15}
              className={`transition ${showFilters ? 'rotate-180' : ''}`}
            />
          </button>

          <button
            type="button"
            onClick={() => {
              setAvailabilityCoordinator(
                coordinatorEmail !== 'all' ? coordinatorEmail : coordinators[0]?.email ?? '',
              )
              setAvailabilityDate(dateRange.from ?? toDateKey(new Date()))
              setAvailabilityOpen(true)
            }}
            className="btn-secondary shrink-0"
          >
            <Clock3 size={16} /> Availability
          </button>
        </div>

        {showFilters && (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <FilterField label="Date">
                <select
                  className="input"
                  value={datePreset}
                  onChange={(e) => setDatePreset(e.target.value as DatePreset)}
                >
                  {DATE_PRESETS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </FilterField>

              <FilterField label="Department">
                <select
                  className="input"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value as InterviewDepartment | 'all')}
                >
                  <option value="all">All departments</option>
                  {DEPARTMENTS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </FilterField>

              <FilterField label="Poste">
                <select
                  className="input"
                  value={poste}
                  onChange={(e) => setPoste(e.target.value as InterviewPoste | 'all')}
                >
                  <option value="all">All postes</option>
                  {POSTES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </FilterField>

              <FilterField label="Status">
                <select
                  className="input"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as StatusFilter)}
                >
                  <option value="all">All statuses</option>
                  <option value="pending">Pending</option>
                  <option value="done">Done</option>
                </select>
              </FilterField>

              <FilterField label="Dean">
                <select
                  className="input"
                  value={deanId}
                  onChange={(e) => setDeanId(e.target.value)}
                >
                  <option value="all">All deans</option>
                  {deanProfiles.map((dean) => (
                    <option key={dean.id} value={dean.id}>
                      {dean.manager_name}
                    </option>
                  ))}
                </select>
              </FilterField>

              <FilterField label="Coordinator">
                <select
                  className="input"
                  value={coordinatorEmail}
                  onChange={(e) => setCoordinatorEmail(e.target.value)}
                >
                  <option value="all">All coordinators</option>
                  {coordinators.map((coordinator) => (
                    <option key={coordinator.email} value={coordinator.email}>
                      {coordinator.username}
                    </option>
                  ))}
                </select>
              </FilterField>

              {datePreset === 'custom' && (
                <FilterField label="From">
                  <input
                    className="input"
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                  />
                </FilterField>
              )}

              {datePreset === 'custom' && (
                <FilterField label="To">
                  <input
                    className="input"
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                  />
                </FilterField>
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-slate-400">
                Showing <strong className="text-slate-600">{filteredInterviews.length}</strong> of{' '}
                <strong className="text-slate-600">{interviews.length}</strong> interviews.
              </p>
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-brand-600"
              >
                <RotateCcw size={13} /> Clear filters
              </button>
            </div>
          </div>
        )}

        {activeFilterCount > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {viewMode === 'mine' && <FilterChip label="My interviews" onRemove={() => setViewMode('all')} />}
            {search && <FilterChip label={`Search: ${search}`} onRemove={() => setSearch('')} />}
            {datePreset !== 'all' && (
              <FilterChip label={`Date: ${DATE_PRESETS.find((item) => item.value === datePreset)?.label ?? datePreset}`} onRemove={() => setDatePreset('all')} />
            )}
            {department !== 'all' && <FilterChip label={`Department: ${getDepartmentLabel(department)}`} onRemove={() => setDepartment('all')} />}
            {poste !== 'all' && <FilterChip label={`Poste: ${getPosteLabel(poste)}`} onRemove={() => setPoste('all')} />}
            {status !== 'all' && <FilterChip label={`Status: ${status}`} onRemove={() => setStatus('all')} />}
            {deanId !== 'all' && <FilterChip label={`Dean: ${deanProfiles.find((item) => item.id === deanId)?.manager_name ?? deanId}`} onRemove={() => setDeanId('all')} />}
            {coordinatorEmail !== 'all' && <FilterChip label={`Coordinator: ${coordinators.find((item) => item.email === coordinatorEmail)?.username ?? coordinatorEmail}`} onRemove={() => setCoordinatorEmail('all')} />}
          </div>
        )}
      </section>

      {loading ? (
        <CardSkeleton />
      ) : filteredInterviews.length === 0 ? (
        <div className="card p-8">
          <EmptyState
            icon={CalendarCheck2}
            title="No matching interviews"
            description="Try changing your filters or clear them to see all interviews."
          />
        </div>
      ) : (
        <div className="space-y-7">
          <InterviewSection
            title="Pending"
            items={pending}
            profile={profile}
            onEdit={openEdit}
            onDone={handleDone}
            onDelete={handleDelete}
            deletingId={deletingId}
            emptyText="No pending interviews match your filters."
          />

          <InterviewSection
            title="Done"
            items={done}
            profile={profile}
            onEdit={openEdit}
            onDone={handleDone}
            onDelete={handleDelete}
            deletingId={deletingId}
            emptyText="No completed interviews match your filters."
          />
        </div>
      )}

      <Modal
        open={availabilityOpen}
        onClose={() => setAvailabilityOpen(false)}
        title="Coordinator availability"
        maxWidth="max-w-3xl"
      >
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FilterField label="Coordinator">
              <select
                className="input"
                value={availabilityCoordinator}
                onChange={(e) => setAvailabilityCoordinator(e.target.value)}
              >
                <option value="">Select a coordinator</option>
                {coordinators.map((coordinator) => (
                  <option key={coordinator.email} value={coordinator.email}>
                    {coordinator.username} · {coordinator.field}
                  </option>
                ))}
              </select>
            </FilterField>

            <FilterField label="Date">
              <input
                className="input"
                type="date"
                value={availabilityDate}
                onChange={(e) => setAvailabilityDate(e.target.value || '')}
              />
            </FilterField>
          </div>

          {!availabilityCoordinator ? (
            <div className="rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-500">
              Select a coordinator to see their schedule.
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3">
                <div>
                  <p className="text-sm font-bold text-slate-900">
                    {coordinators.find((item) => item.email === availabilityCoordinator)?.username ?? availabilityCoordinator}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatInterviewDate(availabilityDate)} · {availabilityInterviews.length} scheduled interview(s)
                  </p>
                </div>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                  {availabilitySlots.filter((slot) => !slot.interview).length} free slots
                </span>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {availabilitySlots.map((slot) => (
                  <div
                    key={slot.time}
                    className={`rounded-xl border px-4 py-3 ${
                      slot.interview
                        ? 'border-amber-200 bg-amber-50'
                        : 'border-emerald-200 bg-emerald-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-bold text-slate-800">
                        {slot.time}
                      </span>
                      {slot.interview ? (
                        <span className="text-[10px] font-bold uppercase tracking-wide text-amber-700">
                          Busy
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                          Available
                        </span>
                      )}
                    </div>
                    {slot.interview && (
                      <p className="mt-1 truncate text-xs text-slate-600">
                        {slot.interview.club?.name ?? 'Interview'} · {slot.interview.dean_name ?? 'Dean'}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              <p className="text-[11px] text-slate-400">
                Availability is shown in one-hour slots from 08:00 to 20:00. A slot is busy when an interview starts at that time.
              </p>
            </div>
          )}
        </div>
      </Modal>

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
          deans={deanProfiles}
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

function FilterField({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  )
}

function FilterChip({
  label,
  onRemove,
}: {
  label: string
  onRemove: () => void
}) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1.5 text-[11px] font-semibold text-brand-700 ring-1 ring-inset ring-brand-100"
    >
      {label}
      <X size={12} />
    </button>
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
  const initialPoste = interview?.poste ?? 'manager'
  const initialDepartment = isExecutivePoste(initialPoste)
    ? 'executive_bureau'
    : (interview?.department ?? 'event')
  const initialCoordinatorEmail = interview?.coordinator_emails?.[0] ?? ''

  const [form, setForm] = useState<InterviewFormState>(() => ({
    dean_id: initialDeanId,
    club_id: interview?.club_id ?? availableClubs[0]?.id ?? '',
    interview_date: interview?.interview_date ?? '',
    interview_time: interview?.interview_time?.slice(0, 5) ?? '',
    place: interview?.place ?? '',
    poste: initialPoste,
    department: initialDepartment,
    coordinator_email: initialCoordinatorEmail,
  }))

  const departmentOptions: { value: InterviewDepartment; label: string }[] = isExecutivePoste(form.poste)
    ? DEPARTMENTS.filter((item) => item.value === 'executive_bureau')
    : DEPARTMENTS.filter((item) => item.value !== 'executive_bureau')

  const requiredField = requiredCoordinatorField(form.poste, form.department)
  const availableCoordinators = coordinators.filter(
    (coordinator) => coordinator.field === requiredField,
  )

  function set<K extends keyof InterviewFormState>(key: K, value: InterviewFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function handleDean(value: string) {
    setForm((current) => ({ ...current, dean_id: value }))
  }

  function handlePoste(value: InterviewPoste) {
    const nextDepartment = isExecutivePoste(value)
      ? 'executive_bureau'
      : form.department === 'executive_bureau'
        ? 'event'
        : form.department

    const field = requiredCoordinatorField(value, nextDepartment)
    const available = coordinators.filter((coordinator) => coordinator.field === field)

    setForm((current) => ({
      ...current,
      poste: value,
      department: nextDepartment,
      coordinator_email: available.some(
        (coordinator) => coordinator.email === current.coordinator_email,
      )
        ? current.coordinator_email
        : '',
    }))
  }

  function handleDepartment(value: InterviewDepartment) {
    if (isExecutivePoste(form.poste)) {
      return
    }

    const field = requiredCoordinatorField(form.poste, value)
    const available = coordinators.filter((coordinator) => coordinator.field === field)
    setForm((current) => ({
      ...current,
      department: value,
      coordinator_email: available.some(
        (coordinator) => coordinator.email === current.coordinator_email,
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
          <select className="input" value={form.dean_id} onChange={(e) => handleDean(e.target.value)}>
            <option value="">Select a dean</option>
            {deans.map((dean) => (
              <option key={dean.id} value={dean.id}>
                {dean.manager_name}
              </option>
            ))}
          </select>
        ) : (
          <input className="input bg-slate-50" value={profileName} readOnly />
        )}
      </div>

      <div>
        <label className="label">Club</label>
        <select className="input" value={form.club_id} onChange={(e) => set('club_id', e.target.value)}>
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
            onChange={(e) => set('interview_date', e.target.value)}
          />
        </div>
        <div>
          <label className="label">Time</label>
          <input
            className="input"
            type="time"
            value={form.interview_time}
            onChange={(e) => set('interview_time', e.target.value)}
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
          <select className="input" value={form.poste} onChange={(e) => handlePoste(e.target.value as InterviewPoste)}>
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
            disabled={isExecutivePoste(form.poste)}
            onChange={(e) => handleDepartment(e.target.value as InterviewDepartment)}
          >
            {departmentOptions.map((item) => (
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
          onChange={(e) => set('coordinator_email', e.target.value)}
        >
          <option value="">Select a coordinator</option>
          {availableCoordinators.map((coordinator) => (
            <option key={coordinator.email} value={coordinator.email}>
              {coordinator.username} · {coordinator.field}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-slate-400">
          {isExecutivePoste(form.poste) ? (
            <>Executive posts use the <strong>regional</strong> coordinator.</>
          ) : (
            <>Required field: <strong>{requiredField}</strong>. Treasury is available for Manager and Assistant posts.</>
          )}
        </p>
        {availableCoordinators.length === 0 && (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            No coordinator is configured for this field yet.
          </p>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button
          type="submit"
          className="btn-primary"
          disabled={saving || availableCoordinators.length === 0 || (isAdmin && deans.length === 0)}
        >
          {saving ? 'Saving…' : interview ? 'Save changes' : 'Create interview'}
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
          <CheckCircle2 size={17} className="text-emerald-500" />
        ) : (
          <Clock3 size={17} className="text-amber-500" />
        )}
        <h2 className="text-sm font-bold text-slate-900">{title}</h2>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
          {items.length}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="card p-5 text-sm text-slate-400">{emptyText}</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {items.map((interview) => {
            const color = getInterviewDeanColor(interview.dean_id)
            const canManage = canManageInterview(profile, interview)
            const deanName = interview.dean_name ?? 'Unknown dean'
            const coordinatorName =
              interview.coordinator_name ?? interview.coordinator_emails?.[0] ?? 'Unknown coordinator'
            const isDeleting = deletingId === interview.id

            return (
              <article
                key={interview.id}
                className={`group overflow-hidden rounded-2xl border border-slate-200 border-l-4 ${color.border} bg-white shadow-soft transition duration-200 hover:-translate-y-0.5 hover:shadow-card`}
              >
                <div className={`border-b border-slate-100 ${color.softBackground} px-5 py-4`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
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
                        <p className={`mt-1 flex items-center gap-1.5 text-xs font-semibold ${color.text}`}>
                          <UserRound size={13} /> {deanName}
                        </p>
                      </div>
                    </div>

                    <span className={`badge shrink-0 ${interview.status === 'done' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                      {interview.status === 'done' ? 'Done' : 'Pending'}
                    </span>
                  </div>
                </div>

                <div className="space-y-4 p-5">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <InfoRow icon={<CalendarCheck2 size={15} />} label="Date" value={formatInterviewDate(interview.interview_date)} />
                    <InfoRow icon={<Clock3 size={15} />} label="Time" value={safeInterviewTime(interview.interview_time)} />
                    <InfoRow icon={<MapPin size={15} />} label="Place" value={interview.place} />
                    <InfoRow icon={<UsersRound size={15} />} label="Coordinator" value={coordinatorName} />
                  </div>

                  <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Poste</p>
                      <p className="mt-1 text-sm font-semibold capitalize text-slate-700">{getPosteLabel(interview.poste)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Department</p>
                      <p className="mt-1 text-sm font-semibold text-slate-700">{getDepartmentLabel(interview.department)}</p>
                    </div>
                  </div>

                  {(canManage || isAdmin) && (
                    <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
                      {canManage && (
                        <button className="btn-secondary text-xs" onClick={() => onEdit(interview)} disabled={isDeleting}>
                          <Pencil size={14} /> Edit
                        </button>
                      )}
                      {canManage && interview.status !== 'done' && (
                        <button className="btn-primary text-xs" onClick={() => onDone(interview)} disabled={isDeleting}>
                          <CheckCircle2 size={14} /> Mark done
                        </button>
                      )}
                      {canManage && (
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
      <span className="shrink-0 text-slate-400">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
        <p className="truncate text-sm font-medium text-slate-700">{value}</p>
      </div>
    </div>
  )
}

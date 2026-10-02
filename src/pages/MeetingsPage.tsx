import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import toast from 'react-hot-toast'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Check,
  CheckCircle2,
  Clock3,
  ExternalLink,
  MapPin,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserRound,
  Users,
  Mail,
  ShieldCheck,
  Video,
} from 'lucide-react'
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { useAuth } from '@/contexts/AuthContext'
import { useClubs } from '@/hooks/useClubs'
import { useMeetings } from '@/hooks/useMeetings'
import { listManagers } from '@/services/managers'
import { listAssistants } from '@/services/assistants'
import { createMeeting, deleteMeeting, markMeetingDone, updateMeeting } from '@/services/meetings'
import { previewRegionalMeetingEmail, sendRegionalMeetingEmail, type RegionalMeetingEmailPreview } from '@/services/regionalMeetingEmail'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { CardSkeleton } from '@/components/ui/Skeleton'
import type { Club, Meeting, MeetingInput, ProfileWithClub } from '@/types/database'

const DAY_START = 8 * 60
const DAY_END = 20 * 60
const HOUR_HEIGHT = 60
const REGIONAL_COORDINATOR_COLOR = {
  border: 'border-l-red-500',
  bg: 'bg-red-50',
  text: 'text-red-950',
  accent: 'text-red-600',
  dot: 'bg-red-500',
}
const COORDINATOR_COLOR = {
  border: 'border-l-cyan-500',
  bg: 'bg-cyan-50',
  text: 'text-cyan-900',
  accent: 'text-cyan-600',
  dot: 'bg-cyan-500',
}
const DEAN_COLORS = [
  { border: 'border-l-violet-500', bg: 'bg-violet-50', text: 'text-violet-950', accent: 'text-violet-600', dot: 'bg-violet-500' },
  { border: 'border-l-blue-500', bg: 'bg-blue-50', text: 'text-blue-950', accent: 'text-blue-600', dot: 'bg-blue-500' },
  { border: 'border-l-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-950', accent: 'text-emerald-600', dot: 'bg-emerald-500' },
  { border: 'border-l-amber-500', bg: 'bg-amber-50', text: 'text-amber-950', accent: 'text-amber-600', dot: 'bg-amber-500' },
  { border: 'border-l-rose-500', bg: 'bg-rose-50', text: 'text-rose-950', accent: 'text-rose-600', dot: 'bg-rose-500' },
  { border: 'border-l-fuchsia-500', bg: 'bg-fuchsia-50', text: 'text-fuchsia-950', accent: 'text-fuchsia-600', dot: 'bg-fuchsia-500' },
]

type MeetingColor = typeof COORDINATOR_COLOR

function hashString(value: string) {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) | 0
  return Math.abs(hash)
}

function creatorColor(meeting: Meeting): MeetingColor {
  if (meeting.created_by_coordinator_email) {
    if (meeting.created_by_coordinator_field === 'regional') return REGIONAL_COORDINATOR_COLOR
    return COORDINATOR_COLOR
  }
  return DEAN_COLORS[hashString(meeting.username) % DEAN_COLORS.length]
}

function timeToMinutes(time: string) {
  const [hours, minutes] = time.slice(0, 5).split(':').map(Number)
  return hours * 60 + minutes
}

function formatTime(time: string) {
  return time.slice(0, 5)
}

function formatRange(meeting: Meeting) {
  return `${formatTime(meeting.start_time)} – ${formatTime(meeting.end_time)}`
}

function getMeetingTitle(meeting: Meeting) {
  const firstLine = meeting.description.trim().split(/\r?\n/)[0]?.trim()
  return firstLine || 'Meeting'
}

function getCreatorRole(meeting: Meeting) {
  return meeting.created_by_coordinator_email ? 'Coordinator' : 'Dean'
}

function canManageMeeting(profile: ReturnType<typeof useAuth>['profile'], meeting: Meeting) {
  if (!profile) return false
  if (profile.role === 'admin') return true
  if (profile.role === 'dean') return meeting.created_by_profile_id === profile.id
  if (profile.role === 'coordinator') {
    return meeting.created_by_coordinator_email?.toLowerCase() === profile.email?.toLowerCase()
  }
  return false
}

function getResponsibleClubNames(profile: ReturnType<typeof useAuth>['profile']) {
  if (!profile) return []
  return profile.clubs?.length ? profile.clubs : profile.responsible_clubs ?? []
}

export default function MeetingsPage() {
  const { profile } = useAuth()
  const { clubs, loading: clubsLoading } = useClubs()
  const { meetings, loading, error, reload } = useMeetings()
  const [weekDate, setWeekDate] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState(new Date())
  const [monthDate, setMonthDate] = useState(new Date())
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Meeting | null>(null)
  const [viewing, setViewing] = useState<Meeting | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Meeting | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [staffLoading, setStaffLoading] = useState(false)
  const [managers, setManagers] = useState<ProfileWithClub[]>([])
  const [assistants, setAssistants] = useState<ProfileWithClub[]>([])
  const [regionalPreview, setRegionalPreview] = useState<RegionalMeetingEmailPreview | null>(null)
  const [pendingRegionalMeeting, setPendingRegionalMeeting] = useState<MeetingInput | null>(null)
  const [regionalConfirm, setRegionalConfirm] = useState(false)
  const [sendingRegionalEmail, setSendingRegionalEmail] = useState(false)

  const isEventCoordinator = profile?.role === 'coordinator' && profile.field?.toLowerCase() === 'event'
  const isRegionalCoordinator = profile?.role === 'coordinator' && profile.field?.toLowerCase() === 'regional'
  const isAuthorized = profile?.role === 'admin' || profile?.role === 'dean' || profile?.role === 'coordinator'

  useEffect(() => {
    if (!isEventCoordinator) return
    let cancelled = false
    setStaffLoading(true)
    Promise.all([listManagers(), listAssistants()])
      .then(([managerRows, assistantRows]) => {
        if (cancelled) return
        setManagers(managerRows)
        setAssistants(assistantRows)
      })
      .catch((e) => {
        if (!cancelled) toast.error(e instanceof Error ? e.message : 'Unable to load club staff.')
      })
      .finally(() => {
        if (!cancelled) setStaffLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [isEventCoordinator])

  const responsibleNames = useMemo(() => getResponsibleClubNames(profile), [profile])
  const selectableClubs = useMemo(() => {
    if (profile?.role === 'dean') {
      return clubs.filter((club) => responsibleNames.includes(club.name))
    }
    return clubs
  }, [clubs, profile?.role, responsibleNames])

  const weekStart = startOfWeek(weekDate, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(weekDate, { weekStartsOn: 1 })
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd })

  const filteredMeetings = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return meetings
    return meetings.filter((meeting) => {
      const clubNames = (meeting.club_ids ?? [])
        .map((id: any) => clubs.find((club) => club.id === id)?.name ?? '')
        .join(' ')
      return [
        meeting.username,
        meeting.description,
        meeting.place ?? '',
        meeting.created_by_coordinator_email ?? '',
        clubNames,
      ].some((value) => value.toLowerCase().includes(query))
    })
  }, [clubs, meetings, search])

  const weekMeetings = useMemo(
    () => filteredMeetings.filter((meeting) => {
      const date = new Date(`${meeting.meeting_date}T12:00:00`)
      return date >= new Date(`${format(weekStart, 'yyyy-MM-dd')}T00:00:00`) && date <= new Date(`${format(weekEnd, 'yyyy-MM-dd')}T23:59:59`)
    }),
    [filteredMeetings, weekEnd, weekStart],
  )

  const selectedDayMeetings = useMemo(
    () => filteredMeetings.filter((meeting) => isSameDay(new Date(`${meeting.meeting_date}T12:00:00`), selectedDay)).sort((a, b) => a.start_time.localeCompare(b.start_time)),
    [filteredMeetings, selectedDay],
  )

  const monthDays = eachDayOfInterval({
    start: startOfWeek(startOfMonth(monthDate), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(monthDate), { weekStartsOn: 1 }),
  })

  const today = new Date()

  function goToToday() {
    const now = new Date()
    setWeekDate(now)
    setSelectedDay(now)
    setMonthDate(now)
  }

  function moveWeek(direction: number) {
    setWeekDate((current) => addWeeks(current, direction))
    setSelectedDay((current) => addWeeks(current, direction))
  }

  function selectDay(day: Date) {
    setSelectedDay(day)
    setWeekDate(day)
    setMonthDate(day)
  }

  function openCreate(date = selectedDay) {
    setEditing(null)
    setSelectedDay(date)
    setFormOpen(true)
  }

  function openEdit(meeting: Meeting) {
    if (!canManageMeeting(profile, meeting)) {
      setViewing(meeting)
      return
    }
    setEditing(meeting)
    setFormOpen(true)
  }

  function startEditingFromView(meeting: Meeting) {
    if (!canManageMeeting(profile, meeting)) return
    setViewing(null)
    setEditing(meeting)
    setFormOpen(true)
  }

  async function handleSave(input: MeetingInput) {
    if (!profile || !isAuthorized) return
    setSaving(true)
    try {
      if (editing) {
        if (!canManageMeeting(profile, editing)) throw new Error('You can only edit your own meetings.')
        await updateMeeting(editing.id, input)
        toast.success('Meeting updated.')
        setFormOpen(false)
        setEditing(null)
        await reload()
        return
      }

      // A regional-coordinator meeting is a broadcast. Before anything is
      // inserted, ask the server for the exact recipient list and rendered
      // email so the creator can verify and explicitly approve the send.
      if (isRegionalCoordinator) {
        const preview = await previewRegionalMeetingEmail(input)
        setPendingRegionalMeeting(input)
        setRegionalPreview(preview)
        setRegionalConfirm(false)
        setFormOpen(false)
        return
      }

      await createMeeting(input)
      toast.success('Meeting created.')
      setFormOpen(false)
      setEditing(null)
      await reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Unable to save the meeting.')
    } finally {
      setSaving(false)
    }
  }

  async function confirmRegionalMeeting() {
    if (!pendingRegionalMeeting || !regionalPreview || !regionalConfirm) return
    setSendingRegionalEmail(true)
    try {
      const meeting = await createMeeting(pendingRegionalMeeting)
      try {
        await sendRegionalMeetingEmail(meeting.id)
        toast.success(`Meeting created and email sent to ${regionalPreview.recipients.length} recipients.`)
      } catch (emailError) {
        toast.error(`Meeting created, but the email could not be sent: ${emailError instanceof Error ? emailError.message : 'Unknown email error'}`)
      }
      setRegionalPreview(null)
      setPendingRegionalMeeting(null)
      setRegionalConfirm(false)
      setEditing(null)
      await reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'The meeting could not be created. No email was sent.')
    } finally {
      setSendingRegionalEmail(false)
    }
  }

  async function handleDone(meeting: Meeting) {
    if (!canManageMeeting(profile, meeting)) {
      toast.error('You can only update your own meetings.')
      return
    }
    try {
      await markMeetingDone(meeting.id)
      toast.success('Meeting marked as done.')
      await reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Unable to update the meeting.')
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || !canManageMeeting(profile, deleteTarget)) {
      setDeleteTarget(null)
      return
    }
    setDeleting(true)
    try {
      await deleteMeeting(deleteTarget.id)
      toast.success('Meeting deleted.')
      setDeleteTarget(null)
      await reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Unable to delete the meeting.')
    } finally {
      setDeleting(false)
    }
  }

  if (!isAuthorized) return null

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-brand-600">
            <CalendarDays size={17} /> EventHub calendar
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Weekly Meetings</h1>
          <p className="mt-1 text-sm text-slate-500">Plan and manage your meetings and activities.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="relative min-w-[260px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="input pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search clubs, people, or meetings..."
            />
          </label>
          <button className="btn-primary" onClick={() => openCreate()}>
            <Plus size={16} /> Add Meeting
          </button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_290px]">
        <section className="card overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="flex items-center gap-2">
              <button className="btn-secondary !px-2.5" onClick={() => moveWeek(-1)} aria-label="Previous week"><ChevronLeft size={17} /></button>
              <button className="btn-secondary !px-3" onClick={goToToday}>Today</button>
              <button className="btn-secondary !px-2.5" onClick={() => moveWeek(1)} aria-label="Next week"><ChevronRight size={17} /></button>
              <h2 className="ml-1 text-base font-bold text-slate-900 sm:text-lg">{format(weekStart, 'MMM d')} – {format(weekEnd, 'MMM d, yyyy')}</h2>
            </div>
            <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-semibold text-slate-500">
              <span className="rounded-lg bg-white px-3 py-2 text-brand-600 shadow-sm">Week</span>
            </div>
          </div>

          {loading || clubsLoading ? (
            <div className="p-5"><CardSkeleton /></div>
          ) : error ? (
            <div className="p-8 text-center text-sm text-rose-600">{error}</div>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[880px]">
                <div className="grid grid-cols-[56px_repeat(7,minmax(110px,1fr))] border-b border-slate-100 bg-white">
                  <div />
                  {weekDays.map((day) => {
                    const active = isSameDay(day, selectedDay)
                    const isToday = isSameDay(day, today)
                    return (
                      <button
                        key={day.toISOString()}
                        onClick={() => selectDay(day)}
                        className={`border-l border-slate-100 px-2 py-3 text-center transition ${active ? 'bg-brand-50/70' : 'hover:bg-slate-50'}`}
                      >
                        <p className="text-xs font-semibold text-slate-500">{format(day, 'EEE')}</p>
                        <p className={`mx-auto mt-1 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${isToday ? 'bg-brand-600 text-white' : active ? 'bg-brand-100 text-brand-700' : 'text-slate-900'}`}>
                          {format(day, 'd')}
                        </p>
                        <p className="mt-1 text-[10px] text-slate-400">{format(day, 'MMM')}</p>
                      </button>
                    )
                  })}
                </div>

                <div className="grid grid-cols-[56px_repeat(7,minmax(110px,1fr))]">
                  <div className="relative h-[720px] bg-white">
                    {Array.from({ length: 13 }, (_, index) => {
                      const hour = 8 + index
                      return <span key={hour} className="absolute right-2 -translate-y-1/2 text-[10px] font-medium text-slate-400" style={{ top: index * HOUR_HEIGHT }}>{`${String(hour).padStart(2, '0')}:00`}</span>
                    })}
                  </div>

                  {weekDays.map((day) => {
                    const dayMeetings = weekMeetings.filter((meeting) => meeting.meeting_date === format(day, 'yyyy-MM-dd'))
                    return (
                      <div
                        key={day.toISOString()}
                        className={`relative h-[720px] border-l border-slate-100 ${isSameDay(day, selectedDay) ? 'bg-brand-50/25' : 'bg-white'}`}
                        onDoubleClick={() => openCreate(day)}
                      >
                        {Array.from({ length: 13 }, (_, index) => (
                          <div key={index} className="pointer-events-none absolute inset-x-0 border-t border-slate-100" style={{ top: index * HOUR_HEIGHT }} />
                        ))}
                        {dayMeetings.map((meeting) => {
                          const color = creatorColor(meeting)
                          const start = Math.max(DAY_START, timeToMinutes(meeting.start_time))
                          const end = Math.min(DAY_END, timeToMinutes(meeting.end_time))
                          const top = ((start - DAY_START) / 60) * HOUR_HEIGHT + 5
                          const height = Math.max(62, ((Math.max(end, start + 30) - start) / 60) * HOUR_HEIGHT - 8)
                          const own = canManageMeeting(profile, meeting)
                          return (
                            <button
                              key={meeting.id}
                              onClick={() => openEdit(meeting)}
                              className={`absolute left-1.5 right-1.5 overflow-hidden rounded-xl border border-slate-200/70 border-l-4 p-2 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-card ${color.border} ${color.bg} ${meeting.status === 'done' ? 'opacity-60' : ''}`}
                              style={{ top, height }}
                              title={`${formatRange(meeting)} · ${meeting.username}`}
                            >
                              <p className={`text-[10px] font-semibold ${color.accent}`}>{formatRange(meeting)}</p>
                              <p className={`mt-0.5 line-clamp-1 text-xs font-bold ${color.text}`}>{getMeetingTitle(meeting)}</p>
                              <p className="mt-1 line-clamp-1 text-[10px] text-slate-500">{getClubLabel(meeting, clubs)}</p>
                              {height > 85 && (
                                <p className="mt-1 flex items-center gap-1 truncate text-[10px] text-slate-500">
                                  <UserRound size={10} /> {meeting.username}
                                </p>
                              )}
                              {height > 110 && (
                                <p className="mt-1 flex items-center gap-1 truncate text-[10px] text-slate-400">
                                  {meeting.is_online ? <Video size={10} /> : <MapPin size={10} />} {meeting.is_online ? 'Online' : meeting.place}
                                </p>
                              )}
                              {!own && <span className="sr-only">View meeting</span>}
                            </button>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </section>

        <aside className="space-y-5">
          <MiniCalendar
            monthDate={monthDate}
            selectedDay={selectedDay}
            days={monthDays}
            meetings={filteredMeetings}
            onMonthChange={(date) => setMonthDate(date)}
            onSelectDay={selectDay}
          />

          <div className="card p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Selected Day</p>
                <h3 className="mt-1 font-bold text-slate-900">{format(selectedDay, 'EEE, MMM d, yyyy')}</h3>
              </div>
              <span className="text-xs font-semibold text-slate-400">{selectedDayMeetings.length} meeting{selectedDayMeetings.length === 1 ? '' : 's'}</span>
            </div>

            <div className="mt-4 space-y-3">
              {selectedDayMeetings.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center">
                  <CalendarDays size={22} className="mx-auto text-slate-300" />
                  <p className="mt-2 text-sm font-semibold text-slate-600">No meetings</p>
                  <button className="mt-3 text-xs font-semibold text-brand-600 hover:text-brand-700" onClick={() => openCreate(selectedDay)}>Add one</button>
                </div>
              ) : (
                selectedDayMeetings.map((meeting) => (
                  <MeetingListCard
                    key={meeting.id}
                    meeting={meeting}
                    clubs={clubs}
                    canManage={canManageMeeting(profile, meeting)}
                    onEdit={openEdit}
                    onDone={handleDone}
                    onDelete={setDeleteTarget}
                  />
                ))
              )}
            </div>
          </div>

          <div className="card bg-gradient-to-br from-brand-50 to-white p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-brand-600 shadow-sm"><CalendarDays size={19} /></div>
            <h3 className="mt-4 font-bold text-slate-900">Organize Stronger Together</h3>
            <p className="mt-1 text-sm leading-6 text-slate-500">Plan, coordinate and keep every meeting visible in one shared calendar.</p>
          </div>
        </aside>
      </div>

      <Modal
        open={formOpen}
        onClose={() => !saving && setFormOpen(false)}
        title={editing ? 'Edit meeting' : 'Add meeting'}
        maxWidth="max-w-2xl"
      >
        <MeetingForm
          profile={profile}
          clubs={selectableClubs}
          allClubs={clubs}
          meeting={editing}
          isEventCoordinator={isEventCoordinator}
          managers={managers}
          assistants={assistants}
          staffLoading={staffLoading}
          defaultDate={selectedDay}
          saving={saving}
          onSubmit={handleSave}
          onCancel={() => setFormOpen(false)}
        />
      </Modal>

      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title="Meeting details"
        maxWidth="max-w-lg"
      >
        {viewing && (
          <MeetingDetails
            meeting={viewing}
            clubs={clubs}
            canManage={canManageMeeting(profile, viewing)}
            onEdit={() => startEditingFromView(viewing)}
            onDone={() => { setViewing(null); void handleDone(viewing) }}
            onDelete={() => { setViewing(null); setDeleteTarget(viewing) }}
          />
        )}
      </Modal>

      <Modal
        open={!!regionalPreview}
        onClose={() => !sendingRegionalEmail && setRegionalPreview(null)}
        title="Verify regional meeting email"
        maxWidth="max-w-4xl"
      >
        {regionalPreview && (
          <div className="space-y-5">
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600"><ShieldCheck size={20} /></div>
                <div>
                  <p className="font-bold text-red-950">Review before sending</p>
                  <p className="mt-1 text-sm leading-6 text-red-800">This meeting will be created only after you confirm. Once created, EventHub will send this exact email to the recipients below.</p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[290px_minmax(0,1fr)]">
              <div className="space-y-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-400"><Mail size={14} /> Email details</div>
                  <div className="mt-4 space-y-3 text-sm">
                    <div><p className="text-xs font-semibold text-slate-400">From</p><p className="font-semibold text-slate-800">{regionalPreview.sender_name} · Regional Coordinator</p></div>
                    <div><p className="text-xs font-semibold text-slate-400">Subject</p><p className="font-semibold text-slate-800">{regionalPreview.subject}</p></div>
                    <div><p className="text-xs font-semibold text-slate-400">Recipients</p><p className="font-bold text-slate-900">{regionalPreview.recipients.length} people</p><p className="mt-1 text-xs leading-5 text-slate-500">{regionalPreview.recipients.filter((r) => r.type === 'Dean').length} deans · {regionalPreview.recipients.filter((r) => r.type === 'Coordinator').length} other coordinators</p></div>
                  </div>
                </div>

                <div className="max-h-56 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-3">
                  <p className="px-1 text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Exact recipients</p>
                  <div className="mt-2 space-y-1">
                    {regionalPreview.recipients.map((recipient) => (
                      <div key={recipient.email} className="rounded-lg px-2 py-1.5 hover:bg-slate-50">
                        <p className="text-xs font-semibold text-slate-800">{recipient.name} <span className="font-normal text-slate-400">· {recipient.type}</span></p>
                        <p className="truncate text-[11px] text-slate-500">{recipient.email}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                <div className="border-b border-slate-200 bg-white px-4 py-3"><p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Email preview</p></div>
                <div className="max-h-[560px] overflow-y-auto" dangerouslySetInnerHTML={{ __html: regionalPreview.html }} />
              </div>
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4">
              <input type="checkbox" className="mt-1 h-4 w-4 accent-red-600" checked={regionalConfirm} onChange={(e) => setRegionalConfirm(e.target.checked)} />
              <span><span className="block text-sm font-bold text-slate-900">I have reviewed the meeting and email</span><span className="mt-1 block text-xs leading-5 text-slate-500">I confirm that the meeting details and recipient list are correct, and I authorize EventHub to create the meeting and send this email.</span></span>
            </label>

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button type="button" className="btn-secondary" onClick={() => setRegionalPreview(null)} disabled={sendingRegionalEmail}>Back</button>
              <button type="button" className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50" onClick={() => void confirmRegionalMeeting()} disabled={!regionalConfirm || sendingRegionalEmail}>
                <Mail size={16} /> {sendingRegionalEmail ? 'Creating & sending…' : 'Confirm & create meeting'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete meeting?"
        message={`This will permanently remove the meeting created by ${deleteTarget?.username ?? 'this user'}.`}
        confirmLabel="Delete"
        danger
        loading={deleting}
      />
    </div>
  )
}

function getClubLabel(meeting: Meeting, clubs: Club[]) {
  if (!meeting.club_ids) return 'All clubs'
  const names = meeting.club_ids.map((id) => clubs.find((club) => club.id === id)?.name).filter(Boolean) as string[]
  return names.length ? names.join(' · ') : 'Selected clubs'
}

function MiniCalendar({
  monthDate,
  selectedDay,
  days,
  meetings,
  onMonthChange,
  onSelectDay,
}: {
  monthDate: Date
  selectedDay: Date
  days: Date[]
  meetings: Meeting[]
  onMonthChange: (date: Date) => void
  onSelectDay: (date: Date) => void
}) {
  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-slate-900">{format(monthDate, 'MMMM yyyy')}</h3>
        <div className="flex gap-1">
          <button className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" onClick={() => onMonthChange(addMonths(monthDate, -1))}><ChevronLeft size={16} /></button>
          <button className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" onClick={() => onMonthChange(addMonths(monthDate, 1))}><ChevronRight size={16} /></button>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-7 text-center text-[10px] font-semibold text-slate-400">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => <span key={day}>{day.slice(0, 1)}</span>)}
      </div>
      <div className="mt-2 grid grid-cols-7 gap-1">
        {days.map((day) => {
          const hasMeeting = meetings.some((meeting) => meeting.meeting_date === format(day, 'yyyy-MM-dd'))
          const selected = isSameDay(day, selectedDay)
          return (
            <button
              key={day.toISOString()}
              onClick={() => onSelectDay(day)}
              className={`relative flex h-8 items-center justify-center rounded-lg text-xs font-medium transition ${!isSameMonth(day, monthDate) ? 'text-slate-300' : 'text-slate-600'} ${selected ? 'bg-brand-600 text-white' : 'hover:bg-brand-50 hover:text-brand-700'}`}
            >
              {format(day, 'd')}
              {hasMeeting && !selected && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-brand-500" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function MeetingDetails({
  meeting,
  clubs,
  canManage,
  onEdit,
  onDone,
  onDelete,
}: {
  meeting: Meeting
  clubs: Club[]
  canManage: boolean
  onEdit: () => void
  onDone: () => void
  onDelete: () => void
}) {
  const color = creatorColor(meeting)
  return (
    <div className="space-y-5">
      <div className={`rounded-2xl border border-slate-200 border-l-4 p-4 ${color.border} ${color.bg}`}>
        <p className={`text-xs font-semibold ${color.accent}`}>{formatRange(meeting)}</p>
        <h3 className={`mt-1 text-lg font-bold ${color.text}`}>{getMeetingTitle(meeting)}</h3>
        {meeting.description && <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{meeting.description}</p>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <DetailItem icon={<Users size={15} />} label="Clubs" value={getClubLabel(meeting, clubs)} />
        <DetailItem icon={<UserRound size={15} />} label="Created by" value={`${meeting.username} · ${getCreatorRole(meeting)}`} />
        <DetailItem icon={meeting.is_online ? <Video size={15} /> : <MapPin size={15} />} label="Place" value={meeting.is_online ? 'Online' : meeting.place ?? '—'} />
        <DetailItem icon={<CheckCircle2 size={15} />} label="Status" value={meeting.status === 'done' ? 'Done' : 'Pending'} />
      </div>
      {meeting.meeting_link && (
        <a href={meeting.meeting_link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-100">
          <ExternalLink size={15} /> Open meeting link
        </a>
      )}
      {canManage && (
        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
          <button className="btn-danger" onClick={onDelete}><Trash2 size={15} /> Delete</button>
          {meeting.status !== 'done' && <button className="btn-secondary" onClick={onDone}><Check size={15} /> Mark done</button>}
          <button className="btn-primary" onClick={onEdit}><Pencil size={15} /> Edit</button>
        </div>
      )}
    </div>
  )
}

function DetailItem({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{icon}{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-700">{value}</p>
    </div>
  )
}

function MeetingListCard({
  meeting,
  clubs,
  canManage,
  onEdit,
  onDone,
  onDelete,
}: {
  meeting: Meeting
  clubs: Club[]
  canManage: boolean
  onEdit: (meeting: Meeting) => void
  onDone: (meeting: Meeting) => void
  onDelete: (meeting: Meeting) => void
}) {
  const color = creatorColor(meeting)
  const [menuOpen, setMenuOpen] = useState(false)
  return (
    <div className={`relative rounded-xl border border-slate-200/70 border-l-4 bg-white p-3 shadow-sm ${color.border} ${meeting.status === 'done' ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className={`text-[11px] font-semibold ${color.accent}`}>{formatRange(meeting)}</p>
          <p className="mt-1 text-sm font-bold text-slate-900">{getMeetingTitle(meeting)}</p>
        </div>
        {canManage && (
          <div className="relative">
            <button className="rounded-lg p-1 text-slate-400 hover:bg-slate-100" onClick={() => setMenuOpen((v) => !v)}><MoreVertical size={16} /></button>
            {menuOpen && (
              <div className="absolute right-0 top-8 z-20 w-36 rounded-xl border border-slate-200 bg-white p-1 shadow-card">
                <button className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50" onClick={() => { setMenuOpen(false); onEdit(meeting) }}><Pencil size={13} /> Edit</button>
                {meeting.status !== 'done' && <button className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-emerald-700 hover:bg-emerald-50" onClick={() => { setMenuOpen(false); onDone(meeting) }}><Check size={13} /> Mark done</button>}
                <button className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-rose-600 hover:bg-rose-50" onClick={() => { setMenuOpen(false); onDelete(meeting) }}><Trash2 size={13} /> Delete</button>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="mt-2 space-y-1 text-[11px] text-slate-500">
        <p className="flex items-center gap-1.5"><Users size={12} /> {getClubLabel(meeting, clubs)}</p>
        <p className="flex items-center gap-1.5"><UserRound size={12} /> Created by {meeting.username}</p>
        <p className="flex items-center gap-1.5">{meeting.is_online ? <Video size={12} /> : <MapPin size={12} />} {meeting.is_online ? 'Online' : meeting.place}</p>
      </div>
      {meeting.meeting_link && (
        <a href={meeting.meeting_link} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-brand-600 hover:text-brand-700">
          <ExternalLink size={11} /> Open meeting link
        </a>
      )}
      {meeting.status === 'done' && <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700"><CheckCircle2 size={11} /> Done</span>}
    </div>
  )
}

function MeetingForm({
  profile,
  clubs,
  allClubs,
  meeting,
  isEventCoordinator,
  managers,
  assistants,
  staffLoading,
  defaultDate,
  saving,
  onSubmit,
  onCancel,
}: {
  profile: ReturnType<typeof useAuth>['profile']
  clubs: Club[]
  allClubs: Club[]
  meeting: Meeting | null
  isEventCoordinator: boolean
  managers: ProfileWithClub[]
  assistants: ProfileWithClub[]
  staffLoading: boolean
  defaultDate: Date
  saving: boolean
  onSubmit: (input: MeetingInput) => Promise<void>
  onCancel: () => void
}) {
  const [date, setDate] = useState(meeting?.meeting_date ?? format(defaultDate, 'yyyy-MM-dd'))
  const [startTime, setStartTime] = useState(meeting?.start_time?.slice(0, 5) ?? '09:00')
  const [endTime, setEndTime] = useState(meeting?.end_time?.slice(0, 5) ?? '10:00')
  const [description, setDescription] = useState(meeting?.description ?? '')
  const [isOnline, setIsOnline] = useState(meeting?.is_online ?? false)
  const [place, setPlace] = useState(meeting?.place ?? '')
  const [meetingLink, setMeetingLink] = useState(meeting?.meeting_link ?? '')
  const [allSelected, setAllSelected] = useState(meeting?.club_ids === null)
  const [selectedClubs, setSelectedClubs] = useState<string[]>(meeting?.club_ids ?? [])

  const staffByClub = useMemo(() => {
    const result = new Map<string, { managers: ProfileWithClub[]; assistants: ProfileWithClub[] }>()
    allClubs.forEach((club) => result.set(club.id, { managers: [], assistants: [] }))
    managers.forEach((manager) => {
      if (manager.club_id && result.has(manager.club_id)) result.get(manager.club_id)!.managers.push(manager)
    })
    assistants.forEach((assistant) => {
      if (assistant.club_id && result.has(assistant.club_id)) result.get(assistant.club_id)!.assistants.push(assistant)
    })
    return result
  }, [allClubs, assistants, managers])

  function toggleAll() {
    setAllSelected((value) => !value)
    setSelectedClubs([])
  }

  function toggleClub(id: string) {
    setAllSelected(false)
    setSelectedClubs((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!profile) return
    if (!description.trim()) {
      toast.error('Please enter a meeting description.')
      return
    }
    if (!isOnline && !place.trim()) {
      toast.error('Enter a place or choose Online.')
      return
    }
    if (endTime <= startTime) {
      toast.error('End time must be after start time.')
      return
    }
    if (!allSelected && selectedClubs.length === 0) {
      toast.error('Select at least one club or choose All clubs.')
      return
    }
    await onSubmit({
      club_ids: allSelected ? null : selectedClubs,
      meeting_date: date,
      start_time: startTime,
      end_time: endTime,
      description: description.trim(),
      is_online: isOnline,
      place: isOnline ? null : place.trim(),
      meeting_link: isOnline && meetingLink.trim() ? meetingLink.trim() : null,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="rounded-2xl bg-slate-50 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Created by</p>
            <p className="mt-1 text-sm font-bold text-slate-900">{profile?.manager_name}</p>
          </div>
          <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-500">{profile?.role === 'coordinator' ? 'Coordinator' : profile?.role === 'admin' ? 'Administrator' : 'Dean'}</span>
        </div>
      </div>

      <div>
        <label className="label">Clubs</label>
        <button type="button" onClick={toggleAll} className={`flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition ${allSelected ? 'border-brand-400 bg-brand-50 text-brand-800' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
          <span className={`flex h-5 w-5 items-center justify-center rounded-md border ${allSelected ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white'}`}>{allSelected && <Check size={13} />}</span>
          <span><span className="block text-sm font-semibold">All clubs</span><span className="block text-xs text-slate-400">{profile?.role === 'dean' ? 'All clubs under your management' : 'Shared across EventHub'}</span></span>
        </button>

        <div className="mt-2 max-h-64 space-y-2 overflow-y-auto pr-1">
          {clubs.map((club) => {
            const selected = selectedClubs.includes(club.id)
            const staff = staffByClub.get(club.id)
            return (
              <button key={club.id} type="button" onClick={() => toggleClub(club.id)} className={`w-full rounded-xl border p-3 text-left transition ${selected ? 'border-brand-300 bg-brand-50/60' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                <div className="flex items-start gap-3">
                  <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${selected ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white'}`}>{selected && <Check size={13} />}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-800">{club.name}</p>
                    {isEventCoordinator && (
                      <div className="mt-1.5 space-y-0.5 text-xs text-slate-500">
                        {staffLoading ? <span>Loading club staff…</span> : (
                          <>
                            {staff?.managers.map((person) => <p key={`m-${person.id}`}>{person.manager_name} · Manager</p>)}
                            {staff?.assistants.map((person) => <p key={`a-${person.id}`}>{person.manager_name} · Assistant</p>)}
                            {!staff?.managers.length && !staff?.assistants.length && <p>No manager or assistant linked.</p>}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div><label className="label">Date</label><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></div>
        <div><label className="label">Start time</label><input className="input" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required /></div>
        <div><label className="label">End time</label><input className="input" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required /></div>
      </div>

      <div>
        <label className="label">Description</label>
        <textarea className="input min-h-28 resize-y" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this meeting about?" required />
        <p className="mt-1 text-xs text-slate-400">The first line is used as the meeting label in the weekly calendar.</p>
      </div>

      <div>
        <label className="label">Place</label>
        <div className="flex gap-2">
          <button type="button" onClick={() => setIsOnline(false)} className={`flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold ${!isOnline ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-500'}`}><MapPin size={15} /> Physical place</button>
          <button type="button" onClick={() => setIsOnline(true)} className={`flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold ${isOnline ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-500'}`}><Video size={15} /> Online</button>
        </div>
        {!isOnline ? (
          <input className="input mt-2" value={place} onChange={(e) => setPlace(e.target.value)} placeholder="e.g. Sfax Office, Room A" />
        ) : (
          <div className="mt-2">
            <input className="input" type="url" value={meetingLink} onChange={(e) => setMeetingLink(e.target.value)} placeholder="https://meet.google.com/... (optional)" />
            <p className="mt-1 text-xs text-slate-400">The meeting card will display “Online”. Add a link when one is available.</p>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={saving}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : meeting ? 'Save changes' : 'Create meeting'}</button>
      </div>
    </form>
  )
}

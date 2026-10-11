import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, MapPin, Clock, Building2, UserRound, CalendarDays, X } from 'lucide-react'
import type { EventWithClub, ProfileWithRelations } from '@/types/database'
import { Modal } from '@/components/ui/Modal'

const managerPalette = [
  { solid: '#3B82F6', soft: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
  { solid: '#F43F5E', soft: '#FFF1F2', text: '#BE123C', border: '#FECDD3' },
  { solid: '#10B981', soft: '#ECFDF5', text: '#047857', border: '#A7F3D0' },
  { solid: '#8B5CF6', soft: '#F5F3FF', text: '#6D28D9', border: '#DDD6FE' },
  { solid: '#F59E0B', soft: '#FFFBEB', text: '#B45309', border: '#FDE68A' },
  { solid: '#06B6D4', soft: '#ECFEFF', text: '#0E7490', border: '#A5F3FC' },
  { solid: '#EC4899', soft: '#FDF2F8', text: '#BE185D', border: '#FBCFE8' },
  { solid: '#6366F1', soft: '#EEF2FF', text: '#4338CA', border: '#C7D2FE' },
]

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function startWeekday(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })
}

export function MonthCalendar({
  events,
  managers = [],
  onDeleteEvent,
  onEditEvent,
  canManageEvent,
}: {
  events: EventWithClub[]
  managers?: ProfileWithRelations[]
  onDeleteEvent?: (event: EventWithClub) => void
  onEditEvent?: (event: EventWithClub) => void
  canManageEvent?: (event: EventWithClub) => boolean
}) {
  const today = new Date()
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [selected, setSelected] = useState<EventWithClub | null>(null)
  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const managerIndex = useMemo(() => new Map(managers.map((manager, index) => [manager.id, index])), [managers])

  const getManager = (event: EventWithClub) =>
    managers.find((manager) => manager.id === event.created_by) ??
    managers.find((manager) => manager.club_id === event.club_id)

  const getPalette = (event: EventWithClub) => {
    const manager = getManager(event)
    const index = manager ? (managerIndex.get(manager.id) ?? 0) : managers.length
    return managerPalette[index % managerPalette.length]
  }

  const eventsByDay = useMemo(() => {
    const map = new Map<number, EventWithClub[]>()
    for (const event of events) {
      const date = new Date(`${event.event_date}T00:00:00`)
      if (date.getFullYear() === year && date.getMonth() === month) {
        const day = date.getDate()
        map.set(day, [...(map.get(day) ?? []), event])
      }
    }
    for (const [day, items] of map) {
      map.set(day, [...items].sort((a, b) => a.event_timing.localeCompare(b.event_timing)))
    }
    return map
  }, [events, year, month])

  const totalDays = daysInMonth(year, month)
  const leadingBlanks = startWeekday(year, month)
  const cells: (number | null)[] = [...Array(leadingBlanks).fill(null), ...Array.from({ length: totalDays }, (_, index) => index + 1)]
  const monthLabel = cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const isToday = (day: number) => day === today.getDate() && month === today.getMonth() && year === today.getFullYear()
  const monthOptions = Array.from({ length: 12 }, (_, index) => ({ value: index, label: new Date(year, index, 1).toLocaleDateString('en-US', { month: 'long' }) }))
  const selectedManager = selected ? getManager(selected) : undefined
  const selectedPalette = selected ? getPalette(selected) : managerPalette[0]

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-indigo-500">Monthly overview</p>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-950">{monthLabel}</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setCursor(new Date(year, month - 1, 1))} className="rounded-xl border border-slate-200 p-2.5 text-slate-600 transition hover:bg-slate-50" aria-label="Previous month"><ChevronLeft size={17} /></button>
          <button onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))} className="rounded-xl border border-indigo-100 bg-indigo-50 px-3.5 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100">Today</button>
          <button onClick={() => setCursor(new Date(year, month + 1, 1))} className="rounded-xl border border-slate-200 p-2.5 text-slate-600 transition hover:bg-slate-50" aria-label="Next month"><ChevronRight size={17} /></button>
          <select aria-label="Select month" className="input min-w-[135px]" value={month} onChange={(event) => setCursor(new Date(year, Number(event.target.value), 1))}>
            {monthOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <div className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-600">{year}</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-100 px-4 py-3 sm:px-6">
        {managers.map((manager, index) => {
          const color = managerPalette[index % managerPalette.length]
          return <div key={manager.id} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2" style={{ borderColor: color.border, backgroundColor: color.soft }}>
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color.solid }} />
            <span className="text-xs font-semibold" style={{ color: color.text }}>{manager.manager_name}</span>
            <span className="text-[11px] text-slate-500">{manager.club?.name ?? ''}</span>
          </div>
        })}
      </div>

      <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/80 text-center text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 sm:text-xs">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <div key={day} className="py-3">{day}</div>)}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((day, index) => {
          const dayEvents = day ? eventsByDay.get(day) ?? [] : []
          return <div key={index} className={`min-h-[118px] border-b border-r border-slate-100 p-1.5 transition sm:min-h-[145px] sm:p-2.5 lg:min-h-[155px] ${day ? 'bg-white hover:bg-slate-50/60' : 'bg-slate-50/50'}`}>
            {day && <>
              <div className="mb-2 flex items-center justify-between">
                <span className={`inline-flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 text-xs font-bold ${isToday(day) ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/30' : 'text-slate-600'}`}>{day}</span>
                {dayEvents.length > 0 && <span className="text-[10px] font-medium text-slate-400">{dayEvents.length}</span>}
              </div>
              <div className="space-y-1.5">
                {dayEvents.slice(0, 3).map((event) => {
                  const manager = getManager(event)
                  const color = getPalette(event)
                  return <button key={event.id} onClick={() => setSelected(event)} className="block w-full min-w-0 rounded-lg border-l-[3px] px-1.5 py-1.5 text-left transition hover:-translate-y-px hover:shadow-sm sm:px-2" style={{ backgroundColor: color.soft, borderLeftColor: color.solid }} title={`${manager?.manager_name ?? 'Manager not assigned'} · ${event.event_date} · ${event.event_location}`}>
                    <span className="block truncate text-[10px] font-bold leading-4 sm:text-[11px]" style={{ color: color.text }}>{manager?.manager_name ?? 'Manager not assigned'}</span>
                    <span className="mt-0.5 block truncate text-[9px] leading-3.5 text-slate-600 sm:text-[10px]">{event.event_date.slice(8, 10)}/{event.event_date.slice(5, 7)} · {event.event_location || 'Place not specified'}</span>
                  </button>
                })}
                {dayEvents.length > 3 && <button onClick={() => setSelected(dayEvents[3])} className="px-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-800">+{dayEvents.length - 3} more</button>}
              </div>
            </>}
          </div>
        })}
      </div>

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Event details">
        {selected && <div className="space-y-5">
          <div className="rounded-2xl border p-4" style={{ borderColor: selectedPalette.border, backgroundColor: selectedPalette.soft }}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em]" style={{ color: selectedPalette.text }}>Event</p>
                <h3 className="mt-1 text-xl font-bold text-slate-950">{selected.event_name}</h3>
              </div>
              <button onClick={() => setSelected(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/70 hover:text-slate-700" aria-label="Close details"><X size={17} /></button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-start gap-3 rounded-xl border border-slate-100 p-3"><CalendarDays size={17} className="mt-0.5 shrink-0 text-indigo-500" /><div><p className="text-xs font-semibold text-slate-400">Date</p><p className="mt-1 text-sm font-semibold text-slate-800">{formatDate(selected.event_date)}</p></div></div>
            <div className="flex items-start gap-3 rounded-xl border border-slate-100 p-3"><Clock size={17} className="mt-0.5 shrink-0 text-indigo-500" /><div><p className="text-xs font-semibold text-slate-400">Time</p><p className="mt-1 text-sm font-semibold text-slate-800">{selected.event_timing || 'Not specified'}</p></div></div>
            <div className="flex items-start gap-3 rounded-xl border border-slate-100 p-3"><MapPin size={17} className="mt-0.5 shrink-0 text-indigo-500" /><div><p className="text-xs font-semibold text-slate-400">Place</p><p className="mt-1 text-sm font-semibold text-slate-800">{selected.event_location || 'Not specified'}</p></div></div>
            <div className="flex items-start gap-3 rounded-xl border border-slate-100 p-3"><Building2 size={17} className="mt-0.5 shrink-0 text-indigo-500" /><div><p className="text-xs font-semibold text-slate-400">Club</p><p className="mt-1 text-sm font-semibold text-slate-800">{selected.club?.name ?? 'Unknown club'}</p></div></div>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-slate-100 p-3"><UserRound size={17} className="mt-0.5 shrink-0" style={{ color: selectedPalette.solid }} /><div><p className="text-xs font-semibold text-slate-400">Manager</p><p className="mt-1 text-sm font-semibold text-slate-800">{selectedManager?.manager_name ?? 'Manager not assigned'}</p></div></div>
          {selected.event_description && <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Description</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{selected.event_description}</p></div>}
          {(onEditEvent || onDeleteEvent) && (!canManageEvent || canManageEvent(selected)) && <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            {onEditEvent && <button className="btn-secondary" onClick={() => { onEditEvent(selected); setSelected(null) }}>Edit event</button>}
            {onDeleteEvent && <button className="btn-danger" onClick={() => { onDeleteEvent(selected); setSelected(null) }}>Delete event</button>}
          </div>}
        </div>}
      </Modal>
    </div>
  )
}

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, MapPin, Clock, Building2 } from 'lucide-react'
import type { EventWithClub } from '@/types/database'
import { Modal } from '@/components/ui/Modal'

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function startWeekday(year: number, month: number) {
  return new Date(year, month, 1).getDay() // 0 = Sunday
}

export function MonthCalendar({
  events,
  onDeleteEvent,
  onEditEvent,
  canManageEvent,
}: {
  events: EventWithClub[]
  onDeleteEvent?: (event: EventWithClub) => void
  onEditEvent?: (event: EventWithClub) => void
  canManageEvent?: (event: EventWithClub) => boolean
}) {
  const today = new Date()
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [selected, setSelected] = useState<EventWithClub | null>(null)

  const year = cursor.getFullYear()
  const month = cursor.getMonth()

  const eventsByDay = useMemo(() => {
    const map = new Map<number, EventWithClub[]>()
    for (const ev of events) {
      const d = new Date(ev.event_date + 'T00:00:00')
      if (d.getFullYear() === year && d.getMonth() === month) {
        const day = d.getDate()
        map.set(day, [...(map.get(day) ?? []), ev])
      }
    }
    return map
  }, [events, year, month])

  const totalDays = daysInMonth(year, month)
  const leadingBlanks = startWeekday(year, month)
  const cells: (number | null)[] = [
    ...Array(leadingBlanks).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ]

  const monthLabel = cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const isToday = (day: number) =>
    day === today.getDate() && month === today.getMonth() && year === today.getFullYear()

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3.5 sm:px-5">
        <h2 className="text-sm font-bold text-slate-900 sm:text-base">{monthLabel}</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCursor(new Date(year, month - 1, 1))}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
            aria-label="Previous month"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))}
            className="rounded-lg px-2.5 py-1 text-xs font-semibold text-brand-600 hover:bg-brand-50"
          >
            Today
          </button>
          <button
            onClick={() => setCursor(new Date(year, month + 1, 1))}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
            aria-label="Next month"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/70 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} className="py-2">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((day, idx) => {
          const dayEvents = day ? eventsByDay.get(day) ?? [] : []
          return (
            <div
              key={idx}
              className={`min-h-[72px] border-b border-r border-slate-100 p-1.5 sm:min-h-[100px] sm:p-2 ${
                day ? 'bg-white' : 'bg-slate-50/40'
              }`}
            >
              {day && (
                <>
                  <span
                    className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                      isToday(day) ? 'bg-brand-600 text-white' : 'text-slate-500'
                    }`}
                  >
                    {day}
                  </span>
                  <div className="mt-1 space-y-1">
                    {dayEvents.slice(0, 2).map((ev) => (
                      <button
                        key={ev.id}
                        onClick={() => setSelected(ev)}
                        className="block w-full truncate rounded-md bg-brand-50 px-1.5 py-1 text-left text-[10px] font-medium text-brand-700 hover:bg-brand-100 sm:text-[11px]"
                      >
                        {ev.event_name}
                      </button>
                    ))}
                    {dayEvents.length > 2 && (
                      <button
                        onClick={() => setSelected(dayEvents[2])}
                        className="text-[10px] font-medium text-slate-400 hover:text-slate-600"
                      >
                        +{dayEvents.length - 2} more
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.event_name ?? ''}>
        {selected && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Building2 size={16} className="text-brand-500" />
              {selected.club?.name ?? 'Unknown club'}
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Clock size={16} className="text-brand-500" />
              {new Date(selected.event_date + 'T00:00:00').toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}{' '}
              at {selected.event_timing}
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <MapPin size={16} className="text-brand-500" />
              {selected.event_location}
            </div>
            {selected.event_description && (
              <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{selected.event_description}</p>
            )}

            {(onEditEvent || onDeleteEvent) && (!canManageEvent || canManageEvent(selected)) && (
              <div className="flex justify-end gap-2 pt-2">
                {onEditEvent && (
                  <button
                    className="btn-secondary"
                    onClick={() => {
                      onEditEvent(selected)
                      setSelected(null)
                    }}
                  >
                    Edit
                  </button>
                )}
                {onDeleteEvent && (
                  <button
                    className="btn-danger"
                    onClick={() => {
                      onDeleteEvent(selected)
                      setSelected(null)
                    }}
                  >
                    Delete
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

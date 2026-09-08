import { useState, type FormEvent } from 'react'
import toast from 'react-hot-toast'
import type { Club, EventWithClub } from '@/types/database'
import { createEvent, updateEvent } from '@/services/events'
import { notifyAdmin } from '@/services/notifications'

interface Props {
  clubId?: string // pre-filled & locked for managers
  clubs?: Club[] // shown as a select for admin
  event?: EventWithClub // when editing
  createdByProfileId: string | null
  onSuccess: () => void
  onCancel: () => void
}

export function EventForm({ clubId, clubs, event, createdByProfileId, onSuccess, onCancel }: Props) {
  const [selectedClubId, setSelectedClubId] = useState(event?.club_id ?? clubId ?? '')
  const [eventName, setEventName] = useState(event?.event_name ?? '')
  const [eventDate, setEventDate] = useState(event?.event_date ?? '')
  const [eventLocation, setEventLocation] = useState(event?.event_location ?? '')
  const [eventTiming, setEventTiming] = useState(event?.event_timing ?? '')
  const [eventDescription, setEventDescription] = useState(event?.event_description ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  function validate(): boolean {
    const next: Record<string, string> = {}
    if (!selectedClubId) next.club = 'Please select a club.'
    if (!eventName.trim()) next.eventName = 'Event name is required.'
    if (!eventDate) next.eventDate = 'Date is required.'
    if (!eventLocation.trim()) next.eventLocation = 'Location is required.'
    if (!eventTiming) next.eventTiming = 'Timing is required.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setSubmitting(true)
    try {
      const payload = {
        club_id: selectedClubId,
        event_name: eventName.trim(),
        event_date: eventDate,
        event_location: eventLocation.trim(),
        event_timing: eventTiming,
        event_description: eventDescription.trim() || null,
      }
      if (event) {
        await updateEvent(event.id, payload)
        toast.success('Event updated successfully.')
      } else {
        const created = await createEvent(payload, createdByProfileId)
        toast.success('Event added successfully.')
      }
      onSuccess()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to save the event.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {clubs && (
        <div>
          <label className="label">Club</label>
          <select
            className="input"
            value={selectedClubId}
            onChange={(e) => setSelectedClubId(e.target.value)}
          >
            <option value="">Select a club…</option>
            {clubs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {errors.club && <p className="field-error">{errors.club}</p>}
        </div>
      )}

      <div>
        <label className="label">Event Name</label>
        <input className="input" value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder="Charity Day" />
        {errors.eventName && <p className="field-error">{errors.eventName}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Date</label>
          <input type="date" className="input" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
          {errors.eventDate && <p className="field-error">{errors.eventDate}</p>}
        </div>
        <div>
          <label className="label">Timing</label>
          <input type="time" className="input" value={eventTiming} onChange={(e) => setEventTiming(e.target.value)} />
          {errors.eventTiming && <p className="field-error">{errors.eventTiming}</p>}
        </div>
      </div>

      <div>
        <label className="label">Location</label>
        <input className="input" value={eventLocation} onChange={(e) => setEventLocation(e.target.value)} placeholder="Main hall" />
        {errors.eventLocation && <p className="field-error">{errors.eventLocation}</p>}
      </div>

      <div>
        <label className="label">Description (optional)</label>
        <textarea
          className="input min-h-[90px] resize-y"
          value={eventDescription}
          onChange={(e) => setEventDescription(e.target.value)}
          placeholder="Details about the event…"
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Saving…' : event ? 'Save changes' : 'Add event'}
        </button>
      </div>
    </form>
  )
}

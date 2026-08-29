import { useEffect, useState, type FormEvent } from 'react'
import toast from 'react-hot-toast'
import type { Report } from '@/types/database'
import { upsertReport } from '@/services/reports'
import { MONTH_NAMES } from '@/utils/reportStatus'

interface Props {
  clubId: string
  month: number
  year: number
  existing: Report | null
  createdByProfileId: string | null
  onSuccess: () => void
}

export function ReportForm({ clubId, month, year, existing, createdByProfileId, onSuccess }: Props) {
  const [members, setMembers] = useState(existing?.members ?? 0)
  const [activeMembers, setActiveMembers] = useState(existing?.active_members ?? 0)
  const [events, setEvents] = useState(existing?.events ?? 0)
  const [meetings, setMeetings] = useState(existing?.meetings ?? 0)
  const [evaluation, setEvaluation] = useState(existing?.evaluation ?? '')
  const [remarks, setRemarks] = useState(existing?.remarks ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState<'draft' | 'submitted' | null>(null)
  const isLocked = existing?.status === 'submitted'

  useEffect(() => {
    setMembers(existing?.members ?? 0)
    setActiveMembers(existing?.active_members ?? 0)
    setEvents(existing?.events ?? 0)
    setMeetings(existing?.meetings ?? 0)
    setEvaluation(existing?.evaluation ?? '')
    setRemarks(existing?.remarks ?? '')
  }, [existing])

  function validate(): boolean {
    const next: Record<string, string> = {}
    if (members < 0) next.members = 'Must be zero or more.'
    if (activeMembers < 0) next.activeMembers = 'Must be zero or more.'
    if (activeMembers > members) next.activeMembers = 'Cannot exceed total members.'
    if (events < 0) next.events = 'Must be zero or more.'
    if (meetings < 0) next.meetings = 'Must be zero or more.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(e: FormEvent, status: 'draft' | 'submitted') {
    e.preventDefault()
    if (!validate()) return
    setSubmitting(status)
    try {
      await upsertReport(
        {
          club_id: clubId,
          month,
          year,
          members,
          active_members: activeMembers,
          events,
          meetings,
          evaluation: evaluation.trim() || null,
          remarks: remarks.trim() || null,
          status,
        },
        createdByProfileId,
      )
      toast.success(status === 'submitted' ? 'Monthly report submitted.' : 'Draft saved.')
      onSuccess()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to save the report.')
    } finally {
      setSubmitting(null)
    }
  }

  return (
    <form className="space-y-5">
      <div className="flex items-center justify-between rounded-xl bg-brand-50 px-4 py-3">
        <p className="text-sm font-semibold text-brand-800">
          {MONTH_NAMES[month - 1]} {year}
        </p>
        {isLocked && <span className="badge bg-emerald-100 text-emerald-700">Submitted</span>}
      </div>

      <fieldset disabled={isLocked} className="space-y-5 disabled:opacity-60">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Members</label>
            <input
              type="number"
              min={0}
              className="input"
              value={members}
              onChange={(e) => setMembers(Number(e.target.value))}
            />
            {errors.members && <p className="field-error">{errors.members}</p>}
          </div>
          <div>
            <label className="label">Active Members</label>
            <input
              type="number"
              min={0}
              className="input"
              value={activeMembers}
              onChange={(e) => setActiveMembers(Number(e.target.value))}
            />
            {errors.activeMembers && <p className="field-error">{errors.activeMembers}</p>}
          </div>
          <div>
            <label className="label">Events Held</label>
            <input
              type="number"
              min={0}
              className="input"
              value={events}
              onChange={(e) => setEvents(Number(e.target.value))}
            />
            {errors.events && <p className="field-error">{errors.events}</p>}
          </div>
          <div>
            <label className="label">Meetings Held</label>
            <input
              type="number"
              min={0}
              className="input"
              value={meetings}
              onChange={(e) => setMeetings(Number(e.target.value))}
            />
            {errors.meetings && <p className="field-error">{errors.meetings}</p>}
          </div>
        </div>

        <div>
          <label className="label">Evaluation</label>
          <textarea
            className="input min-h-[80px] resize-y"
            value={evaluation}
            onChange={(e) => setEvaluation(e.target.value)}
            placeholder="How did the club perform this month?"
          />
        </div>

        <div>
          <label className="label">Remarks</label>
          <textarea
            className="input min-h-[80px] resize-y"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Anything else to flag to the coordinator?"
          />
        </div>
      </fieldset>

      {!isLocked && (
        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="btn-secondary"
            onClick={(e) => handleSubmit(e, 'draft')}
            disabled={submitting !== null}
          >
            {submitting === 'draft' ? 'Saving…' : 'Save as draft'}
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={(e) => handleSubmit(e, 'submitted')}
            disabled={submitting !== null}
          >
            {submitting === 'submitted' ? 'Submitting…' : 'Submit report'}
          </button>
        </div>
      )}
    </form>
  )
}

import { useState, type FormEvent } from 'react'
import toast from 'react-hot-toast'
import { createEventRequest, type EventRequestInput } from '@/services/eventRequests'
import { notifyAdmin } from '@/services/notifications'

interface Props {
  clubId: string
  submittedByProfileId: string | null
  submittedByName: string
  onSuccess: () => void
}

const TEXT_ROWS: { key: keyof Omit<EventRequestInput, 'club_id' | 'nombre_participants' | 'nombre_organisateurs'>; label: string; multiline: boolean }[] = [
  { key: 'objectifs', label: 'Objectifs', multiline: true },
  { key: 'date_horaire', label: 'Date & Horaire', multiline: false },
  { key: 'lieu', label: 'Lieu', multiline: false },
  { key: 'plan_evenement', label: "Plan de l'événement", multiline: true },
  { key: 'cibles', label: 'Cibles', multiline: false },
]

const TEXT_ROWS_AFTER: { key: keyof Omit<EventRequestInput, 'club_id' | 'nombre_participants' | 'nombre_organisateurs'>; label: string; multiline: boolean }[] = [
  { key: 'liste_invites', label: 'Liste des Invités', multiline: true },
  { key: 'interventions', label: 'Les interventions', multiline: true },
  { key: 'besoins_logistiques', label: 'Besoins Logistiques', multiline: true },
  { key: 'remarques', label: 'Remarques', multiline: true },
]

function emptyForm(): Omit<EventRequestInput, 'club_id'> {
  return {
    objectifs: '',
    date_horaire: '',
    lieu: '',
    plan_evenement: '',
    cibles: '',
    nombre_participants: 0,
    nombre_organisateurs: 0,
    liste_invites: '',
    interventions: '',
    besoins_logistiques: '',
    remarques: '',
  }
}

export function EventRequestForm({ clubId, submittedByProfileId, submittedByName, onSuccess }: Props) {
  const [form, setForm] = useState(emptyForm())
  const [submitting, setSubmitting] = useState(false)

  function setField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const created = await createEventRequest({ club_id: clubId, ...form }, submittedByProfileId, submittedByName)
      toast.success('Demande d\'événement envoyée.')
      notifyAdmin('event_request', form.objectifs || 'Nouvelle demande d\'événement', created.id)
      setForm(emptyForm())
      onSuccess()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible d'envoyer la demande.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card overflow-hidden">
      <div className="bg-gradient-to-r from-brand-600 to-brand-700 px-4 py-3">
        <h2 className="text-center text-sm font-bold uppercase tracking-wide text-white">
          Plan d'Action des Événements
        </h2>
      </div>

      <table className="w-full text-sm">
        <tbody>
          {TEXT_ROWS.map((row, i) => (
            <Row key={row.key} label={row.label} shaded={i % 2 === 1}>
              {row.multiline ? (
                <textarea
                  className="w-full resize-none rounded-lg border-0 bg-transparent px-2 py-1.5 text-sm focus:bg-white focus:ring-2 focus:ring-brand-200"
                  rows={2}
                  value={form[row.key] as string}
                  onChange={(e) => setField(row.key, e.target.value)}
                />
              ) : (
                <input
                  className="w-full rounded-lg border-0 bg-transparent px-2 py-1.5 text-sm focus:bg-white focus:ring-2 focus:ring-brand-200"
                  value={form[row.key] as string}
                  onChange={(e) => setField(row.key, e.target.value)}
                  placeholder={row.key === 'date_horaire' ? 'ex : 10/09/2026 à 14:00' : ''}
                />
              )}
            </Row>
          ))}

          <Row label="Nombre de Participants" shaded={TEXT_ROWS.length % 2 === 1}>
            <input
              type="number"
              min={0}
              className="w-full rounded-lg border-0 bg-transparent px-2 py-1.5 text-sm focus:bg-white focus:ring-2 focus:ring-brand-200"
              value={form.nombre_participants}
              onChange={(e) => setField('nombre_participants', Math.max(0, Number(e.target.value) || 0))}
            />
          </Row>
          <Row label="Nombre des Organisateurs" shaded={(TEXT_ROWS.length + 1) % 2 === 1}>
            <input
              type="number"
              min={0}
              className="w-full rounded-lg border-0 bg-transparent px-2 py-1.5 text-sm focus:bg-white focus:ring-2 focus:ring-brand-200"
              value={form.nombre_organisateurs}
              onChange={(e) => setField('nombre_organisateurs', Math.max(0, Number(e.target.value) || 0))}
            />
          </Row>

          {TEXT_ROWS_AFTER.map((row, i) => (
            <Row key={row.key} label={row.label} shaded={(TEXT_ROWS.length + 2 + i) % 2 === 1}>
              <textarea
                className="w-full resize-none rounded-lg border-0 bg-transparent px-2 py-1.5 text-sm focus:bg-white focus:ring-2 focus:ring-brand-200"
                rows={2}
                value={form[row.key] as string}
                onChange={(e) => setField(row.key, e.target.value)}
              />
            </Row>
          ))}
        </tbody>
      </table>

      <div className="flex justify-end p-4">
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Envoi…' : "Soumettre la demande"}
        </button>
      </div>
    </form>
  )
}

function Row({ label, shaded, children }: { label: string; shaded: boolean; children: React.ReactNode }) {
  return (
    <tr className={shaded ? 'bg-brand-50/60' : 'bg-white'}>
      <td className="w-1/3 min-w-[140px] border-b border-slate-100 px-3 py-2 align-middle text-right text-xs font-bold text-brand-800 sm:text-sm">
        {label}
      </td>
      <td className="border-b border-slate-100 px-2 py-1.5 align-middle">{children}</td>
    </tr>
  )
}
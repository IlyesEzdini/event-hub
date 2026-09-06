import type { EventRequestWithClub } from '@/services/eventRequests'

const FIELDS: { key: keyof EventRequestWithClub; label: string }[] = [
  { key: 'objectifs', label: 'Objectifs' },
  { key: 'date_horaire', label: 'Date & Horaire' },
  { key: 'lieu', label: 'Lieu' },
  { key: 'plan_evenement', label: "Plan de l'événement" },
  { key: 'cibles', label: 'Cibles' },
  { key: 'nombre_participants', label: 'Nombre de Participants' },
  { key: 'nombre_organisateurs', label: 'Nombre des Organisateurs' },
  { key: 'liste_invites', label: 'Liste des Invités' },
  { key: 'interventions', label: 'Les interventions' },
  { key: 'besoins_logistiques', label: 'Besoins Logistiques' },
  { key: 'remarques', label: 'Remarques' },
]

export function EventRequestDetails({ request }: { request: EventRequestWithClub }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-brand-50 px-4 py-3 text-sm">
        <p className="font-semibold text-brand-800">{request.club?.name}</p>
        <p className="text-brand-600">
          Par {request.submitted_by_name} — {new Date(request.submitted_at).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}
        </p>
      </div>
      {FIELDS.map(({ key, label }) => {
        const value = request[key]
        return (
          <div key={key}>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
            <p className="whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
              {value === null || value === undefined || value === '' ? '—' : String(value)}
            </p>
          </div>
        )
      })}
    </div>
  )
}
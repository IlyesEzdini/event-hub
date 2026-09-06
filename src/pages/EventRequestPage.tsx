import { useCallback, useEffect, useState } from 'react'
import { ClipboardList, Eye } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { EventRequestForm } from '@/components/eventRequests/EventRequestForm'
import { listEventRequestsForClub, type EventRequestWithClub } from '@/services/eventRequests'
import { CardSkeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import { EventRequestDetails } from '@/components/eventRequests/EventRequestDetails'

export default function EventRequestPage() {
  const { profile } = useAuth()
  const [requests, setRequests] = useState<EventRequestWithClub[]>([])
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<EventRequestWithClub | null>(null)

  const reload = useCallback(() => {
    if (!profile?.club_id) {
      setLoading(false)
      return
    }
    setLoading(true)
    listEventRequestsForClub(profile.club_id)
      .then(setRequests)
      .finally(() => setLoading(false))
  }, [profile?.club_id])

  useEffect(() => {
    reload()
  }, [reload])

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-2.5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <ClipboardList size={20} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Demande d'Événement</h1>
          <p className="text-sm text-slate-500">{profile?.club?.name}</p>
        </div>
      </div>

      {profile?.club_id ? (
        <EventRequestForm
          clubId={profile.club_id}
          submittedByProfileId={profile.id}
          submittedByName={profile.manager_name}
          onSuccess={reload}
        />
      ) : (
        <div className="card p-6 text-sm text-slate-500">Aucun club associé à votre compte.</div>
      )}

      <div>
        <h2 className="mb-3 text-sm font-bold text-slate-900">Mes demandes précédentes</h2>
        {loading ? (
          <CardSkeleton />
        ) : requests.length === 0 ? (
          <EmptyState icon={ClipboardList} title="Aucune demande envoyée" description="Vos demandes soumises apparaîtront ici." />
        ) : (
          <div className="card overflow-hidden">
            <ul className="divide-y divide-slate-100">
              {requests.map((r) => (
                <li key={r.id} className="flex items-center justify-between px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">{r.objectifs || 'Sans objectif renseigné'}</p>
                    <p className="text-xs text-slate-400">
                      Envoyée le {new Date(r.submitted_at).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>
                  </div>
                  <button
                    onClick={() => setDetail(r)}
                    aria-label="Voir les détails"
                    className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-brand-600"
                  >
                    <Eye size={16} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <Modal open={!!detail} onClose={() => setDetail(null)} title="Détails de la demande">
        {detail && <EventRequestDetails request={detail} />}
      </Modal>
    </div>
  )
}
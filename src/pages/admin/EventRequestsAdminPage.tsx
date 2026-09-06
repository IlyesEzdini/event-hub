import { useEffect, useMemo, useState } from 'react'
import { ClipboardList, Eye, Users2 } from 'lucide-react'
import { useClubs } from '@/hooks/useClubs'
import { listAllEventRequests, type EventRequestWithClub } from '@/services/eventRequests'
import { CardSkeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import { EventRequestDetails } from '@/components/eventRequests/EventRequestDetails'

export default function EventRequestsAdminPage() {
  const { clubs } = useClubs()
  const [requests, setRequests] = useState<EventRequestWithClub[]>([])
  const [loading, setLoading] = useState(true)
  const [clubFilter, setClubFilter] = useState('all')
  const [detail, setDetail] = useState<EventRequestWithClub | null>(null)

  useEffect(() => {
    listAllEventRequests()
      .then(setRequests)
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    if (clubFilter === 'all') return requests
    return requests.filter((r) => r.club_id === clubFilter)
  }, [requests, clubFilter])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2.5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <ClipboardList size={20} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Demandes d'Événements</h1>
          <p className="text-sm text-slate-500">Toutes les demandes envoyées par les clubs</p>
        </div>
      </div>

      <div className="card grid grid-cols-1 gap-3 p-4 sm:grid-cols-3 sm:p-5">
        <div>
          <label className="label">Club</label>
          <select className="input" value={clubFilter} onChange={(e) => setClubFilter(e.target.value)}>
            <option value="all">Tous les clubs</option>
            {clubs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card p-4">
          <div className="mb-1.5 flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 text-brand-600">
            <Users2 size={16} />
          </div>
          <p className="text-xs font-semibold text-slate-400">
            {clubFilter === 'all' ? 'Total des demandes' : 'Demandes pour ce club'}
          </p>
          <p className="text-xl font-bold text-slate-900">{filtered.length}</p>
        </div>
      </div>

      {loading ? (
        <CardSkeleton />
      ) : filtered.length === 0 ? (
        <EmptyState icon={ClipboardList} title="Aucune demande" description="Aucune demande d'événement pour cette sélection." />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/70 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3">Club</th>
                <th className="px-4 py-3">Soumise par</th>
                <th className="px-4 py-3">Date d'envoi</th>
                <th className="hidden px-4 py-3 md:table-cell">Objectifs</th>
                <th className="hidden px-4 py-3 lg:table-cell">Lieu</th>
                <th className="px-4 py-3 text-right">Détails</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 font-medium text-slate-800">{r.club?.name}</td>
                  <td className="px-4 py-3 text-slate-600">{r.submitted_by_name}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {new Date(r.submitted_at).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}
                  </td>
                  <td className="hidden max-w-[220px] truncate px-4 py-3 text-slate-500 md:table-cell">
                    {r.objectifs || '—'}
                  </td>
                  <td className="hidden px-4 py-3 text-slate-500 lg:table-cell">{r.lieu || '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setDetail(r)}
                      aria-label="Voir les détails"
                      className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-brand-600"
                    >
                      <Eye size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!detail} onClose={() => setDetail(null)} title="Détails de la demande">
        {detail && <EventRequestDetails request={detail} />}
      </Modal>
    </div>
  )
}
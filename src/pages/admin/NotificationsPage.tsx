import { useEffect, useState } from 'react'
import { Bell, Calendar, FileText, ClipboardList, CheckCircle2, Clock } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { listNotifications, confirmNotification, type AdminNotification } from '@/services/notifications'
import { CardSkeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'

const ACTION_META: Record<AdminNotification['action_type'], { label: string; icon: typeof Calendar; color: string }> = {
  event: { label: 'Nouvel événement', icon: Calendar, color: 'bg-brand-50 text-brand-600' },
  report: { label: 'Rapport soumis', icon: FileText, color: 'bg-emerald-50 text-emerald-600' },
  event_request: { label: "Demande d'événement", icon: ClipboardList, color: 'bg-amber-50 text-amber-600' },
}

type Filter = 'all' | 'pending' | 'confirmed'

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<AdminNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('all')
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  function reload() {
    setLoading(true)
    listNotifications()
      .then(setNotifications)
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    reload()
  }, [])

  const filtered = notifications.filter((n) => filter === 'all' || n.status === filter)
  const pendingCount = notifications.filter((n) => n.status === 'pending').length

  async function handleConfirm(id: string) {
    setConfirmingId(id)
    try {
      await confirmNotification(id)
      toast.success('Confirmé — un email a été envoyé au manager.')
      reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Impossible de confirmer cette notification.')
    } finally {
      setConfirmingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <Bell size={20} />
            {pendingCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">
                {pendingCount > 99 ? '99+' : pendingCount}
              </span>
            )}
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Notifications</h1>
            <p className="text-sm text-slate-500">
              {pendingCount} en attente de confirmation sur {notifications.length}
            </p>
          </div>
        </div>

        <div className="flex gap-1 rounded-xl bg-slate-100 p-1 text-xs font-semibold">
          {(['all', 'pending', 'confirmed'] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-1.5 transition-colors ${
                filter === f ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {f === 'all' ? 'Toutes' : f === 'pending' ? 'En attente' : 'Confirmées'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <CardSkeleton />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Bell} title="Aucune notification" description="Les actions des managers apparaîtront ici." />
      ) : (
        <div className="space-y-3">
          {filtered.map((n) => {
            const meta = ACTION_META[n.action_type]
            const Icon = meta.icon
            return (
              <div
                key={n.id}
                className={`card flex flex-col gap-3 p-4 sm:flex-row sm:items-start ${
                  n.status === 'pending' ? 'ring-1 ring-brand-100' : ''
                }`}
              >
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${meta.color}`}>
                  <Icon size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900">{meta.label}</p>
                    {n.status === 'pending' ? (
                      <span className="badge bg-amber-50 text-amber-700 ring-1 ring-amber-200">
                        <Clock size={11} /> En attente
                      </span>
                    ) : (
                      <span className="badge bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
                        <CheckCircle2 size={11} /> Confirmée
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-slate-600">
                    <strong className="font-semibold text-slate-800">{n.manager_name}</strong> — {n.club_name}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">{n.summary}</p>
                  <p className="mt-1.5 text-xs text-slate-400">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: fr })}
                  </p>
                </div>
                {n.status === 'pending' && (
                  <button
                    onClick={() => handleConfirm(n.id)}
                    disabled={confirmingId === n.id}
                    className="btn-primary shrink-0 self-start text-xs"
                  >
                    {confirmingId === n.id ? 'Envoi…' : 'Confirmer'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
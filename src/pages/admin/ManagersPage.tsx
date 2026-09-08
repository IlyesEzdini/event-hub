import { useState, type FormEvent } from 'react'
import toast from 'react-hot-toast'
import { Users, Plus, Pencil, KeyRound, Ban, CheckCircle2 } from 'lucide-react'
import { useManagers } from '@/hooks/useManagers'
import { useClubs } from '@/hooks/useClubs'
import { createManager, replaceOrUpdateManager, updateManagerCredentials, setManagerActive } from '@/services/managers'
import { findOrCreateClub } from '@/services/clubs'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { TableRowSkeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import type { ProfileWithClub } from '@/types/database'

type Modal_ = 'add' | 'edit' | 'credentials' | null

export default function ManagersPage() {
  const { managers, loading, reload } = useManagers()
  const { clubs, reload: reloadClubs } = useClubs()
  const [modal, setModal] = useState<Modal_>(null)
  const [active, setActive] = useState<ProfileWithClub | null>(null)
  const [toggleTarget, setToggleTarget] = useState<ProfileWithClub | null>(null)

  function openAdd() {
    setActive(null)
    setModal('add')
  }
  function openEdit(m: ProfileWithClub) {
    setActive(m)
    setModal('edit')
  }
  function openCredentials(m: ProfileWithClub) {
    setActive(m)
    setModal('credentials')
  }
  function closeModal() {
    setModal(null)
    setActive(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <Users size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Managers</h1>
            <p className="text-sm text-slate-500">{managers.length} accounts across {clubs.length} clubs</p>
          </div>
        </div>
        <button className="btn-primary" onClick={openAdd}>
          <Plus size={16} /> Add Manager
        </button>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <table className="w-full">
            <tbody>
              <TableRowSkeleton cols={5} />
              <TableRowSkeleton cols={5} />
              <TableRowSkeleton cols={5} />
            </tbody>
          </table>
        ) : managers.length === 0 ? (
          <div className="p-6">
            <EmptyState icon={Users} title="No managers yet" description="Add your first event manager to get started." />
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <table className="hidden w-full text-sm sm:table">
              <thead className="border-b border-slate-100 bg-slate-50/70 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3">Manager</th>
                  <th className="px-4 py-3">Club</th>
                  <th className="px-4 py-3">Username</th>
                  <th className="hidden px-4 py-3 lg:table-cell">Phone</th>
                  <th className="hidden px-4 py-3 lg:table-cell">Email</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {managers.map((m) => (
                  <tr key={m.id}>
                    <td className="px-4 py-3 font-medium text-slate-800">{m.manager_name}</td>
                    <td className="px-4 py-3 text-slate-600">{m.club?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{m.username}</td>
                    <td className="hidden px-4 py-3 text-slate-600 lg:table-cell">{m.phone_number ?? '—'}</td>
                    <td className="hidden px-4 py-3 text-slate-600 lg:table-cell">{m.email ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${m.is_active ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-slate-100 text-slate-500 ring-1 ring-slate-200'}`}>
                        {m.is_active ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <IconAction label="Edit" onClick={() => openEdit(m)} icon={Pencil} />
                        <IconAction label="Change password" onClick={() => openCredentials(m)} icon={KeyRound} />
                        <IconAction
                          label={m.is_active ? 'Disable' : 'Enable'}
                          onClick={() => setToggleTarget(m)}
                          icon={m.is_active ? Ban : CheckCircle2}
                          danger={m.is_active}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile cards */}
            <ul className="divide-y divide-slate-100 sm:hidden">
              {managers.map((m) => (
                <li key={m.id} className="p-4">
                  <div className="mb-2 flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{m.manager_name}</p>
                      <p className="text-xs text-slate-500">{m.club?.name ?? '—'} · @{m.username}</p>
                      {(m.phone_number || m.email) && (
                        <p className="mt-0.5 text-xs text-slate-400">
                          {[m.phone_number, m.email].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                    <span className={`badge ${m.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {m.is_active ? 'Active' : 'Disabled'}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button className="btn-secondary flex-1 text-xs" onClick={() => openEdit(m)}>
                      Edit
                    </button>
                    <button className="btn-secondary flex-1 text-xs" onClick={() => openCredentials(m)}>
                      Password
                    </button>
                    <button
                      className={`btn-secondary flex-1 text-xs ${m.is_active ? 'text-rose-600' : 'text-emerald-600'}`}
                      onClick={() => setToggleTarget(m)}
                    >
                      {m.is_active ? 'Disable' : 'Enable'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <Modal open={modal === 'add'} onClose={closeModal} title="Add Manager">
        <AddManagerForm
          clubs={clubs}
          onCreated={() => {
            closeModal()
            reload()
            reloadClubs()
          }}
        />
      </Modal>

      <Modal open={modal === 'edit'} onClose={closeModal} title="Edit / Replace Manager">
        {active && (
          <EditManagerForm
            manager={active}
            clubs={clubs}
            onSaved={() => {
              closeModal()
              reload()
            }}
          />
        )}
      </Modal>

      <Modal open={modal === 'credentials'} onClose={closeModal} title="Change Credentials" maxWidth="max-w-sm">
        {active && (
          <CredentialsForm
            manager={active}
            onSaved={() => {
              closeModal()
            }}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={!!toggleTarget}
        onClose={() => setToggleTarget(null)}
        onConfirm={async () => {
          if (!toggleTarget) return
          try {
            await setManagerActive(toggleTarget.id, !toggleTarget.is_active)
            toast.success(toggleTarget.is_active ? 'Manager disabled.' : 'Manager enabled.')
            setToggleTarget(null)
            reload()
          } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Unable to update this account.')
          }
        }}
        title={toggleTarget?.is_active ? 'Disable manager?' : 'Enable manager?'}
        message={
          toggleTarget?.is_active
            ? `${toggleTarget?.manager_name} will no longer be able to sign in. Their club's historical data is unaffected.`
            : `${toggleTarget?.manager_name} will be able to sign in again.`
        }
        confirmLabel={toggleTarget?.is_active ? 'Disable' : 'Enable'}
        danger={!!toggleTarget?.is_active}
      />
    </div>
  )
}

function IconAction({
  label,
  onClick,
  icon: Icon,
  danger = false,
}: {
  label: string
  onClick: () => void
  icon: typeof Pencil
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`rounded-lg p-2 text-slate-400 hover:bg-slate-100 ${danger ? 'hover:text-rose-600' : 'hover:text-brand-600'}`}
    >
      <Icon size={15} />
    </button>
  )
}

function AddManagerForm({ clubs, onCreated }: { clubs: { id: string; name: string }[]; onCreated: () => void }) {
  const [managerName, setManagerName] = useState('')
  const [clubMode, setClubMode] = useState<'existing' | 'new'>('existing')
  const [clubId, setClubId] = useState('')
  const [newClubName, setNewClubName] = useState('')
  const [username, setUsername] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!managerName.trim() || !username.trim() || password.length < 6) {
      setError('Name and username are required; password must be at least 6 characters.')
      return
    }
    if (clubMode === 'existing' && !clubId) {
      setError('Please select a club.')
      return
    }
    if (clubMode === 'new' && !newClubName.trim()) {
      setError('Please enter the new club name.')
      return
    }
    setSubmitting(true)
    try {
      const resolvedClubId = clubMode === 'existing' ? clubId : (await findOrCreateClub(newClubName)).id
      await createManager({
        manager_name: managerName.trim(),
        username: username.trim(),
        password,
        club_id: resolvedClubId,
        phone_number: phoneNumber.trim() || undefined,
        email: contactEmail.trim() || undefined,
      })
      toast.success('Manager added successfully.')
      onCreated()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to create this manager.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      <div>
        <label className="label">Manager Name</label>
        <input className="input" value={managerName} onChange={(e) => setManagerName(e.target.value)} placeholder="Ahmed Ben Ali" />
      </div>

      <div>
        <label className="label">Club</label>
        <div className="mb-2 flex gap-2 text-xs font-semibold">
          <button type="button" onClick={() => setClubMode('existing')} className={`rounded-lg px-3 py-1.5 ${clubMode === 'existing' ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-500'}`}>
            Existing club
          </button>
          <button type="button" onClick={() => setClubMode('new')} className={`rounded-lg px-3 py-1.5 ${clubMode === 'new' ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-500'}`}>
            New club
          </button>
        </div>
        {clubMode === 'existing' ? (
          <select className="input" value={clubId} onChange={(e) => setClubId(e.target.value)}>
            <option value="">Select a club…</option>
            {clubs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        ) : (
          <input className="input" value={newClubName} onChange={(e) => setNewClubName(e.target.value)} placeholder="Club Delta" />
        )}
      </div>

      <div>
        <label className="label">Username</label>
        <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="ahmed" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Phone Number</label>
          <input className="input" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="+216 XX XXX XXX" />
        </div>
        <div>
          <label className="label">Email</label>
          <input type="email" className="input" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="ahmed@example.com" />
        </div>
      </div>

      <div>
        <label className="label">Initial Password</label>
        <input type="text" className="input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Creating…' : 'Create manager'}
        </button>
      </div>
    </form>
  )
}

function EditManagerForm({
  manager,
  clubs,
  onSaved,
}: {
  manager: ProfileWithClub
  clubs: { id: string; name: string }[]
  onSaved: () => void
}) {
  const [managerName, setManagerName] = useState(manager.manager_name)
  const [username, setUsername] = useState(manager.username)
  const [phoneNumber, setPhoneNumber] = useState(manager.phone_number ?? '')
  const [contactEmail, setContactEmail] = useState(manager.email ?? '')
  const [clubId, setClubId] = useState(manager.club_id ?? '')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await replaceOrUpdateManager({
        profile_id: manager.id,
        manager_name: managerName.trim(),
        username: username.trim(),
        club_id: clubId || undefined,
        phone_number: phoneNumber.trim(),
        email: contactEmail.trim(),
      })
      toast.success('Manager updated successfully.')
      onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to update this manager.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="rounded-xl bg-brand-50 px-3 py-2 text-xs text-brand-700">
        Replacing the manager keeps all of this club's events and reports intact — only the assigned person changes.
      </p>
      <div>
        <label className="label">Manager Name</label>
        <input className="input" value={managerName} onChange={(e) => setManagerName(e.target.value)} />
      </div>
      <div>
        <label className="label">Club</label>
        <select className="input" value={clubId} onChange={(e) => setClubId(e.target.value)}>
          {clubs.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Username</label>
        <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Phone Number</label>
          <input className="input" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="+216 XX XXX XXX" />
        </div>
        <div>
          <label className="label">Email</label>
          <input type="email" className="input" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="ahmed@example.com" />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  )
}

function CredentialsForm({ manager, onSaved }: { manager: ProfileWithClub; onSaved: () => void }) {
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      await updateManagerCredentials(manager.id, password)
      toast.success(`Password updated for ${manager.manager_name}.`)
      onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to update credentials.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      <p className="text-sm text-slate-500">
        Set a new password for <strong>{manager.manager_name}</strong> ({manager.username}).
      </p>
      <div>
        <label className="label">New password</label>
        <input type="text" className="input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Updating…' : 'Update password'}
        </button>
      </div>
    </form>
  )
}
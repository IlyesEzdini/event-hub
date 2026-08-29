import { useState, type FormEvent } from 'react'
import toast from 'react-hot-toast'
import { UserCircle, Lock } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

export default function ProfilePage() {
  const { profile, signOut } = useAuth()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setSubmitting(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
      if (updateError) throw updateError
      toast.success('Password updated.')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to update password.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="flex items-center gap-2.5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <UserCircle size={20} />
        </div>
        <h1 className="text-xl font-bold text-slate-900">Profile</h1>
      </div>

      <div className="card p-5 sm:p-6">
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Name</dt>
            <dd className="mt-1 text-sm font-medium text-slate-800">{profile?.manager_name}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Username</dt>
            <dd className="mt-1 text-sm font-medium text-slate-800">{profile?.username}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Role</dt>
            <dd className="mt-1 text-sm font-medium capitalize text-slate-800">{profile?.role}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Club</dt>
            <dd className="mt-1 text-sm font-medium text-slate-800">{profile?.club?.name ?? '—'}</dd>
          </div>
        </dl>
      </div>

      <div className="card p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <Lock size={16} className="text-slate-400" />
          <h2 className="text-sm font-bold text-slate-900">Change Password</h2>
        </div>
        <form onSubmit={handleChangePassword} className="space-y-4">
          {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
          <div>
            <label className="label">New password</label>
            <input type="password" className="input" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <div>
            <label className="label">Confirm new password</label>
            <input type="password" className="input" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </div>
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </div>

      <button className="btn-secondary w-full text-rose-600 sm:hidden" onClick={signOut}>
        Log out
      </button>
    </div>
  )
}

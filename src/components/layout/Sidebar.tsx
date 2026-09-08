import { NavLink } from 'react-router-dom'
import { CalendarClock, LogOut } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { usePendingNotificationsCount } from '@/hooks/useNotifications'
import { managerNav, adminNav } from './navConfig'

export function Sidebar() {
  const { profile, signOut } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const items = isAdmin ? adminNav : managerNav
  const { count: pendingCount } = usePendingNotificationsCount(isAdmin)

  return (
    <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 border-r border-slate-200 bg-white">
      <div className="flex items-center gap-2.5 px-6 py-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-soft">
          <CalendarClock size={18} />
        </div>
        <div>
          <p className="text-sm font-bold tracking-tight text-slate-900">EventHub</p>
          <p className="text-[11px] font-medium text-slate-400">Club Coordination</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`
            }
          >
            <item.icon size={18} strokeWidth={2} />
            {item.label}
            {item.to === '/admin/notifications' && pendingCount > 0 && (
              <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                {pendingCount > 99 ? '99+' : pendingCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-slate-100 p-4">
        <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-sm font-bold text-white">
            {profile?.manager_name?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-800">{profile?.manager_name}</p>
            <p className="truncate text-xs text-slate-500">
              {profile?.role === 'admin' ? 'Administrator' : profile?.club?.name ?? 'No club'}
            </p>
          </div>
          <button
            onClick={signOut}
            aria-label="Log out"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-rose-600"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  )
}
import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { CalendarClock, LogOut, Menu, X } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { usePendingNotificationsCount } from '@/hooks/useNotifications'
import { managerNav, adminNav } from './navConfig'

export function MobileTopbar() {
  const [open, setOpen] = useState(false)
  const { profile, signOut } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const items = isAdmin ? adminNav : managerNav
  const { count: pendingCount } = usePendingNotificationsCount(isAdmin)

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-white">
            <CalendarClock size={16} />
          </div>
          <span className="text-sm font-bold text-slate-900">EventHub</span>
        </div>
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
        >
          <Menu size={20} />
        </button>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-72 max-w-[85%] bg-white shadow-2xl animate-[slideUp_0.2s_ease-out] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <span className="text-sm font-bold text-slate-900">Menu</span>
              <button onClick={() => setOpen(false)} aria-label="Close menu" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>

            <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-sm font-bold text-white">
                {profile?.manager_name?.[0]?.toUpperCase() ?? '?'}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-800">{profile?.manager_name}</p>
                <p className="truncate text-xs text-slate-500">
                  {profile?.role === 'admin' ? 'Administrator' : profile?.club?.name ?? 'No club'}
                </p>
              </div>
            </div>

            <nav className="flex-1 space-y-1 px-3 py-3">
              {items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium ${
                      isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'
                    }`
                  }
                >
                  <item.icon size={18} />
                  {item.label}
                  {item.to === '/admin/notifications' && pendingCount > 0 && (
                    <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                      {pendingCount > 99 ? '99+' : pendingCount}
                    </span>
                  )}
                </NavLink>
              ))}
            </nav>

            <div className="p-4 border-t border-slate-100">
              <button onClick={signOut} className="btn-secondary w-full text-rose-600">
                <LogOut size={16} /> Log out
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomTabBar items={items.slice(0, 4)} pendingCount={pendingCount} />
    </>
  )
}

function BottomTabBar({ items, pendingCount }: { items: typeof managerNav; pendingCount: number }) {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 flex border-t border-slate-200 bg-white/95 backdrop-blur lg:hidden pb-[env(safe-area-inset-bottom)]">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            `relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${
              isActive ? 'text-brand-600' : 'text-slate-400'
            }`
          }
        >
          <span className="relative">
            <item.icon size={20} />
            {item.to === '/admin/notifications' && pendingCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-rose-500 text-[8px] font-bold text-white">
                {pendingCount > 9 ? '9+' : pendingCount}
              </span>
            )}
          </span>
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}
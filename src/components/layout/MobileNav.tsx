import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { CalendarClock, LogOut, Menu, X } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { usePendingNotificationsCount } from '@/hooks/useNotifications'
import { managerNav, adminNav, deanNav, coordinatorNav } from './navConfig'

export function MobileTopbar() {
  const [open, setOpen] = useState(false)
  const { profile, signOut } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const items = isAdmin
    ? adminNav
    : profile?.role === 'dean'
      ? deanNav
      : profile?.role === 'coordinator'
        ? coordinatorNav
        : managerNav
  const { count: pendingCount } = usePendingNotificationsCount(isAdmin)

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-800 bg-[#10192f]/95 px-4 py-3 text-white shadow-lg shadow-slate-950/10 backdrop-blur lg:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#5575ff] to-[#3546e8] text-white shadow-md shadow-blue-950/30">
            <CalendarClock size={16} />
          </div>
          <span className="text-sm font-extrabold tracking-tight text-white">EventHub</span>
        </div>
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="rounded-lg p-2 text-slate-300 transition hover:bg-white/10 hover:text-white"
        >
          <Menu size={20} />
        </button>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-950/65 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-72 max-w-[85%] bg-[#10192f] text-white shadow-2xl shadow-slate-950/40 animate-[slideUp_0.2s_ease-out] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08]">
              <span className="text-sm font-bold text-white">Menu</span>
              <button onClick={() => setOpen(false)} aria-label="Close menu" className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.08]">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-sm font-bold text-white">
                {profile?.manager_name?.[0]?.toUpperCase() ?? '?'}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{profile?.manager_name}</p>
                <p className="truncate text-xs text-slate-400">
                  {profile?.role === 'admin' ? 'Administrator' : profile?.role === 'dean' ? 'Dean' : profile?.role === 'coordinator' ? `Coordinator · ${profile.field}` : profile?.club?.name ?? 'No club'}
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
                      isActive ? 'bg-gradient-to-r from-[#243b75] to-[#1a2a50] text-white' : 'text-slate-300 hover:bg-white/[0.07] hover:text-white'
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

            <div className="p-4 border-t border-white/[0.08]">
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
    <nav className="fixed bottom-0 inset-x-0 z-30 flex border-t border-slate-800 bg-[#10192f]/95 text-white shadow-[0_-8px_24px_rgba(2,6,23,0.15)] backdrop-blur lg:hidden pb-[env(safe-area-inset-bottom)]">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            `relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${
              isActive ? 'text-[#91a8ff]' : 'text-slate-400'
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
import { NavLink } from 'react-router-dom'
import { CalendarClock, LogOut } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { usePendingNotificationsCount } from '@/hooks/useNotifications'
import { managerNav, adminNav, deanNav, coordinatorNav } from './navConfig'

export function Sidebar() {
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
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col overflow-hidden border-r border-slate-800/80 bg-[#10192f] text-white lg:flex">
      <div className="pointer-events-none absolute -bottom-20 -left-24 h-72 w-72 rounded-full bg-blue-600/10 blur-3xl" />
      <div className="relative flex items-center gap-3 px-6 py-7">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#5575ff] to-[#3546e8] text-white shadow-lg shadow-blue-950/30 ring-1 ring-white/15">
          <CalendarClock size={21} strokeWidth={2.2} />
        </div>
        <div className="min-w-0">
          <p className="text-[16px] font-extrabold tracking-tight text-white">EventHub</p>
          <p className="mt-0.5 text-[11px] font-medium tracking-wide text-slate-400">Club Coordination</p>
        </div>
      </div>

      <nav className="relative flex-1 space-y-1.5 overflow-y-auto px-3 py-3">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `group relative flex items-center gap-3 overflow-hidden rounded-xl px-3.5 py-3 text-[13px] font-semibold transition-all duration-200 ${
                isActive
                  ? 'bg-gradient-to-r from-[#243b75] to-[#1a2a50] text-white shadow-lg shadow-slate-950/15 before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-r-full before:bg-[#6488ff]'
                  : 'text-slate-300 hover:bg-white/[0.07] hover:text-white'
              }`
            }
          >
            <item.icon className="shrink-0" size={18} strokeWidth={2} />
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            {item.to === '/admin/notifications' && pendingCount > 0 && (
              <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-sm shadow-rose-950/30">
                {pendingCount > 99 ? '99+' : pendingCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="relative mt-auto border-t border-white/[0.08] p-4">
        <div className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-slate-950/25 p-3 transition-colors hover:bg-white/[0.05]">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#7290ff] to-[#4053ed] text-sm font-bold text-white shadow-md shadow-blue-950/30 ring-2 ring-white/10">
            {profile?.manager_name?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-bold text-white">{profile?.manager_name}</p>
            <p className="mt-0.5 truncate text-[11px] text-slate-400">
              {profile?.role === 'admin' ? 'Administrator' : profile?.role === 'dean' ? 'Dean' : profile?.role === 'coordinator' ? `Coordinator · ${profile.field}` : profile?.club?.name ?? 'No club'}
            </p>
          </div>
          <button
            onClick={signOut}
            aria-label="Log out"
            title="Log out"
            className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-500/10 hover:text-rose-300"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  )
}

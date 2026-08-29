import { Outlet } from 'react-router-dom'
import { Sidebar } from '@/components/layout/Sidebar'
import { MobileTopbar } from '@/components/layout/MobileNav'

export function AppLayout() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />
      <MobileTopbar />
      <div className="lg:pl-64">
        <main className="mx-auto max-w-6xl px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:py-8 lg:pb-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

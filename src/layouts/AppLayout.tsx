import { Outlet } from 'react-router-dom'
import { Sidebar } from '@/components/layout/Sidebar'
import { MobileTopbar } from '@/components/layout/MobileNav'

export function AppLayout() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />
      <MobileTopbar />

      <div className="lg:pl-64">
        <main className="w-full px-4 py-4 pb-24 sm:px-5 lg:px-6 lg:py-6 lg:pb-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
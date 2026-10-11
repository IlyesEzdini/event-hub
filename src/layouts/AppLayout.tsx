import { Outlet } from 'react-router-dom'
import { Sidebar } from '@/components/layout/Sidebar'
import { MobileTopbar } from '@/components/layout/MobileNav'

export function AppLayout() {
  return (
    <div className="min-h-screen bg-[#f3f6fc] text-slate-900">
      <Sidebar />
      <MobileTopbar />
      <div className="min-w-0 lg:pl-64">
        <main className="min-w-0 w-full px-4 py-5 pb-24 sm:px-6 lg:px-8 lg:py-8 lg:pb-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

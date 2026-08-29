import {
  LayoutDashboard,
  CalendarDays,
  FileText,
  Users,
  Building2,
  FolderOpen,
  Settings,
  UserCircle,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  label: string
  to: string
  icon: LucideIcon
}

export const managerNav: NavItem[] = [
  { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
  { label: 'Calendar', to: '/calendar', icon: CalendarDays },
  { label: 'My Report', to: '/reports', icon: FileText },
  { label: 'Resources', to: '/resources', icon: FolderOpen },
  { label: 'Profile', to: '/profile', icon: UserCircle },
]

export const adminNav: NavItem[] = [
  { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
  { label: 'Calendar', to: '/calendar', icon: CalendarDays },
  { label: 'Reports', to: '/admin/reports', icon: FileText },
  { label: 'Managers', to: '/admin/managers', icon: Users },
  { label: 'Clubs', to: '/admin/clubs', icon: Building2 },
  { label: 'Resources', to: '/resources', icon: FolderOpen },
  { label: 'Settings', to: '/profile', icon: Settings },
]

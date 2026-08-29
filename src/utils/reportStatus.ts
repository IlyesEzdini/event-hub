import type { Report } from '@/types/database'

export type ReportStatusLabel = 'Not Started' | 'Draft' | 'Submitted' | 'Overdue'

/**
 * Determines the display status for the CURRENT month's report.
 * - Submitted: report exists and status === 'submitted'
 * - Draft: report exists but status === 'draft'
 * - Overdue: no report (or draft) AND we're past the last day of that month
 * - Not Started: no report yet, but the month isn't over
 */
export function getCurrentMonthStatus(report: Report | null, month: number, year: number): ReportStatusLabel {
  const now = new Date()
  const monthEnd = new Date(year, month, 0, 23, 59, 59) // last day of `month`
  const monthHasEnded = now > monthEnd

  if (report?.status === 'submitted') return 'Submitted'
  if (report?.status === 'draft') return monthHasEnded ? 'Overdue' : 'Draft'
  return monthHasEnded ? 'Overdue' : 'Not Started'
}

export function statusColor(status: ReportStatusLabel): string {
  switch (status) {
    case 'Submitted':
      return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
    case 'Draft':
      return 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
    case 'Overdue':
      return 'bg-rose-50 text-rose-700 ring-1 ring-rose-200'
    default:
      return 'bg-slate-100 text-slate-600 ring-1 ring-slate-200'
  }
}

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export function getCurrentMonthYear(): { month: number; year: number } {
  const now = new Date()
  return { month: now.getMonth() + 1, year: now.getFullYear() }
}

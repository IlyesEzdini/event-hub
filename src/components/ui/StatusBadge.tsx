import { statusColor, type ReportStatusLabel } from '@/utils/reportStatus'

export function StatusBadge({ status }: { status: ReportStatusLabel }) {
  return <span className={`badge ${statusColor(status)}`}>{status}</span>
}

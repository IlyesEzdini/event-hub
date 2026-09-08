import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react'
import { listReportsForClubYear, upsertReport } from '@/services/reports'
import { notifyAdmin } from '@/services/notifications'
import { getAcademicMonths, getAcademicYearStart, isCurrentAcademicMonth } from '@/utils/academicYear'

type RowKey = 'members' | 'active_members' | 'events' | 'meetings' | 'evaluation' | 'remarks'

const ROWS: { key: RowKey; label: string; numeric: boolean }[] = [
  { key: 'members', label: 'Nombre des membres', numeric: true },
  { key: 'active_members', label: 'Nombre des membres actifs', numeric: true },
  { key: 'events', label: 'Les événements réalisés', numeric: true },
  { key: 'meetings', label: 'Nombre des réunions réalisées', numeric: true },
  { key: 'evaluation', label: 'Évaluation', numeric: false },
  { key: 'remarks', label: 'Remarques', numeric: false },
]

interface CellState {
  members: number
  active_members: number
  events: number
  meetings: number
  evaluation: string
  remarks: string
  status: 'draft' | 'submitted' | null
}

function emptyCell(): CellState {
  return { members: 0, active_members: 0, events: 0, meetings: 0, evaluation: '', remarks: '', status: null }
}

function cellKey(month: number, year: number) {
  return `${year}-${month}`
}

export function YearlyReportSheet({
  clubId,
  createdByProfileId,
  readOnly = false,
}: {
  clubId: string
  createdByProfileId: string | null
  readOnly?: boolean
}) {
  const [academicStartYear, setAcademicStartYear] = useState(getAcademicYearStart())
  const [cells, setCells] = useState<Record<string, CellState>>({})
  const [loading, setLoading] = useState(true)
  const [savingDraft, setSavingDraft] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const months = useMemo(() => getAcademicMonths(academicStartYear), [academicStartYear])

  useEffect(() => {
    let mounted = true
    setLoading(true)
    listReportsForClubYear(clubId, academicStartYear)
      .then((reports) => {
        if (!mounted) return
        const map: Record<string, CellState> = {}
        for (const m of months) {
          map[cellKey(m.month, m.year)] = emptyCell()
        }
        for (const r of reports) {
          map[cellKey(r.month, r.year)] = {
            members: r.members,
            active_members: r.active_members,
            events: r.events,
            meetings: r.meetings,
            evaluation: r.evaluation ?? '',
            remarks: r.remarks ?? '',
            status: r.status,
          }
        }
        setCells(map)
      })
      .catch(() => toast.error('Impossible de charger la fiche de suivi.'))
      .finally(() => mounted && setLoading(false))
    return () => {
      mounted = false
    }
    // months is derived from academicStartYear, safe to omit from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId, academicStartYear])

  function updateCell(month: number, year: number, key: RowKey, value: string) {
    const k = cellKey(month, year)
    setCells((prev) => {
      const current = prev[k] ?? emptyCell()
      const next: CellState = { ...current }
      if (key === 'evaluation' || key === 'remarks') {
        next[key] = value
      } else {
        next[key] = Math.max(0, Number(value) || 0)
      }
      return { ...prev, [k]: next }
    })
  }

  function isLocked(month: number, year: number) {
    return readOnly || cells[cellKey(month, year)]?.status === 'submitted'
  }

  async function handleSaveDraft() {
    setSavingDraft(true)
    try {
      for (const m of months) {
        const cell = cells[cellKey(m.month, m.year)]
        if (!cell || cell.status === 'submitted') continue
        await upsertReport(
          {
            club_id: clubId,
            month: m.month,
            year: m.year,
            members: cell.members,
            active_members: cell.active_members,
            events: cell.events,
            meetings: cell.meetings,
            evaluation: cell.evaluation || null,
            remarks: cell.remarks || null,
            status: 'draft',
          },
          createdByProfileId,
        )
      }
      toast.success('Fiche enregistrée comme brouillon.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible d'enregistrer la fiche.")
    } finally {
      setSavingDraft(false)
    }
  }

  async function handleSubmitCurrentMonth() {
    const current = months.find((m) => isCurrentAcademicMonth(m.month, m.year))
    if (!current) return
    const cell = cells[cellKey(current.month, current.year)] ?? emptyCell()
    setSubmitting(true)
    try {
      const saved = await upsertReport(
        {
          club_id: clubId,
          month: current.month,
          year: current.year,
          members: cell.members,
          active_members: cell.active_members,
          events: cell.events,
          meetings: cell.meetings,
          evaluation: cell.evaluation || null,
          remarks: cell.remarks || null,
          status: 'submitted',
        },
        createdByProfileId,
      )
      setCells((prev) => ({ ...prev, [cellKey(current.month, current.year)]: { ...cell, status: 'submitted' } }))
      toast.success(`Rapport de ${current.label} soumis.`)
      notifyAdmin('report', current.label, saved.id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Impossible de soumettre ce mois.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="card p-6 text-sm text-slate-400">Chargement de la fiche…</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setAcademicStartYear((y) => y - 1)}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
            aria-label="Année précédente"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-semibold text-slate-700">
            Année {academicStartYear}–{academicStartYear + 1}
          </span>
          <button
            onClick={() => setAcademicStartYear((y) => y + 1)}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
            aria-label="Année suivante"
          >
            <ChevronRight size={16} />
          </button>
        </div>
        {!readOnly && (
          <div className="flex gap-2">
            <button onClick={handleSaveDraft} disabled={savingDraft} className="btn-secondary text-xs">
              {savingDraft ? 'Enregistrement…' : 'Enregistrer le brouillon'}
            </button>
            <button onClick={handleSubmitCurrentMonth} disabled={submitting} className="btn-primary text-xs">
              {submitting ? 'Envoi…' : 'Soumettre le mois en cours'}
            </button>
          </div>
        )}
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[1100px] border-collapse text-sm">
          <thead>
            <tr className="bg-gradient-to-r from-brand-600 to-brand-700 text-white">
              <th className="sticky left-0 z-10 min-w-[190px] border border-brand-500/40 bg-brand-700 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide">
                Fiche de suivi
              </th>
              {months.map((m) => (
                <th
                  key={cellKey(m.month, m.year)}
                  className={`min-w-[110px] border border-brand-500/40 px-2 py-2.5 text-xs font-bold ${
                    isCurrentAcademicMonth(m.month, m.year) ? 'bg-brand-800' : ''
                  }`}
                >
                  <div className="flex items-center justify-center gap-1">
                    {m.label}
                    {cells[cellKey(m.month, m.year)]?.status === 'submitted' && (
                      <CheckCircle2 size={12} className="text-emerald-300" />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.key} className="border-b border-slate-100">
                <td className="sticky left-0 z-10 border border-slate-200 bg-brand-50 px-3 py-2 text-xs font-bold text-brand-800">
                  {row.label}
                </td>
                {months.map((m) => {
                  const k = cellKey(m.month, m.year)
                  const cell = cells[k] ?? emptyCell()
                  const locked = isLocked(m.month, m.year)
                  return (
                    <td key={k} className="border border-slate-200 p-1 align-top">
                      {row.numeric ? (
                        <input
                          type="number"
                          min={0}
                          className="w-full rounded-md border-0 bg-transparent px-1.5 py-1.5 text-center text-sm text-slate-800 focus:bg-white focus:ring-2 focus:ring-brand-200 disabled:text-slate-400"
                          value={cell[row.key] as number}
                          disabled={locked}
                          onChange={(e) => updateCell(m.month, m.year, row.key, e.target.value)}
                        />
                      ) : (
                        <textarea
                          className="min-h-[52px] w-full resize-none rounded-md border-0 bg-transparent px-1.5 py-1.5 text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-brand-200 disabled:text-slate-400"
                          value={cell[row.key] as string}
                          disabled={locked}
                          onChange={(e) => updateCell(m.month, m.year, row.key, e.target.value)}
                        />
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

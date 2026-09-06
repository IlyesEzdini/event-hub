// A club's activity "year" runs September -> August (matching the paper
// "Fiche de suivi" the coordinator already uses), which does not line up
// with the calendar year the `reports` table stores month/year in. These
// helpers translate between the two without changing the database schema.

export interface AcademicMonth {
  month: number // 1-12, calendar month
  year: number // calendar year this month falls in
  label: string // French display label, e.g. "Septembre"
}

const FR_MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

export function frMonthLabel(month: number): string {
  return FR_MONTHS[month - 1] ?? ''
}

const ACADEMIC_MONTH_ORDER = [9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8]

/** The academic year a given date falls into, expressed as its start calendar year. */
export function getAcademicYearStart(date: Date = new Date()): number {
  const m = date.getMonth() + 1
  return m >= 9 ? date.getFullYear() : date.getFullYear() - 1
}

/** The 12 (month, year) pairs of an academic year, in Sept -> Aug order. */
export function getAcademicMonths(academicStartYear: number): AcademicMonth[] {
  return ACADEMIC_MONTH_ORDER.map((month) => ({
    month,
    year: month >= 9 ? academicStartYear : academicStartYear + 1,
    label: frMonthLabel(month),
  }))
}

export function isCurrentAcademicMonth(month: number, year: number, now: Date = new Date()): boolean {
  return month === now.getMonth() + 1 && year === now.getFullYear()
}

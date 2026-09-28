/**
 * Stable visual identity for interview cards.
 *
 * The color is derived from the dean's id, so every interview belonging to
 * the same dean keeps the same accent without storing presentation data in
 * the database.
 */
export interface InterviewDeanColor {
  border: string
  softBackground: string
  avatar: string
  text: string
  ring: string
}

const PALETTE: InterviewDeanColor[] = [
  {
    border: 'border-l-violet-500',
    softBackground: 'bg-violet-50/70',
    avatar: 'bg-violet-100 text-violet-700',
    text: 'text-violet-700',
    ring: 'ring-violet-200',
  },
  {
    border: 'border-l-blue-500',
    softBackground: 'bg-blue-50/70',
    avatar: 'bg-blue-100 text-blue-700',
    text: 'text-blue-700',
    ring: 'ring-blue-200',
  },
  {
    border: 'border-l-emerald-500',
    softBackground: 'bg-emerald-50/70',
    avatar: 'bg-emerald-100 text-emerald-700',
    text: 'text-emerald-700',
    ring: 'ring-emerald-200',
  },
  {
    border: 'border-l-amber-500',
    softBackground: 'bg-amber-50/70',
    avatar: 'bg-amber-100 text-amber-700',
    text: 'text-amber-700',
    ring: 'ring-amber-200',
  },
  {
    border: 'border-l-rose-500',
    softBackground: 'bg-rose-50/70',
    avatar: 'bg-rose-100 text-rose-700',
    text: 'text-rose-700',
    ring: 'ring-rose-200',
  },
  {
    border: 'border-l-cyan-500',
    softBackground: 'bg-cyan-50/70',
    avatar: 'bg-cyan-100 text-cyan-700',
    text: 'text-cyan-700',
    ring: 'ring-cyan-200',
  },
  {
    border: 'border-l-fuchsia-500',
    softBackground: 'bg-fuchsia-50/70',
    avatar: 'bg-fuchsia-100 text-fuchsia-700',
    text: 'text-fuchsia-700',
    ring: 'ring-fuchsia-200',
  },
  {
    border: 'border-l-indigo-500',
    softBackground: 'bg-indigo-50/70',
    avatar: 'bg-indigo-100 text-indigo-700',
    text: 'text-indigo-700',
    ring: 'ring-indigo-200',
  },
]

export function getInterviewDeanColor(deanId: string | null | undefined): InterviewDeanColor {
  if (!deanId) return PALETTE[0]

  let hash = 0
  for (let index = 0; index < deanId.length; index += 1) {
    hash = (hash * 31 + deanId.charCodeAt(index)) | 0
  }

  return PALETTE[Math.abs(hash) % PALETTE.length]
}

export function getInitials(name: string | null | undefined): string {
  const value = name?.trim()
  if (!value) return '?'

  const parts = value.split(/\s+/).filter(Boolean)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

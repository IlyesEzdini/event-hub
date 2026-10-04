import { useState, type FormEvent, Fragment } from 'react'

import toast from 'react-hot-toast'

import { Users, Plus, Pencil, KeyRound, Ban, CheckCircle2, UserPlus, Trash2, CornerDownRight, Building2, Crown, Download, Mail, Phone } from 'lucide-react'

import { useManagers } from '@/hooks/useManagers'

import { useClubs } from '@/hooks/useClubs'

import { useDeans } from '@/hooks/useDeans'

import { useAssistants } from '@/hooks/useAssistants'

import { createManager, replaceOrUpdateManager, updateManagerCredentials, setManagerActive } from '@/services/managers'

import { findOrCreateClub } from '@/services/clubs'

import { createAssistant, deleteAssistant } from '@/services/assistants'

import { Modal } from '@/components/ui/Modal'

import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

import { TableRowSkeleton } from '@/components/ui/Skeleton'

import { EmptyState } from '@/components/ui/EmptyState'

import type { ProfileWithRelations, ProfileWithClub, Dean } from '@/types/database'



type Modal_ = 'add' | 'edit' | 'credentials' | 'addAssistant' | null



export default function ManagersPage() {
  const { managers, loading, reload } = useManagers()
  const { clubs, reload: reloadClubs } = useClubs()
  const { deans } = useDeans()
  const { assistants, loading: assistantsLoading, reload: reloadAssistants } = useAssistants()

  const [modal, setModal] = useState<Modal_>(null)
  const [active, setActive] = useState<ProfileWithRelations | null>(null)
  const [toggleTarget, setToggleTarget] = useState<ProfileWithRelations | null>(null)
  const [deleteAssistantTarget, setDeleteAssistantTarget] = useState<ProfileWithClub | null>(null)
  const [assistantManagerPreselect, setAssistantManagerPreselect] = useState<string | null>(null)

  const [viewMode, setViewMode] = useState<'all' | 'manager' | 'assistant'>('all')
  const [selectedClubId, setSelectedClubId] = useState('all')
  const [selectedDeanId, setSelectedDeanId] = useState('all')
  const [clubStatus, setClubStatus] = useState<'all' | 'active' | 'inactive'>('all')

  function openAdd() {
    setActive(null)
    setModal('add')
  }

  function openEdit(m: ProfileWithRelations) {
    setActive(m)
    setModal('edit')
  }

  function openCredentials(m: ProfileWithRelations) {
    setActive(m)
    setModal('credentials')
  }

  function openAddAssistant(managerId: string | null = null) {
    setAssistantManagerPreselect(managerId)
    setModal('addAssistant')
  }

  function closeModal() {
    setModal(null)
    setActive(null)
    setAssistantManagerPreselect(null)
  }

  const assistantsByManager = (managerId: string) =>
    assistants.filter((a) => a.assists_manager_id === managerId)

  function getManagerForClub(clubId: string) {
    return managers.find((manager) => manager.club_id === clubId)
  }

  const sortedClubs = [...clubs].sort((a, b) => {
    const managerA = getManagerForClub(a.id)
    const managerB = getManagerForClub(b.id)

    // Clubs with an assigned manager always come first.
    if (managerA && !managerB) return -1
    if (!managerA && managerB) return 1

    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  })

  const filteredClubs = sortedClubs.filter((club) => {
    const manager = getManagerForClub(club.id)

    if (selectedClubId !== 'all' && club.id !== selectedClubId) {
      return false
    }

    if (selectedDeanId !== 'all' && manager?.dean_id !== selectedDeanId) {
      return false
    }

    // Club status is based on manager assignment, not manager login status.
    if (clubStatus === 'active' && !manager) {
      return false
    }

    if (clubStatus === 'inactive' && manager) {
      return false
    }

    return true
  })

  const managersWithoutClub = managers.filter((manager) => !manager.club_id)

  function downloadFilteredList() {
    const rows: string[][] = [['Type', 'Name', 'Username', 'Club', 'Phone', 'Email', 'Dean', 'Status', 'Manager']]

    filteredClubs.forEach((club) => {
      const manager = getManagerForClub(club.id)
      const clubAssistants = manager ? assistantsByManager(manager.id) : []

      if ((viewMode === 'all' || viewMode === 'manager') && manager) {
        rows.push([
          'Manager',
          manager.manager_name ?? '',
          manager.username ?? '',
          club.name,
          manager.phone_number ?? '',
          manager.email ?? '',
          manager.dean?.name ?? '',
          manager.is_active ? 'Active' : 'Disabled',
          '',
        ])
      }

      if (viewMode === 'all' || viewMode === 'assistant') {
        clubAssistants.forEach((assistant) => {
          rows.push([
            'Assistant',
            assistant.manager_name ?? '',
            '',
            club.name,
            assistant.phone_number ?? '',
            assistant.email ?? '',
            '',
            '',
            manager?.manager_name ?? '',
          ])
        })
      }
    })

    if (selectedClubId === 'all' && managersWithoutClub.length > 0) {
      managersWithoutClub.forEach((manager) => {
        if (viewMode === 'all' || viewMode === 'manager') {
          rows.push([
            'Manager',
            manager.manager_name ?? '',
            manager.username ?? '',
            'No club assigned',
            manager.phone_number ?? '',
            manager.email ?? '',
            manager.dean?.name ?? '',
            manager.is_active ? 'Active' : 'Disabled',
            '',
          ])
        }
      })
    }

    const csv = rows
      .map((row) =>
        row
          .map((value) => `"${String(value).replace(/"/g, '""')}"`)
          .join(','),
      )
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'eventhub-managers-and-assistants.csv'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)

    toast.success('List downloaded successfully.')
  }

  const unassignedClubCount = clubs.filter(
    (club) => !managers.some((manager) => manager.club_id === club.id),
  ).length

  const activeMemberCount =
    managers.filter((manager) => manager.is_active).length +
    assistants.length

  return (
    <div className="min-h-full space-y-6">
      {/* Header */}
      <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-white to-brand-50/70 p-5 shadow-sm sm:p-7">
        <div className="absolute -right-16 -top-20 h-48 w-48 rounded-full bg-brand-100/50 blur-3xl" />
        <div className="absolute -bottom-24 left-1/3 h-40 w-40 rounded-full bg-violet-100/40 blur-3xl" />

        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg shadow-brand-500/20">
              <Users size={27} />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
                  Managers &amp; Assistants
                </h1>
                <span className="rounded-full border border-brand-100 bg-brand-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-brand-700">
                  Club Directory
                </span>
              </div>

              <p className="mt-1 max-w-2xl text-sm text-slate-500">
                Manage each club team, clearly separate managers from assistants, and quickly find the people assigned to a club.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              className="btn-secondary inline-flex items-center gap-2"
              onClick={() => openAddAssistant(null)}
            >
              <UserPlus size={16} />
              Add Assistant
            </button>

            <button
              className="btn-primary inline-flex items-center gap-2"
              onClick={openAdd}
            >
              <Plus size={16} />
              Add Manager
            </button>
          </div>
        </div>
      </section>

      {/* Overview */}
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Managers</span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <Users size={18} />
            </span>
          </div>
          <p className="mt-3 text-2xl font-bold text-slate-950">{managers.length}</p>
          <p className="mt-1 text-xs text-slate-400">Club leaders</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Assistants</span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
              <UserPlus size={18} />
            </span>
          </div>
          <p className="mt-3 text-2xl font-bold text-slate-950">{assistants.length}</p>
          <p className="mt-1 text-xs text-slate-400">Supporting members</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Clubs</span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
              <Building2 size={18} />
            </span>
          </div>
          <p className="mt-3 text-2xl font-bold text-slate-950">{clubs.length}</p>
          <p className="mt-1 text-xs text-slate-400">
            {unassignedClubCount} without a manager
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Active members</span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 size={18} />
            </span>
          </div>
          <p className="mt-3 text-2xl font-bold text-slate-950">{activeMemberCount}</p>
          <p className="mt-1 text-xs text-slate-400">Managers + assistants</p>
        </div>
      </section>

      {/* Filters */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="space-y-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
              I want to see
            </p>

            <div className="mt-2 inline-flex flex-wrap rounded-xl bg-slate-100 p-1">
              {[
                { value: 'all' as const, label: 'Everyone', icon: Users },
                { value: 'manager' as const, label: 'Managers', icon: Crown },
                { value: 'assistant' as const, label: 'Assistants', icon: UserPlus },
              ].map(({ value, label, icon: Icon }) => {
                const selected = viewMode === value

                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setViewMode(value)}
                    className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition ${
                      selected
                        ? 'bg-white text-brand-700 shadow-sm ring-1 ring-slate-200'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Icon size={15} />
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                Filter by club
              </label>

              <div className="relative">
                <Building2
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <select
                  className="input pl-9"
                  value={selectedClubId}
                  onChange={(e) => setSelectedClubId(e.target.value)}
                >
                  <option value="all">All clubs</option>
                  {sortedClubs.map((club) => (
                    <option key={club.id} value={club.id}>
                      {club.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                Filter by dean
              </label>

              <select
                className="input"
                value={selectedDeanId}
                onChange={(e) => setSelectedDeanId(e.target.value)}
              >
                <option value="all">All deans</option>
                {deans.map((dean) => (
                  <option key={dean.id} value={dean.id}>
                    {dean.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                Club status
              </label>

              <select
                className="input"
                value={clubStatus}
                onChange={(e) =>
                  setClubStatus(e.target.value as 'all' | 'active' | 'inactive')
                }
              >
                <option value="all">All clubs</option>
                <option value="active">Active — manager assigned</option>
                <option value="inactive">Inactive — no manager</option>
              </select>

              <p className="mt-1.5 text-[11px] leading-4 text-slate-400">
                Active = manager assigned. Inactive = no manager assigned.
              </p>
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={downloadFilteredList}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
              >
                <Download size={16} />
                Download
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Main content */}
      <section>
        {loading || assistantsLoading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <table className="w-full">
              <tbody>
                <TableRowSkeleton cols={6} />
                <TableRowSkeleton cols={6} />
                <TableRowSkeleton cols={6} />
              </tbody>
            </table>
          </div>
        ) : managers.length === 0 && assistants.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <EmptyState
              icon={Users}
              title="No managers yet"
              description="Add your first event manager to get started."
            />
          </div>
        ) : (
          <div className="space-y-4">
            {filteredClubs.map((club) => {
              const manager = getManagerForClub(club.id)
              const clubAssistants = manager ? assistantsByManager(manager.id) : []

              return (
                <article
                  key={club.id}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-slate-300 hover:shadow-md"
                >
                  {/* Club header */}
                  <div className="flex flex-col gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-100">
                        <Building2 size={20} />
                      </div>

                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
                          Club
                        </p>
                        <h2 className="text-lg font-bold text-slate-950">{club.name}</h2>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {manager ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200">
                          <CheckCircle2 size={13} />
                          Active club
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1.5 text-xs font-bold text-amber-700 ring-1 ring-amber-200">
                          <Ban size={13} />
                          Inactive — no manager
                        </span>
                      )}

                      {manager && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1.5 text-xs font-bold text-brand-700 ring-1 ring-brand-100">
                          <Crown size={13} />
                          {manager.manager_name}
                        </span>
                      )}

                      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-500">
                        <UserPlus size={13} />
                        {clubAssistants.length} assistant{clubAssistants.length === 1 ? '' : 's'}
                      </span>
                    </div>
                  </div>

                  {/* Manager */}
                  {(viewMode === 'all' || viewMode === 'manager') && (
                    <div className="border-b border-slate-100 px-5 py-5">
                      <div className="mb-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                            <Crown size={14} />
                          </span>
                          <span className="text-xs font-bold uppercase tracking-[0.12em] text-brand-700">
                            Manager
                          </span>
                        </div>

                        {manager && (
                          <div className="flex items-center gap-1">
                            <IconAction
                              label="Add assistant"
                              onClick={() => openAddAssistant(manager.id)}
                              icon={UserPlus}
                            />
                            <IconAction
                              label="Edit"
                              onClick={() => openEdit(manager)}
                              icon={Pencil}
                            />
                            <IconAction
                              label="Change password"
                              onClick={() => openCredentials(manager)}
                              icon={KeyRound}
                            />
                            <IconAction
                              label={manager.is_active ? 'Disable' : 'Enable'}
                              onClick={() => setToggleTarget(manager)}
                              icon={manager.is_active ? Ban : CheckCircle2}
                              danger={manager.is_active}
                            />
                          </div>
                        )}
                      </div>

                      {manager ? (
                        <div className="flex flex-col gap-4 rounded-2xl border border-brand-100 bg-gradient-to-r from-brand-50/70 to-white p-4 sm:flex-row sm:items-center">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-lg font-bold text-white shadow-md shadow-brand-500/20">
                            {(manager.manager_name || 'M').charAt(0).toUpperCase()}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-bold text-slate-950">
                                {manager.manager_name}
                              </h3>
                              <span className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-bold text-brand-700">
                                <Crown size={11} />
                                Manager
                              </span>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                  manager.is_active
                                    ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                                    : 'bg-slate-100 text-slate-500 ring-1 ring-slate-200'
                                }`}
                              >
                                {manager.is_active ? 'Active' : 'Disabled'}
                              </span>
                            </div>

                            <p className="mt-1 text-sm text-slate-500">
                              @{manager.username || '—'}
                              {manager.dean?.name ? ` · Dean: ${manager.dean.name}` : ''}
                            </p>

                            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                              {manager.phone_number && (
                                <span className="inline-flex items-center gap-1.5">
                                  <Phone size={13} />
                                  {manager.phone_number}
                                </span>
                              )}
                              {manager.email && (
                                <span className="inline-flex min-w-0 items-center gap-1.5">
                                  <Mail size={13} />
                                  <span className="truncate">{manager.email}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-dashed border-amber-300 bg-amber-50/50 p-4 sm:flex-row sm:items-center">
                          <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-amber-500 shadow-sm ring-1 ring-amber-200">
                              <Crown size={20} />
                            </div>
                            <div>
                              <h3 className="font-bold text-slate-800">No manager assigned</h3>
                              <p className="mt-0.5 text-sm text-slate-500">
                                This club is waiting for a manager.
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={openAdd}
                            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700"
                          >
                            <Plus size={16} />
                            Add Manager
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Assistants */}
                  {(viewMode === 'all' || viewMode === 'assistant') && (
                    <div className="px-5 py-5">
                      <div className="mb-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
                            <UserPlus size={14} />
                          </span>
                          <span className="text-xs font-bold uppercase tracking-[0.12em] text-orange-700">
                            Assistants
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => openAddAssistant(manager?.id ?? null)}
                          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold text-orange-700 transition hover:bg-orange-50"
                        >
                          <Plus size={14} />
                          Add assistant
                        </button>
                      </div>

                      {clubAssistants.length > 0 ? (
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                          {clubAssistants.map((assistant) => (
                            <div
                              key={assistant.id}
                              className="group flex items-center gap-3 rounded-xl border border-orange-100 bg-orange-50/40 p-3 transition hover:border-orange-200 hover:bg-orange-50"
                            >
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-100 font-bold text-orange-700">
                                {(assistant.manager_name || 'A').charAt(0).toUpperCase()}
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="truncate text-sm font-bold text-slate-800">
                                    {assistant.manager_name}
                                  </p>
                                  <span
                                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                                      'bg-orange-400'
                                    }`}
                                  />
                                </div>

                                <p className="truncate text-xs text-slate-500">
                                  @{assistant.username || 'assistant'}
                                </p>

                                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-400">
                                  {assistant.phone_number && (
                                    <span className="inline-flex items-center gap-1">
                                      <Phone size={11} />
                                      {assistant.phone_number}
                                    </span>
                                  )}
                                  {assistant.email && (
                                    <span className="inline-flex max-w-full items-center gap-1">
                                      <Mail size={11} />
                                      <span className="truncate">{assistant.email}</span>
                                    </span>
                                  )}
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => setDeleteAssistantTarget(assistant)}
                                aria-label="Remove assistant"
                                title="Remove assistant"
                                className="rounded-lg p-2 text-slate-300 transition hover:bg-white hover:text-rose-600"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-5 text-center">
                          <UserPlus className="mx-auto text-slate-300" size={22} />
                          <p className="mt-2 text-sm font-semibold text-slate-500">
                            No assistant assigned
                          </p>
                          <p className="mt-1 text-xs text-slate-400">
                            Add an assistant to this club team.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </article>
              )
            })}

            {selectedClubId === 'all' && managersWithoutClub.length > 0 && (
              <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 bg-slate-50 px-5 py-4">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                    Unassigned
                  </p>
                  <h2 className="mt-1 text-lg font-bold text-slate-950">
                    Managers without a club
                  </h2>
                </div>

                {(viewMode === 'all' || viewMode === 'manager') && (
                  <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-3">
                    {managersWithoutClub.map((manager) => (
                      <div
                        key={manager.id}
                        className="rounded-xl border border-slate-200 bg-white p-4"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 font-bold text-brand-700">
                            {(manager.manager_name || 'M').charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-bold text-slate-800">
                              {manager.manager_name}
                            </p>
                            <p className="truncate text-xs text-slate-400">
                              @{manager.username || '—'}
                            </p>
                          </div>
                        </div>

                        <div className="mt-3 flex gap-1">
                          <IconAction label="Edit" onClick={() => openEdit(manager)} icon={Pencil} />
                          <IconAction label="Change password" onClick={() => openCredentials(manager)} icon={KeyRound} />
                          <IconAction
                            label={manager.is_active ? 'Disable' : 'Enable'}
                            onClick={() => setToggleTarget(manager)}
                            icon={manager.is_active ? Ban : CheckCircle2}
                            danger={manager.is_active}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            )}

            {filteredClubs.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
                <Building2 className="mx-auto text-slate-300" size={28} />
                <p className="mt-3 font-semibold text-slate-700">Club not found</p>
                <p className="mt-1 text-sm text-slate-400">
                  Choose another club from the filter.
                </p>
              </div>
            )}
          </div>
        )}
      </section>

      <Modal open={modal === 'add'} onClose={closeModal} title="Add Manager">
        <AddManagerForm
          clubs={clubs}
          deans={deans}
          onCreated={() => {
            closeModal()
            reload()
            reloadClubs()
          }}
        />
      </Modal>

      <Modal open={modal === 'edit'} onClose={closeModal} title="Edit / Replace Manager">
        {active && (
          <EditManagerForm
            manager={active}
            clubs={clubs}
            deans={deans}
            onSaved={() => {
              closeModal()
              reload()
            }}
          />
        )}
      </Modal>

      <Modal open={modal === 'credentials'} onClose={closeModal} title="Change Credentials" maxWidth="max-w-sm">
        {active && (
          <CredentialsForm
            manager={active}
            onSaved={() => {
              closeModal()
            }}
          />
        )}
      </Modal>

      <Modal open={modal === 'addAssistant'} onClose={closeModal} title="Add Assistant">
        <AddAssistantForm
          managers={managers}
          preselectManagerId={assistantManagerPreselect}
          onCreated={() => {
            closeModal()
            reloadAssistants()
          }}
        />
      </Modal>

      <ConfirmDialog
        open={!!toggleTarget}
        onClose={() => setToggleTarget(null)}
        onConfirm={async () => {
          if (!toggleTarget) return
          try {
            await setManagerActive(toggleTarget.id, !toggleTarget.is_active)
            toast.success(toggleTarget.is_active ? 'Manager disabled.' : 'Manager enabled.')
            setToggleTarget(null)
            reload()
          } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Unable to update this account.')
          }
        }}
        title={toggleTarget?.is_active ? 'Disable manager?' : 'Enable manager?'}
        message={
          toggleTarget?.is_active
            ? `${toggleTarget?.manager_name} will no longer be able to sign in. Their club's historical data is unaffected.`
            : `${toggleTarget?.manager_name} will be able to sign in again.`
        }
        confirmLabel={toggleTarget?.is_active ? 'Disable' : 'Enable'}
        danger={!!toggleTarget?.is_active}
      />

      <ConfirmDialog
        open={!!deleteAssistantTarget}
        onClose={() => setDeleteAssistantTarget(null)}
        onConfirm={async () => {
          if (!deleteAssistantTarget) return
          try {
            await deleteAssistant(deleteAssistantTarget.id)
            toast.success('Assistant removed.')
            setDeleteAssistantTarget(null)
            reloadAssistants()
          } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Unable to remove this assistant.')
          }
        }}
        title="Remove assistant?"
        message={`${deleteAssistantTarget?.manager_name} will be permanently removed. This cannot be undone.`}
        confirmLabel="Remove"
        danger
      />
    </div>
  )
}


function IconAction({

  label,

  onClick,

  icon: Icon,

  danger = false,

}: {

  label: string

  onClick: () => void

  icon: typeof Pencil

  danger?: boolean

}) {

  return (

    <button

      onClick={onClick}

      aria-label={label}

      title={label}

      className={`rounded-lg p-2 text-slate-400 hover:bg-slate-100 ${danger ? 'hover:text-rose-600' : 'hover:text-brand-600'}`}

    >

      <Icon size={15} />

    </button>

  )

}



function AddManagerForm({

  clubs,

  deans,

  onCreated,

}: {

  clubs: { id: string; name: string }[]

  deans: Dean[]

  onCreated: () => void

}) {

  const [managerName, setManagerName] = useState('')

  const [clubMode, setClubMode] = useState<'existing' | 'new'>('existing')

  const [clubId, setClubId] = useState('')

  const [newClubName, setNewClubName] = useState('')

  const [username, setUsername] = useState('')

  const [phoneNumber, setPhoneNumber] = useState('')

  const [contactEmail, setContactEmail] = useState('')

  const [deanId, setDeanId] = useState('')

  const [password, setPassword] = useState('')

  const [submitting, setSubmitting] = useState(false)

  const [error, setError] = useState<string | null>(null)



  async function handleSubmit(e: FormEvent) {

    e.preventDefault()

    setError(null)

    if (!managerName.trim() || !username.trim() || password.length < 6) {

      setError('Name and username are required; password must be at least 6 characters.')

      return

    }

    if (clubMode === 'existing' && !clubId) {

      setError('Please select a club.')

      return

    }

    if (clubMode === 'new' && !newClubName.trim()) {

      setError('Please enter the new club name.')

      return

    }

    setSubmitting(true)

    try {

      const resolvedClubId = clubMode === 'existing' ? clubId : (await findOrCreateClub(newClubName)).id

      await createManager({

        manager_name: managerName.trim(),

        username: username.trim(),

        password,

        club_id: resolvedClubId,

        phone_number: phoneNumber.trim() || undefined,

        email: contactEmail.trim() || undefined,

        dean_id: deanId || undefined,

      })

      toast.success('Manager added successfully.')

      onCreated()

    } catch (err) {

      toast.error(err instanceof Error ? err.message : 'Unable to create this manager.')

    } finally {

      setSubmitting(false)

    }

  }



  return (

    <form onSubmit={handleSubmit} className="space-y-4">

      {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      <div>

        <label className="label">Manager Name</label>

        <input className="input" value={managerName} onChange={(e) => setManagerName(e.target.value)} placeholder="Ahmed Ben Ali" />

      </div>



      <div>

        <label className="label">Club</label>

        <div className="mb-2 flex gap-2 text-xs font-semibold">

          <button type="button" onClick={() => setClubMode('existing')} className={`rounded-lg px-3 py-1.5 ${clubMode === 'existing' ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-500'}`}>

            Existing club

          </button>

          <button type="button" onClick={() => setClubMode('new')} className={`rounded-lg px-3 py-1.5 ${clubMode === 'new' ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-500'}`}>

            New club

          </button>

        </div>

        {clubMode === 'existing' ? (

          <select className="input" value={clubId} onChange={(e) => setClubId(e.target.value)}>

            <option value="">Select a club…</option>

            {clubs.map((c) => (

              <option key={c.id} value={c.id}>

                {c.name}

              </option>

            ))}

          </select>

        ) : (

          <input className="input" value={newClubName} onChange={(e) => setNewClubName(e.target.value)} placeholder="Club Delta" />

        )}

      </div>



      <div>

        <label className="label">Dean</label>

        <select className="input" value={deanId} onChange={(e) => setDeanId(e.target.value)}>

          <option value="">No dean</option>

          {deans.map((d) => (

            <option key={d.id} value={d.id}>

              {d.name}

            </option>

          ))}

        </select>

      </div>



      <div>

        <label className="label">Username</label>

        <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="ahmed" />

      </div>



      <div className="grid grid-cols-2 gap-4">

        <div>

          <label className="label">Phone Number</label>

          <input className="input" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="+216 XX XXX XXX" />

        </div>

        <div>

          <label className="label">Email</label>

          <input type="email" className="input" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="ahmed@example.com" />

        </div>

      </div>



      <div>

        <label className="label">Initial Password</label>

        <input type="text" className="input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" />

      </div>



      <div className="flex justify-end gap-2 pt-2">

        <button type="submit" className="btn-primary" disabled={submitting}>

          {submitting ? 'Creating…' : 'Create manager'}

        </button>

      </div>

    </form>

  )

}



function EditManagerForm({

  manager,

  clubs,

  deans,

  onSaved,

}: {

  manager: ProfileWithRelations

  clubs: { id: string; name: string }[]

  deans: Dean[]

  onSaved: () => void

}) {

  const [managerName, setManagerName] = useState(manager.manager_name)

  const [username, setUsername] = useState(manager.username ?? '')

  const [phoneNumber, setPhoneNumber] = useState(manager.phone_number ?? '')

  const [contactEmail, setContactEmail] = useState(manager.email ?? '')

  const [deanId, setDeanId] = useState(manager.dean_id ?? '')

  const [clubId, setClubId] = useState(manager.club_id ?? '')

  const [submitting, setSubmitting] = useState(false)



  async function handleSubmit(e: FormEvent) {

    e.preventDefault()

    setSubmitting(true)

    try {

      await replaceOrUpdateManager({

        profile_id: manager.id,

        manager_name: managerName.trim(),

        username: username.trim(),

        club_id: clubId || undefined,

        phone_number: phoneNumber.trim(),

        email: contactEmail.trim(),

        dean_id: deanId,

      })

      toast.success('Manager updated successfully.')

      onSaved()

    } catch (err) {

      toast.error(err instanceof Error ? err.message : 'Unable to update this manager.')

    } finally {

      setSubmitting(false)

    }

  }



  return (

    <form onSubmit={handleSubmit} className="space-y-4">

      <p className="rounded-xl bg-brand-50 px-3 py-2 text-xs text-brand-700">

        Replacing the manager keeps all of this club's events and reports intact — only the assigned person changes.

      </p>

      <div>

        <label className="label">Manager Name</label>

        <input className="input" value={managerName} onChange={(e) => setManagerName(e.target.value)} />

      </div>

      <div>

        <label className="label">Club</label>

        <select className="input" value={clubId} onChange={(e) => setClubId(e.target.value)}>

          {clubs.map((c) => (

            <option key={c.id} value={c.id}>

              {c.name}

            </option>

          ))}

        </select>

      </div>

      <div>

        <label className="label">Dean</label>

        <select className="input" value={deanId} onChange={(e) => setDeanId(e.target.value)}>

          <option value="">No dean</option>

          {deans.map((d) => (

            <option key={d.id} value={d.id}>

              {d.name}

            </option>

          ))}

        </select>

      </div>

      <div>

        <label className="label">Username</label>

        <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} />

      </div>

      <div className="grid grid-cols-2 gap-4">

        <div>

          <label className="label">Phone Number</label>

          <input className="input" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="+216 XX XXX XXX" />

        </div>

        <div>

          <label className="label">Email</label>

          <input type="email" className="input" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="ahmed@example.com" />

        </div>

      </div>

      <div className="flex justify-end gap-2 pt-2">

        <button type="submit" className="btn-primary" disabled={submitting}>

          {submitting ? 'Saving…' : 'Save changes'}

        </button>

      </div>

    </form>

  )

}



function CredentialsForm({ manager, onSaved }: { manager: ProfileWithRelations; onSaved: () => void }) {

  const [password, setPassword] = useState('')

  const [submitting, setSubmitting] = useState(false)

  const [error, setError] = useState<string | null>(null)



  async function handleSubmit(e: FormEvent) {

    e.preventDefault()

    if (password.length < 6) {

      setError('Password must be at least 6 characters.')

      return

    }

    setError(null)

    setSubmitting(true)

    try {

      await updateManagerCredentials(manager.id, password)

      toast.success(`Password updated for ${manager.manager_name}.`)

      onSaved()

    } catch (err) {

      toast.error(err instanceof Error ? err.message : 'Unable to update credentials.')

    } finally {

      setSubmitting(false)

    }

  }



  return (

    <form onSubmit={handleSubmit} className="space-y-4">

      {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      <p className="text-sm text-slate-500">

        Set a new password for <strong>{manager.manager_name}</strong> ({manager.username}).

      </p>

      <div>

        <label className="label">New password</label>

        <input type="text" className="input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" />

      </div>

      <div className="flex justify-end gap-2 pt-2">

        <button type="submit" className="btn-primary" disabled={submitting}>

          {submitting ? 'Updating…' : 'Update password'}

        </button>

      </div>

    </form>

  )

}



function AddAssistantForm({

  managers,

  preselectManagerId,

  onCreated,

}: {

  managers: ProfileWithRelations[]

  preselectManagerId: string | null

  onCreated: () => void

}) {

  const [assistantName, setAssistantName] = useState('')

  const [managerId, setManagerId] = useState(preselectManagerId ?? '')

  const [phoneNumber, setPhoneNumber] = useState('')

  const [contactEmail, setContactEmail] = useState('')

  const [submitting, setSubmitting] = useState(false)

  const [error, setError] = useState<string | null>(null)



  async function handleSubmit(e: FormEvent) {

    e.preventDefault()

    setError(null)

    if (!assistantName.trim() || !managerId) {

      setError('Assistant name and manager are required.')

      return

    }

    setSubmitting(true)

    try {

      await createAssistant({

        assistant_name: assistantName.trim(),

        manager_profile_id: managerId,

        phone_number: phoneNumber.trim() || undefined,

        email: contactEmail.trim() || undefined,

      })

      toast.success('Assistant added successfully.')

      onCreated()

    } catch (err) {

      toast.error(err instanceof Error ? err.message : 'Unable to create this assistant.')

    } finally {

      setSubmitting(false)

    }

  }



  return (

    <form onSubmit={handleSubmit} className="space-y-4">

      {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      <p className="rounded-xl bg-brand-50 px-3 py-2 text-xs text-brand-700">

        Assistants have no login — this only adds them to the directory under the manager you pick, using that

        manager's club automatically.

      </p>

      <div>

        <label className="label">Assistant Name</label>

        <input className="input" value={assistantName} onChange={(e) => setAssistantName(e.target.value)} placeholder="Sami Trabelsi" />

      </div>

      <div>

        <label className="label">Manager</label>

        <select className="input" value={managerId} onChange={(e) => setManagerId(e.target.value)}>

          <option value="">Select a manager…</option>

          {managers.map((m) => (

            <option key={m.id} value={m.id}>

              {m.manager_name} ({m.club?.name ?? '—'})

            </option>

          ))}

        </select>

      </div>

      <div className="grid grid-cols-2 gap-4">

        <div>

          <label className="label">Phone Number</label>

          <input className="input" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="+216 XX XXX XXX" />

        </div>

        <div>

          <label className="label">Email</label>

          <input type="email" className="input" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="sami@example.com" />

        </div>

      </div>

      <div className="flex justify-end gap-2 pt-2">

        <button type="submit" className="btn-primary" disabled={submitting}>

          {submitting ? 'Creating…' : 'Add assistant'}

        </button>

      </div>

    </form>

  )

}
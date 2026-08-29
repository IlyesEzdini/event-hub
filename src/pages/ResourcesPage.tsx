import { useState, type FormEvent } from 'react'
import toast from 'react-hot-toast'
import { FolderOpen, Plus, Download, Trash2, FileIcon } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useDocuments } from '@/hooks/useDocuments'
import { uploadDocument, getDocumentUrl, deleteDocument } from '@/services/documents'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { CardSkeleton } from '@/components/ui/Skeleton'
import type { DocumentResource } from '@/types/database'

export default function ResourcesPage() {
  const { profile } = useAuth()
  const { documents, loading, reload } = useDocuments()
  const isAdmin = profile?.role === 'admin'
  const [uploadOpen, setUploadOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<DocumentResource | null>(null)

  async function handleOpen(doc: DocumentResource) {
    try {
      const url = await getDocumentUrl(doc.file_path)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch {
      toast.error('Unable to open this document.')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <FolderOpen size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Resources</h1>
            <p className="text-sm text-slate-500">Guides and documents shared by your coordinator</p>
          </div>
        </div>
        {isAdmin && (
          <button className="btn-primary" onClick={() => setUploadOpen(true)}>
            <Plus size={16} /> Upload Document
          </button>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : documents.length === 0 ? (
        <EmptyState icon={FolderOpen} title="No documents yet" description="Your coordinator hasn't uploaded any resources yet." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {documents.map((doc) => (
            <div key={doc.id} className="card flex flex-col p-5">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                <FileIcon size={18} />
              </div>
              <h3 className="text-sm font-bold text-slate-900">{doc.title}</h3>
              {doc.description && <p className="mt-1 flex-1 text-sm text-slate-500">{doc.description}</p>}
              <div className="mt-4 flex items-center gap-2">
                <button onClick={() => handleOpen(doc)} className="btn-secondary flex-1 text-xs">
                  <Download size={14} /> Open
                </button>
                {isAdmin && (
                  <button
                    onClick={() => setDeleteTarget(doc)}
                    aria-label="Delete document"
                    className="rounded-xl border border-slate-200 p-2.5 text-slate-400 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <UploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} onUploaded={reload} profileId={profile?.id ?? null} />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return
          try {
            await deleteDocument(deleteTarget)
            toast.success('Document deleted.')
            setDeleteTarget(null)
            reload()
          } catch {
            toast.error('Unable to delete this document.')
          }
        }}
        title="Delete document?"
        message={`"${deleteTarget?.title}" will be permanently removed.`}
        confirmLabel="Delete"
        danger
      />
    </div>
  )
}

function UploadModal({
  open,
  onClose,
  onUploaded,
  profileId,
}: {
  open: boolean
  onClose: () => void
  onUploaded: () => void
  profileId: string | null
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim() || !file) {
      setError('Title and a file are both required.')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      await uploadDocument(file, title.trim(), description.trim(), profileId)
      toast.success('Document uploaded.')
      setTitle('')
      setDescription('')
      setFile(null)
      onUploaded()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to upload document.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Upload Document">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        <div>
          <label className="label">Title</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Event Planning Checklist" />
        </div>
        <div>
          <label className="label">Description</label>
          <textarea
            className="input min-h-[70px] resize-y"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this document for?"
          />
        </div>
        <div>
          <label className="label">File</label>
          <input
            type="file"
            className="input file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-brand-700"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

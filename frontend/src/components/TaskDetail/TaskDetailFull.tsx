import { useState, useEffect } from 'react'
import {
  X, Mail, CheckCircle2, Phone, Clock, User,
  Package, Euro, Calendar, AlertTriangle, Loader2, RefreshCw
} from 'lucide-react'
import { EmailComposer } from '../Email/EmailComposer'
import { api } from '../../services/api'
import { cn } from '../../utils/cn'
import type { Task } from '../../services/unified'

interface TaskDetailFullProps {
  task: Task | null
  isOpen: boolean
  onClose: () => void
  onStatusChange: () => void
}

interface CustomerDetail {
  id: string
  name: string
  email?: string
  phone?: string
  company?: string
  weclappId?: string
}

interface EmailEntry {
  id: string
  subject?: string
  body: string
  sentAt: string
  direction: 'inbound' | 'outbound'
  recipientEmail?: string
}

const PRIORITY_BADGE: Record<string, string> = {
  urgent: 'bg-red-100 text-red-700 border-red-200',
  high:   'bg-orange-100 text-orange-700 border-orange-200',
  normal: 'bg-blue-100 text-blue-700 border-blue-200',
  low:    'bg-gray-100 text-gray-600 border-gray-200',
}
const PRIORITY_LABEL: Record<string, string> = {
  urgent: '🔴 Dringend', high: '🟠 Hoch', normal: '🔵 Normal', low: '⚪ Niedrig',
}
const TYPE_LABEL: Record<string, string> = {
  ticket: 'Reklamation', order: 'Auftrag', call: 'Anruf', lead: 'Lead', payment: 'Zahlung',
}

export function TaskDetailFull({ task, isOpen, onClose, onStatusChange }: TaskDetailFullProps) {
  const [customer, setCustomer] = useState<CustomerDetail | null>(null)
  const [emails, setEmails] = useState<EmailEntry[]>([])
  const [loadingCtx, setLoadingCtx] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [showComposer, setShowComposer] = useState(false)

  const loadContext = () => {
    if (!task || !isOpen) return
    setLoadingCtx(true)
    const p: Promise<void>[] = []

    if (task.customerId) {
      p.push(
        api.get(`/customers/${task.customerId}`)
          .then(r => setCustomer(r.data))
          .catch(() => {})
      )
      p.push(
        api.get(`/email/history/${task.customerId}`)
          .then(r => setEmails(r.data?.emails || []))
          .catch(() => setEmails([]))
      )
    }
    Promise.all(p).finally(() => setLoadingCtx(false))
  }

  useEffect(() => {
    setCustomer(null)
    setEmails([])
    loadContext()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id, isOpen])

  const handleComplete = async () => {
    if (!task) return
    setCompleting(true)
    try {
      await api.patch(`/tasks/${task.id}`, { status: 'completed' })
      onStatusChange()
      onClose()
    } finally {
      setCompleting(false)
    }
  }

  const reloadEmails = () => {
    if (task?.customerId) {
      api.get(`/email/history/${task.customerId}`)
        .then(r => setEmails(r.data?.emails || []))
        .catch(() => {})
    }
  }

  if (!isOpen || !task) return null

  const meta = task.metadata as Record<string, unknown> | undefined
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date()

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col bg-white shadow-2xl">

        {/* ── Header ── */}
        <div className="flex items-start gap-4 border-b px-6 py-5">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap gap-2 mb-1.5">
              <span className={cn('rounded-full border px-2.5 py-0.5 text-xs font-medium', PRIORITY_BADGE[task.priority])}>
                {PRIORITY_LABEL[task.priority]}
              </span>
              <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600">
                {TYPE_LABEL[task.type] || task.type}
              </span>
              <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-500 uppercase">
                {task.source}
              </span>
              {task.status === 'completed' && (
                <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                  ✓ Erledigt
                </span>
              )}
            </div>
            <h2 className="text-lg font-bold text-gray-900 leading-tight">{task.title}</h2>
          </div>
          <button onClick={onClose} className="shrink-0 rounded-lg p-2 hover:bg-gray-100">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* ── Body: two columns ── */}
        <div className="flex-1 overflow-hidden grid grid-cols-2 divide-x">

          {/* LEFT – Kontext */}
          <div className="overflow-y-auto p-5 space-y-5">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Kontext</p>

            {/* Description */}
            {task.description && (
              <div className="rounded-lg bg-gray-50 border px-4 py-3 text-sm text-gray-700">
                {task.description}
              </div>
            )}

            {/* Due date */}
            {task.dueDate && (
              <div className={cn(
                'flex items-center gap-2 rounded-lg px-3 py-2 text-sm',
                isOverdue ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-600'
              )}>
                <Calendar className="h-4 w-4 shrink-0" />
                Fällig: {new Date(task.dueDate).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}
                {isOverdue && <AlertTriangle className="h-4 w-4 ml-auto" />}
              </div>
            )}

            {/* Customer */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Kunde</p>
              {loadingCtx ? (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Loader2 className="h-4 w-4 animate-spin" /> Lade...
                </div>
              ) : customer ? (
                <div className="rounded-lg border border-gray-200 p-3 space-y-1.5">
                  <Row icon={<User className="h-3.5 w-3.5" />} value={customer.name} bold />
                  {customer.company && <Row icon={<Package className="h-3.5 w-3.5" />} value={customer.company} />}
                  {customer.email && (
                    <Row icon={<Mail className="h-3.5 w-3.5" />}>
                      <a href={`mailto:${customer.email}`} className="text-blue-600 hover:underline text-sm truncate">
                        {customer.email}
                      </a>
                    </Row>
                  )}
                  {customer.phone && (
                    <Row icon={<Phone className="h-3.5 w-3.5" />}>
                      <a href={`tel:${customer.phone}`} className="text-blue-600 hover:underline text-sm">
                        {customer.phone}
                      </a>
                    </Row>
                  )}
                </div>
              ) : task.customerName ? (
                <div className="rounded-lg border border-gray-200 p-3">
                  <Row icon={<User className="h-3.5 w-3.5" />} value={task.customerName} bold />
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic">Kein Kunde verknüpft</p>
              )}
            </div>

            {/* Order metadata */}
            {meta && (meta.orderNumber || meta.amount || meta.trackingNumber || meta.status) && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Auftragsdetails</p>
                <div className="rounded-lg border border-gray-200 p-3 space-y-1.5">
                  {meta.orderNumber && <Row icon={<Package className="h-3.5 w-3.5" />} value={`Auftrag #${meta.orderNumber}`} />}
                  {meta.amount && <Row icon={<Euro className="h-3.5 w-3.5" />} value={`${Number(meta.amount).toFixed(2)} €`} />}
                  {meta.status && <Row icon={<Clock className="h-3.5 w-3.5" />} value={String(meta.status)} />}
                  {meta.trackingNumber && <Row icon={<Package className="h-3.5 w-3.5" />} value={`Tracking: ${meta.trackingNumber}`} />}
                </div>
              </div>
            )}

            {/* Timestamps */}
            <div className="text-xs text-gray-400 space-y-0.5 pt-1">
              <p>Erstellt: {new Date(task.createdAt).toLocaleString('de-DE')}</p>
              <p>Zuletzt geändert: {new Date(task.updatedAt).toLocaleString('de-DE')}</p>
            </div>
          </div>

          {/* RIGHT – E-Mail-Verlauf */}
          <div className="overflow-y-auto p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Verlauf</p>
              <button onClick={reloadEmails} className="rounded p-1 hover:bg-gray-100" title="Aktualisieren">
                <RefreshCw className="h-3.5 w-3.5 text-gray-400" />
              </button>
            </div>

            {loadingCtx && emails.length === 0 && (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Loader2 className="h-4 w-4 animate-spin" /> Lade Verlauf...
              </div>
            )}

            {!loadingCtx && emails.length === 0 && (
              <p className="text-sm text-gray-400 italic">Noch keine E-Mails.</p>
            )}

            <div className="space-y-3">
              {emails.map(email => (
                <div key={email.id} className="rounded-lg border border-gray-200 p-3 space-y-1">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Mail className={cn('h-3.5 w-3.5', email.direction === 'outbound' ? 'text-blue-500' : 'text-green-500')} />
                    <span>
                      {email.direction === 'outbound' ? '→ Gesendet' : '← Empfangen'}
                      {' · '}
                      {new Date(email.sentAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                      {' '}
                      {new Date(email.sentAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  {email.subject && (
                    <p className="text-sm font-medium text-gray-800">{email.subject}</p>
                  )}
                  <p className="text-xs text-gray-600 line-clamp-4 whitespace-pre-line">{email.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Footer Actions ── */}
        <div className="border-t bg-gray-50 px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {customer?.email && (
              <button
                onClick={() => setShowComposer(true)}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
              >
                <Mail className="h-4 w-4" />
                E-Mail schreiben
              </button>
            )}
            {customer?.phone && (
              <a
                href={`tel:${customer.phone}`}
                className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Phone className="h-4 w-4" />
                Anrufen
              </a>
            )}
          </div>

          <button
            onClick={handleComplete}
            disabled={completing || task.status === 'completed'}
            className={cn(
              'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
              task.status === 'completed'
                ? 'bg-green-100 text-green-700 cursor-default'
                : completing
                  ? 'bg-green-400 text-white cursor-wait'
                  : 'bg-green-600 text-white hover:bg-green-700'
            )}
          >
            {completing
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Verarbeite...</>
              : <><CheckCircle2 className="h-4 w-4" /> {task.status === 'completed' ? 'Erledigt ✓' : 'Als erledigt markieren'}</>
            }
          </button>
        </div>
      </div>

      {/* Email Composer overlay */}
      <EmailComposer
        isOpen={showComposer}
        onClose={() => setShowComposer(false)}
        task={task}
        defaultTo={customer?.email || ''}
        customerName={customer?.name}
        onSent={() => { setShowComposer(false); reloadEmails() }}
      />
    </>
  )
}

/* Small helper for consistent icon + text rows */
function Row({
  icon, value, bold, children,
}: { icon: React.ReactNode; value?: string; bold?: boolean; children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-gray-400 shrink-0">{icon}</span>
      {children ?? (
        <span className={cn('text-sm text-gray-700', bold && 'font-medium text-gray-900')}>
          {value}
        </span>
      )}
    </div>
  )
}

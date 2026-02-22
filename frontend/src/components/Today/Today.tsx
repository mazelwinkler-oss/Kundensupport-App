import { useState, useEffect, useCallback } from 'react'
import {
  RefreshCw, Loader2, CheckCircle2, AlertTriangle,
  Clock, Wifi, WifiOff, Sun, Mail, Phone, ChevronRight
} from 'lucide-react'
import { api } from '../../services/api'
import { cn } from '../../utils/cn'
import type { Task } from '../../services/unified'
import { TaskDetailFull } from '../TaskDetail/TaskDetailFull'

interface SyncStatus {
  isConfigured: boolean
  lastSync?: string
  lastStatus?: string
  customerCount?: number
  taskCount?: number
}

type Group = 'sofort' | 'heute' | 'woche'

function groupTask(task: Task): Group {
  if (task.priority === 'urgent') return 'sofort'
  const now = new Date()
  const due = task.dueDate ? new Date(task.dueDate) : null
  if (due) {
    if (due < now) return 'sofort'
    const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999)
    if (due <= todayEnd) return 'heute'
  }
  if (task.priority === 'high') return 'heute'
  return 'woche'
}

const GROUP_CONFIG: Record<Group, { label: string; color: string; dot: string; emptyText: string }> = {
  sofort: {
    label: 'Sofort',
    color: 'text-red-600',
    dot: 'bg-red-500',
    emptyText: 'Nichts Dringendes — gut so!',
  },
  heute: {
    label: 'Heute',
    color: 'text-orange-600',
    dot: 'bg-orange-400',
    emptyText: 'Alle heutigen Aufgaben erledigt.',
  },
  woche: {
    label: 'Diese Woche',
    color: 'text-blue-600',
    dot: 'bg-blue-400',
    emptyText: 'Keine weiteren Aufgaben diese Woche.',
  },
}

const PRIORITY_BADGE: Record<string, string> = {
  urgent: 'bg-red-100 text-red-700',
  high:   'bg-orange-100 text-orange-700',
  normal: 'bg-blue-100 text-blue-700',
  low:    'bg-gray-100 text-gray-500',
}
const PRIORITY_LABEL: Record<string, string> = {
  urgent: 'Dringend', high: 'Hoch', normal: 'Normal', low: 'Niedrig',
}
const TYPE_LABEL: Record<string, string> = {
  ticket: 'Reklamation', order: 'Auftrag', call: 'Anruf', lead: 'Lead', payment: 'Zahlung',
}

function daysAgo(date: string) {
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000)
  if (diff === 0) return 'Heute'
  if (diff === 1) return '1 Tag'
  return `${diff} Tage`
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Guten Morgen'
  if (h < 18) return 'Guten Tag'
  return 'Guten Abend'
}

export function Today() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set())
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [tasksRes, syncRes] = await Promise.all([
        api.get('/tasks?status=open&status=in_progress').catch(() => api.get('/tasks')),
        api.get('/weclapp/sync-status').catch(() => ({ data: null })),
      ])
      const allTasks: Task[] = tasksRes.data || []
      setTasks(allTasks.filter((t: Task) => t.status !== 'completed'))
      setSyncStatus(syncRes.data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleDone = async (e: React.MouseEvent, task: Task) => {
    e.stopPropagation()
    try {
      await api.patch(`/tasks/${task.id}`, { status: 'completed' })
      setDoneIds(p => new Set([...p, task.id]))
    } catch {}
  }

  const visible = tasks.filter(t => !doneIds.has(t.id))
  const groups: Record<Group, Task[]> = { sofort: [], heute: [], woche: [] }
  visible.forEach(t => groups[groupTask(t)].push(t))

  const totalOpen = visible.length
  const urgentCount = groups.sofort.length

  const syncOk = syncStatus?.isConfigured && syncStatus.lastStatus === 'success'
  const syncAgo = syncStatus?.lastSync
    ? Math.floor((Date.now() - new Date(syncStatus.lastSync).getTime()) / 60_000)
    : null

  return (
    <>
      <div className="space-y-6 max-w-3xl mx-auto">

        {/* ── Hero greeting ── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <Sun className="h-5 w-5 text-yellow-500" />
              <h1 className="text-2xl font-bold text-gray-900">{greeting()}, Marcel!</h1>
            </div>
            <p className="text-gray-500 text-sm">
              {new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <button
            onClick={load}
            className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Aktualisieren
          </button>
        </div>

        {/* ── Weclapp Sync Banner ── */}
        {syncStatus && (
          <div className={cn(
            'flex items-center gap-3 rounded-lg px-4 py-3 text-sm',
            syncOk ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'
          )}>
            {syncOk
              ? <Wifi className="h-4 w-4 text-green-600 shrink-0" />
              : <WifiOff className="h-4 w-4 text-yellow-600 shrink-0" />}
            <span className={syncOk ? 'text-green-700' : 'text-yellow-700'}>
              {syncOk
                ? `Weclapp synchronisiert${syncAgo !== null ? ` – vor ${syncAgo} Min.` : ''}. ${syncStatus.customerCount ?? 0} Kunden, ${syncStatus.taskCount ?? 0} Aufgaben.`
                : syncStatus.isConfigured
                  ? 'Weclapp-Sync läuft… Letzte Synchronisierung nicht erfolgreich.'
                  : 'Weclapp nicht konfiguriert – bitte API-Token in .env eintragen.'}
            </span>
          </div>
        )}

        {/* ── Stats row ── */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Offen gesamt" value={totalOpen} color="text-gray-900" />
          <StatCard label="Sofort" value={urgentCount} color={urgentCount > 0 ? 'text-red-600' : 'text-gray-900'} />
          <StatCard label="Heute erledigt" value={doneIds.size} color="text-green-600" />
        </div>

        {/* ── Alert if urgent tasks ── */}
        {urgentCount > 0 && (
          <div className="flex items-center gap-3 rounded-lg bg-red-50 border border-red-200 px-4 py-3">
            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
            <p className="text-sm font-medium text-red-700">
              {urgentCount} dringende Aufgabe{urgentCount > 1 ? 'n' : ''} warten auf dich – bitte zuerst bearbeiten.
            </p>
          </div>
        )}

        {/* ── Loading ── */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <span className="ml-3 text-gray-500">Lade Aufgaben...</span>
          </div>
        )}

        {/* ── Groups ── */}
        {!loading && (['sofort', 'heute', 'woche'] as Group[]).map(group => (
          <TaskGroup
            key={group}
            group={group}
            tasks={groups[group]}
            onDone={handleDone}
            onDetail={task => { setSelectedTask(task); setIsDetailOpen(true) }}
          />
        ))}

        {/* ── All done state ── */}
        {!loading && totalOpen === 0 && (
          <div className="text-center py-20">
            <CheckCircle2 className="h-16 w-16 mx-auto text-green-400 mb-4" />
            <p className="text-xl font-bold text-gray-700">Alle Aufgaben erledigt!</p>
            <p className="text-gray-500 mt-1">Starker Tag, Marcel 🎉</p>
          </div>
        )}
      </div>

      {/* Task Detail */}
      <TaskDetailFull
        task={selectedTask}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        onStatusChange={() => {
          setIsDetailOpen(false)
          if (selectedTask) setDoneIds(p => new Set([...p, selectedTask.id]))
          setSelectedTask(null)
        }}
      />
    </>
  )
}

/* ── Sub-components ── */

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl bg-white border p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={cn('text-2xl font-bold', color)}>{value}</p>
    </div>
  )
}

function TaskGroup({
  group, tasks, onDone, onDetail,
}: {
  group: Group
  tasks: Task[]
  onDone: (e: React.MouseEvent, task: Task) => void
  onDetail: (task: Task) => void
}) {
  const cfg = GROUP_CONFIG[group]
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div>
      {/* Group header */}
      <button
        onClick={() => setCollapsed(v => !v)}
        className="flex w-full items-center gap-3 mb-3"
      >
        <span className={cn('h-2.5 w-2.5 rounded-full', cfg.dot)} />
        <span className={cn('text-sm font-bold uppercase tracking-wide', cfg.color)}>
          {cfg.label}
        </span>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 font-medium">
          {tasks.length}
        </span>
        <ChevronRight className={cn('h-4 w-4 text-gray-400 ml-auto transition-transform', !collapsed && 'rotate-90')} />
      </button>

      {!collapsed && (
        <div className="space-y-2">
          {tasks.length === 0 ? (
            <p className="text-sm text-gray-400 italic pl-5">{cfg.emptyText}</p>
          ) : (
            tasks.map(task => (
              <TaskCard key={task.id} task={task} onDone={onDone} onDetail={onDetail} />
            ))
          )}
        </div>
      )}
    </div>
  )
}

function TaskCard({
  task, onDone, onDetail,
}: {
  task: Task
  onDone: (e: React.MouseEvent, task: Task) => void
  onDetail: (task: Task) => void
}) {
  const meta = task.metadata as Record<string, unknown> | undefined

  return (
    <div
      onClick={() => onDetail(task)}
      className="group flex items-start gap-4 rounded-xl border border-gray-200 bg-white p-4 cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all"
    >
      <div className="flex-1 min-w-0">
        {/* Badges */}
        <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
          <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', PRIORITY_BADGE[task.priority])}>
            {PRIORITY_LABEL[task.priority]}
          </span>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
            {TYPE_LABEL[task.type] || task.type}
          </span>
        </div>

        {/* Title */}
        <p className="font-semibold text-gray-900 text-sm leading-snug">{task.title}</p>

        {/* Customer + meta */}
        <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
          {task.customerName && <span className="font-medium">{task.customerName}</span>}
          {meta?.orderNumber && <span>#{String(meta.orderNumber)}</span>}
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {daysAgo(task.createdAt)} offen
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {(task.metadata as Record<string, unknown>)?.customerEmail && (
          <button
            onClick={e => { e.stopPropagation(); window.open(`mailto:${String((task.metadata as Record<string, unknown>).customerEmail)}`) }}
            className="rounded-lg p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50"
            title="E-Mail"
          >
            <Mail className="h-4 w-4" />
          </button>
        )}
        {(task.metadata as Record<string, unknown>)?.customerPhone && (
          <a
            href={`tel:${String((task.metadata as Record<string, unknown>).customerPhone)}`}
            onClick={e => e.stopPropagation()}
            className="rounded-lg p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50"
            title="Anrufen"
          >
            <Phone className="h-4 w-4" />
          </a>
        )}
        <button
          onClick={e => onDone(e, task)}
          className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 transition-colors"
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          Erledigt
        </button>
      </div>

      {/* Arrow indicator */}
      <ChevronRight className="h-4 w-4 text-gray-300 shrink-0 self-center opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  )
}

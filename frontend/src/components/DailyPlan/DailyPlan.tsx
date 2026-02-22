import { useState, useEffect } from 'react'
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Loader2,
  Phone,
  Mail,
  Package,
  Users,
  CreditCard,
  Ticket,
} from 'lucide-react'
import { getDailyPlan, markTaskDone, type DailyPlan, type DailyPlanItem } from '../../services/unified'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'

const TYPE_ICONS: Record<string, React.ReactNode> = {
  ticket: <Ticket className="h-4 w-4" />,
  call: <Phone className="h-4 w-4" />,
  order: <Package className="h-4 w-4" />,
  lead: <Users className="h-4 w-4" />,
  payment: <CreditCard className="h-4 w-4" />,
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'border-l-red-500 bg-red-50',
  high: 'border-l-orange-400 bg-orange-50',
  normal: 'border-l-blue-400 bg-white',
  low: 'border-l-gray-300 bg-white',
}

const PRIORITY_BADGE: Record<string, string> = {
  urgent: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  normal: 'bg-blue-100 text-blue-700',
  low: 'bg-gray-100 text-gray-600',
}

const PRIORITY_LABEL: Record<string, string> = {
  urgent: 'Dringend',
  high: 'Hoch',
  normal: 'Normal',
  low: 'Niedrig',
}

export function DailyPlan() {
  const [plan, setPlan] = useState<DailyPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set())
  const [markingId, setMarkingId] = useState<string | null>(null)

  const loadPlan = async () => {
    setLoading(true)
    try {
      const data = await getDailyPlan()
      setPlan(data)
    } catch (err) {
      console.error('Failed to load daily plan:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPlan()
  }, [])

  const handleMarkDone = async (item: DailyPlanItem) => {
    setMarkingId(item.task.id)
    try {
      await markTaskDone(item.task.id)
      setDoneIds(prev => new Set([...prev, item.task.id]))
    } catch (err) {
      console.error('Failed to mark done:', err)
    } finally {
      setMarkingId(null)
    }
  }

  const handleEmail = (item: DailyPlanItem) => {
    if (item.task.customerEmail) {
      window.open(`mailto:${item.task.customerEmail}?subject=Bezüglich: ${encodeURIComponent(item.task.title)}`)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-500">Erstelle Tagesplan...</span>
      </div>
    )
  }

  if (!plan) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>Fehler beim Laden des Tagesplans</p>
        <button onClick={loadPlan} className="mt-2 text-blue-500 underline">Erneut versuchen</button>
      </div>
    )
  }

  const finishTime = new Date(plan.estimatedFinishTime)
  const visibleItems = plan.items.filter(i => !doneIds.has(i.task.id))
  const completedToday = doneIds.size

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mein Tagesplan</h1>
          <p className="text-gray-500">
            {format(new Date(), 'EEEE, d. MMMM yyyy', { locale: de })}
          </p>
        </div>
        <button
          onClick={loadPlan}
          className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
        >
          <RefreshCw className="h-4 w-4" />
          Aktualisieren
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl bg-white border p-4">
          <p className="text-sm text-gray-500">Aufgaben offen</p>
          <p className="text-2xl font-bold text-gray-900">{visibleItems.length}</p>
        </div>
        <div className="rounded-xl bg-white border p-4">
          <p className="text-sm text-gray-500">Heute erledigt</p>
          <p className="text-2xl font-bold text-green-600">{completedToday}</p>
        </div>
        <div className="rounded-xl bg-white border p-4">
          <p className="text-sm text-gray-500">Zeitbedarf</p>
          <p className="text-2xl font-bold text-blue-600">
            {Math.round(visibleItems.reduce((s, i) => s + i.estimatedMinutes, 0) / 60 * 10) / 10}h
          </p>
        </div>
        <div className={`rounded-xl border p-4 ${plan.urgentCount > 0 ? 'bg-red-50 border-red-200' : 'bg-white'}`}>
          <p className="text-sm text-gray-500">Fertig um ca.</p>
          <p className={`text-2xl font-bold ${plan.urgentCount > 0 ? 'text-red-600' : 'text-gray-900'}`}>
            {format(finishTime, 'HH:mm')} Uhr
          </p>
        </div>
      </div>

      {/* Alerts */}
      {plan.overdueCount > 0 && (
        <div className="flex items-center gap-3 rounded-lg bg-red-50 border border-red-200 px-4 py-3">
          <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
          <p className="text-sm text-red-700 font-medium">
            {plan.overdueCount} Aufgabe{plan.overdueCount > 1 ? 'n' : ''} überfällig – sofortige Bearbeitung empfohlen!
          </p>
        </div>
      )}

      {/* Plan Items */}
      {visibleItems.length === 0 ? (
        <div className="text-center py-16">
          <CheckCircle2 className="h-16 w-16 mx-auto text-green-400 mb-4" />
          <p className="text-xl font-semibold text-gray-700">Alle Aufgaben erledigt!</p>
          <p className="text-gray-500 mt-1">Genieß deinen freien Tag 🎉</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleItems.map((item) => (
            <div
              key={item.task.id}
              className={`rounded-xl border-l-4 border border-gray-100 p-4 shadow-sm transition-all ${PRIORITY_COLORS[item.task.priority]}`}
            >
              <div className="flex items-start gap-4">
                {/* Position + Time */}
                <div className="shrink-0 text-center w-12">
                  <p className="text-xs text-gray-400">
                    {format(new Date(item.startTime), 'HH:mm')}
                  </p>
                  <p className="text-lg font-bold text-gray-300">#{item.position}</p>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_BADGE[item.task.priority]}`}>
                      {PRIORITY_LABEL[item.task.priority]}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                      {TYPE_ICONS[item.task.type]}
                      {item.task.type}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                      <Clock className="h-3 w-3" />
                      ~{item.estimatedMinutes} Min
                    </span>
                    {item.isOverdue && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600">
                        <AlertTriangle className="h-3 w-3" />
                        Überfällig
                      </span>
                    )}
                  </div>

                  <p className="font-semibold text-gray-900 truncate">{item.task.title}</p>

                  {item.task.customerName && (
                    <p className="text-sm text-gray-500 mt-0.5">{item.task.customerName}</p>
                  )}

                  {item.task.description && (
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">{item.task.description}</p>
                  )}

                  {item.task.dueDate && (
                    <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
                      <Calendar className="h-3 w-3" />
                      <span>Fällig: {format(new Date(item.task.dueDate), 'dd.MM.yyyy HH:mm', { locale: de })}</span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {item.task.customerEmail && (
                    <button
                      onClick={() => handleEmail(item)}
                      title="E-Mail schreiben"
                      className="rounded-lg p-2 text-gray-400 hover:bg-white hover:text-blue-600 transition-colors"
                    >
                      <Mail className="h-4 w-4" />
                    </button>
                  )}
                  {item.task.customerPhone && (
                    <a
                      href={`tel:${item.task.customerPhone}`}
                      title="Anrufen"
                      className="rounded-lg p-2 text-gray-400 hover:bg-white hover:text-green-600 transition-colors"
                    >
                      <Phone className="h-4 w-4" />
                    </a>
                  )}
                  <button
                    onClick={() => handleMarkDone(item)}
                    disabled={markingId === item.task.id}
                    title="Als erledigt markieren"
                    className="flex items-center gap-1.5 rounded-lg bg-green-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-600 disabled:opacity-50 transition-colors"
                  >
                    {markingId === item.task.id
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <CheckCircle2 className="h-4 w-4" />
                    }
                    Erledigt
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

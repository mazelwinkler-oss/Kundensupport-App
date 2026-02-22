import { useState, useEffect } from 'react'
import { Search, CheckCircle, Clock, AlertTriangle, Loader2 } from 'lucide-react'
import { Card, CardContent } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { getTasks, updateTaskStatus, type Task } from '../../services/unified'
import { formatDistanceToNow } from 'date-fns'
import { de } from 'date-fns/locale'
import { cn } from '../../utils/cn'

interface TaskListProps {
  onTaskClick?: (task: Task) => void
}

const sourceLabels: Record<string, string> = {
  hubspot: 'HubSpot',
  weclapp: 'Weclapp',
  aircall: 'Aircall',
}

const typeLabels: Record<string, string> = {
  lead: 'Lead',
  ticket: 'Ticket',
  order: 'Auftrag',
  call: 'Anruf',
  payment: 'Zahlung',
}

const priorityConfig = {
  urgent: { label: 'Dringend', variant: 'danger' as const, icon: AlertTriangle },
  high: { label: 'Hoch', variant: 'warning' as const, icon: AlertTriangle },
  normal: { label: 'Normal', variant: 'default' as const, icon: Clock },
  low: { label: 'Niedrig', variant: 'default' as const, icon: Clock },
}

const statusConfig = {
  open: { label: 'Offen', color: 'text-blue-600 bg-blue-50' },
  in_progress: { label: 'In Bearbeitung', color: 'text-yellow-600 bg-yellow-50' },
  waiting: { label: 'Wartend', color: 'text-gray-600 bg-gray-50' },
  completed: { label: 'Erledigt', color: 'text-green-600 bg-green-50' },
}

export function TaskList({ onTaskClick }: TaskListProps) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [sourceFilter, setSourceFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const loadTasks = async () => {
    try {
      const filters: { source?: string; status?: string } = {}
      if (sourceFilter !== 'all') filters.source = sourceFilter
      if (statusFilter !== 'all') filters.status = statusFilter
      const data = await getTasks(filters)
      setTasks(data)
    } catch (error) {
      console.error('Failed to load tasks:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTasks()
  }, [sourceFilter, statusFilter])

  const handleStatusChange = async (taskId: string, status: Task['status']) => {
    try {
      await updateTaskStatus(taskId, status)
      loadTasks()
    } catch (error) {
      console.error('Failed to update status:', error)
    }
  }

  const filteredTasks = tasks.filter((task) => {
    const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.customerName?.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesSearch
  })

  // Sort by priority
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 }
    return priorityOrder[a.priority] - priorityOrder[b.priority]
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-500">Lade Aufgaben...</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Aufgaben</h2>
        <Badge>{tasks.length} Aufgaben</Badge>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Suchen..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Source Filter */}
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">Alle Quellen</option>
              <option value="hubspot">HubSpot</option>
              <option value="weclapp">Weclapp</option>
              <option value="aircall">Aircall</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">Alle Status</option>
              <option value="open">Offen</option>
              <option value="in_progress">In Bearbeitung</option>
              <option value="waiting">Wartend</option>
              <option value="completed">Erledigt</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Task List */}
      <div className="space-y-3">
        {sortedTasks.map((task) => {
          const priority = priorityConfig[task.priority]
          const status = statusConfig[task.status]
          const PriorityIcon = priority.icon

          return (
            <Card
              key={task.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => onTaskClick?.(task)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  {/* Priority indicator */}
                  <div className={cn(
                    'rounded-full p-2',
                    task.priority === 'urgent' ? 'bg-red-100 text-red-600' :
                    task.priority === 'high' ? 'bg-yellow-100 text-yellow-600' :
                    'bg-gray-100 text-gray-600'
                  )}>
                    <PriorityIcon className="h-4 w-4" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={task.source === 'hubspot' ? 'info' : task.source === 'weclapp' ? 'success' : 'default'}>
                        {sourceLabels[task.source]}
                      </Badge>
                      <Badge>{typeLabels[task.type]}</Badge>
                      <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', status.color)}>
                        {status.label}
                      </span>
                    </div>
                    <h3 className="mt-2 font-medium text-gray-900">{task.title}</h3>
                    {task.description && (
                      <p className="mt-1 text-sm text-gray-500 line-clamp-2">{task.description}</p>
                    )}
                    <div className="mt-2 flex items-center gap-4 text-sm text-gray-400">
                      {task.customerName && <span>{task.customerName}</span>}
                      <span>{formatDistanceToNow(new Date(task.createdAt), { addSuffix: true, locale: de })}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {task.status !== 'completed' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleStatusChange(task.id, 'completed')
                        }}
                      >
                        <CheckCircle className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}

        {sortedTasks.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-gray-500">
              Keine Aufgaben gefunden
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

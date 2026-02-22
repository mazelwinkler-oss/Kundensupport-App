import { AlertCircle, ArrowRight } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import type { Task } from '../../services/unified'
import { formatDistanceToNow } from 'date-fns'
import { de } from 'date-fns/locale'

interface UrgentTasksListProps {
  tasks: Task[]
  onTaskClick?: (task: Task) => void
}

const sourceLabels: Record<string, string> = {
  hubspot: 'HubSpot',
  weclapp: 'Weclapp',
  aircall: 'Aircall',
}

const typeLabels: Record<string, string> = {
  lead: 'Lead',
  ticket: 'Reklamation',
  order: 'Auftrag',
  call: 'Anruf',
  payment: 'Zahlung',
}

export function UrgentTasksList({ tasks, onTaskClick }: UrgentTasksListProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <CardTitle>Dringend</CardTitle>
        </div>
        <Badge variant="danger">{tasks.length}</Badge>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <p className="text-sm text-gray-500">Keine dringenden Aufgaben</p>
        ) : (
          <ul className="space-y-3">
            {tasks.map((task) => (
              <li
                key={task.id}
                className="flex items-center justify-between rounded-lg border p-3 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => onTaskClick?.(task)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant={task.source === 'hubspot' ? 'info' : 'default'}>
                      {sourceLabels[task.source]}
                    </Badge>
                    <Badge variant="warning">
                      {typeLabels[task.type]}
                    </Badge>
                  </div>
                  <p className="mt-1 font-medium text-gray-900 truncate">
                    {task.title}
                  </p>
                  {task.customerName && (
                    <p className="text-sm text-gray-500">{task.customerName}</p>
                  )}
                  <p className="text-xs text-gray-400">
                    {formatDistanceToNow(new Date(task.createdAt), {
                      addSuffix: true,
                      locale: de,
                    })}
                  </p>
                </div>
                <Button variant="ghost" size="sm">
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

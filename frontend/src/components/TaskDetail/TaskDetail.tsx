import { useState } from 'react'
import {
  Clock,
  User,
  Building,
  Mail,
  Phone,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Loader2
} from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { updateTaskStatus, type Task } from '../../services/unified'
import { formatDistanceToNow, format } from 'date-fns'
import { de } from 'date-fns/locale'
import { cn } from '../../utils/cn'

interface TaskDetailProps {
  task: Task | null
  isOpen: boolean
  onClose: () => void
  onStatusChange?: (task: Task) => void
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
  urgent: { label: 'Dringend', color: 'bg-red-100 text-red-700' },
  high: { label: 'Hoch', color: 'bg-orange-100 text-orange-700' },
  normal: { label: 'Normal', color: 'bg-blue-100 text-blue-700' },
  low: { label: 'Niedrig', color: 'bg-gray-100 text-gray-700' },
}

const statusConfig = {
  open: { label: 'Offen', color: 'bg-blue-100 text-blue-700' },
  in_progress: { label: 'In Bearbeitung', color: 'bg-yellow-100 text-yellow-700' },
  waiting: { label: 'Wartend', color: 'bg-gray-100 text-gray-700' },
  completed: { label: 'Erledigt', color: 'bg-green-100 text-green-700' },
}

export function TaskDetail({ task, isOpen, onClose, onStatusChange }: TaskDetailProps) {
  const [updating, setUpdating] = useState(false)

  if (!task) return null

  const priority = priorityConfig[task.priority]
  const status = statusConfig[task.status]

  const handleStatusChange = async (newStatus: Task['status']) => {
    setUpdating(true)
    try {
      const updatedTask = await updateTaskStatus(task.id, newStatus)
      if (onStatusChange) {
        onStatusChange(updatedTask)
      }
      if (newStatus === 'completed') {
        onClose()
      }
    } catch (error) {
      console.error('Failed to update status:', error)
    } finally {
      setUpdating(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Aufgabendetails">
      <div className="space-y-6">
        {/* Header with badges */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={task.source === 'hubspot' ? 'info' : task.source === 'weclapp' ? 'success' : 'default'}>
            {sourceLabels[task.source]}
          </Badge>
          <Badge>{typeLabels[task.type]}</Badge>
          <span className={cn('px-2.5 py-0.5 rounded-full text-xs font-medium', priority.color)}>
            {priority.label}
          </span>
          <span className={cn('px-2.5 py-0.5 rounded-full text-xs font-medium', status.color)}>
            {status.label}
          </span>
        </div>

        {/* Title */}
        <div>
          <h3 className="text-xl font-semibold text-gray-900">{task.title}</h3>
          {task.description && (
            <p className="mt-2 text-gray-600">{task.description}</p>
          )}
        </div>

        {/* Customer info */}
        {task.customerName && (
          <div className="rounded-lg border bg-gray-50 p-4">
            <h4 className="font-medium text-gray-900 mb-3">Kunde</h4>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-gray-400" />
                <span>{task.customerName}</span>
              </div>
              {(task as any).customerCompany && (
                <div className="flex items-center gap-2 text-sm">
                  <Building className="h-4 w-4 text-gray-400" />
                  <span>{(task as any).customerCompany}</span>
                </div>
              )}
              {(task as any).customerEmail && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <a href={`mailto:${(task as any).customerEmail}`} className="text-blue-600 hover:underline">
                    {(task as any).customerEmail}
                  </a>
                </div>
              )}
              {(task as any).customerPhone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-gray-400" />
                  <a href={`tel:${(task as any).customerPhone}`} className="text-blue-600 hover:underline">
                    {(task as any).customerPhone}
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Dates */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2 text-gray-600">
            <Clock className="h-4 w-4 text-gray-400" />
            <span>Erstellt: {formatDistanceToNow(new Date(task.createdAt), { addSuffix: true, locale: de })}</span>
          </div>
          {task.dueDate && (
            <div className="flex items-center gap-2 text-gray-600">
              <Calendar className="h-4 w-4 text-gray-400" />
              <span>Faellig: {format(new Date(task.dueDate), 'dd.MM.yyyy', { locale: de })}</span>
            </div>
          )}
        </div>

        {/* Priority warning */}
        {(task.priority === 'urgent' || task.priority === 'high') && task.status !== 'completed' && (
          <div className={cn(
            'flex items-center gap-2 rounded-lg p-3',
            task.priority === 'urgent' ? 'bg-red-50 text-red-700' : 'bg-orange-50 text-orange-700'
          )}>
            <AlertTriangle className="h-5 w-5" />
            <span className="font-medium">
              {task.priority === 'urgent' ? 'Dringende Aufgabe - sofortige Bearbeitung erforderlich!' : 'Hohe Prioritaet - zeitnahe Bearbeitung empfohlen'}
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between border-t pt-4">
          <div className="flex gap-2">
            {task.status === 'open' && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleStatusChange('in_progress')}
                disabled={updating}
              >
                {updating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                In Bearbeitung
              </Button>
            )}
            {task.status === 'in_progress' && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleStatusChange('waiting')}
                disabled={updating}
              >
                {updating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Wartend
              </Button>
            )}
          </div>

          {task.status !== 'completed' && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleStatusChange('completed')}
              disabled={updating}
            >
              {updating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle className="h-4 w-4 mr-1" />}
              Als erledigt markieren
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}

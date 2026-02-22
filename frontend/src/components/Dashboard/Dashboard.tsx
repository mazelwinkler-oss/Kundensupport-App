import { useState, useEffect } from 'react'
import { Users, Ticket, Package, Phone, Loader2 } from 'lucide-react'
import { StatsCard } from './StatsCard'
import { UrgentTasksList } from './UrgentTasksList'
import { AutomationSuggestions } from './AutomationSuggestions'
import { DelayAlerts } from './DelayAlerts'
import { getDashboardStats, type DashboardStats, type Task, type AtRiskOrder } from '../../services/unified'

interface DashboardProps {
  onTaskClick?: (task: Task) => void
}

export function Dashboard({ onTaskClick }: DashboardProps) {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getDashboardStats()
      .then(data => {
        setStats(data)
        setLoading(false)
      })
      .catch(err => {
        console.error('Failed to load dashboard:', err)
        setError('Fehler beim Laden der Daten')
        setLoading(false)
      })
  }, [])

  const handleTaskClick = (task: Task) => {
    if (onTaskClick) {
      onTaskClick(task)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-500">Lade Dashboard...</span>
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className="text-center py-12 text-red-500">
        <p>{error || 'Unbekannter Fehler'}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 text-blue-500 underline"
        >
          Erneut versuchen
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Support-Zentrale</h1>
        <p className="text-gray-500">Heute, {new Date().toLocaleDateString('de-DE', {
          weekday: 'long',
          day: 'numeric',
          month: 'long'
        })}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Neue Leads"
          value={stats.newLeads}
          icon={Users}
          color="blue"
        />
        <StatsCard
          title="Offene Reklamationen"
          value={stats.openTickets}
          icon={Ticket}
          color="red"
        />
        <StatsCard
          title="Auftraege in Bearbeitung"
          value={stats.pendingOrders}
          icon={Package}
          color="yellow"
        />
        <StatsCard
          title="Verpasste Anrufe"
          value={stats.missedCalls}
          icon={Phone}
          color="purple"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Urgent Tasks */}
        <UrgentTasksList
          tasks={stats.urgentTasks}
          onTaskClick={handleTaskClick}
        />

        {/* Delay Alerts */}
        <DelayAlerts
          onOrderClick={(order: AtRiskOrder) => {
            console.log('Order clicked:', order)
            // Could open order detail or Weclapp
          }}
        />
      </div>

      {/* Automation Suggestions - Full Width */}
      <AutomationSuggestions
        suggestions={stats.automationSuggestions}
        onSetup={(suggestion) => {
          console.log('Setup automation:', suggestion)
        }}
      />
    </div>
  )
}

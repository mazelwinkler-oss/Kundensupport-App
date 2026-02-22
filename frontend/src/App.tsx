import { useState, useCallback, useEffect } from 'react'
import { Sidebar } from './components/Layout/Sidebar'
import { Today } from './components/Today/Today'
import { Dashboard } from './components/Dashboard/Dashboard'
import { TaskList } from './components/TaskList/TaskList'
import { CustomerView } from './components/CustomerView/CustomerView'
import { TemplateList } from './components/Templates/TemplateList'
import { DailyPlan } from './components/DailyPlan/DailyPlan'
import { AutomationSuggestions } from './components/Automations/AutomationSuggestions'
import { Inbox } from './components/Inbox/Inbox'
import { ChatBot } from './components/Chatbot/ChatBot'
import { ChatbotTraining } from './components/Settings/ChatbotTraining'
import { TaskDetailFull } from './components/TaskDetail/TaskDetailFull'
import { Search, Wifi, WifiOff } from 'lucide-react'
import { api } from './services/api'
import type { Task } from './services/unified'

interface SyncStatus {
  isConfigured: boolean
  lastSync?: string
  lastStatus?: string
  customerCount?: number
}

function App() {
  const [currentPage, setCurrentPage] = useState('today')
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [isTaskDetailOpen, setIsTaskDetailOpen] = useState(false)
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null)

  // Load Weclapp sync status for header indicator
  useEffect(() => {
    api.get('/weclapp/sync-status')
      .then(r => setSyncStatus(r.data))
      .catch(() => {})
    // Refresh every 5 min
    const interval = setInterval(() => {
      api.get('/weclapp/sync-status').then(r => setSyncStatus(r.data)).catch(() => {})
    }, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const handleTaskClick = useCallback((task: Task) => {
    setSelectedTask(task)
    setIsTaskDetailOpen(true)
  }, [])

  const handleTaskDetailClose = useCallback(() => {
    setIsTaskDetailOpen(false)
    setSelectedTask(null)
  }, [])

  const handleTaskStatusChange = useCallback(() => {
    setIsTaskDetailOpen(false)
    setSelectedTask(null)
  }, [])

  const renderPage = () => {
    switch (currentPage) {
      case 'today':
        return <Today />
      case 'dashboard':
        return <Dashboard onTaskClick={handleTaskClick} />
      case 'daily-plan':
        return <DailyPlan />
      case 'tasks':
        return <TaskList onTaskClick={handleTaskClick} />
      case 'inbox':
        return <Inbox />
      case 'orders':
        return <TaskList onTaskClick={handleTaskClick} />
      case 'customers':
        return <CustomerView />
      case 'templates':
        return <TemplateList />
      case 'automations':
        return <AutomationSuggestions />
      case 'settings':
        return (
          <div className="space-y-8 max-w-3xl">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Einstellungen</h1>
              <p className="text-sm text-gray-500 mt-0.5">Konfiguration und Chatbot-Training</p>
            </div>
            <ChatbotTraining />
          </div>
        )
      default:
        return <Today />
    }
  }

  const syncOk = syncStatus?.isConfigured && syncStatus.lastStatus === 'success'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />

      {/* Main Content */}
      <div className="pl-56">
        {/* Header */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-white px-6 gap-4">
          {/* Search */}
          <div className="relative w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Kunden, Aufgaben, Bestellungen..."
              className="w-full rounded-lg border border-gray-200 bg-gray-50 py-1.5 pl-9 pr-4 text-sm focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {/* Weclapp sync status */}
            {syncStatus && (
              <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                syncOk ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'
              }`}>
                {syncOk
                  ? <Wifi className="h-3.5 w-3.5" />
                  : <WifiOff className="h-3.5 w-3.5" />}
                <span>
                  {syncOk
                    ? `Weclapp sync${syncStatus.customerCount ? ` · ${syncStatus.customerCount} Kunden` : ''}`
                    : 'Weclapp nicht verbunden'}
                </span>
              </div>
            )}

            {/* User badge */}
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white text-sm font-bold">
                M
              </div>
              <span className="text-sm font-medium text-gray-700">Marcel</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6">
          {renderPage()}
        </main>
      </div>

      {/* Global Task Detail (used by TaskList / Dashboard) */}
      <TaskDetailFull
        task={selectedTask}
        isOpen={isTaskDetailOpen}
        onClose={handleTaskDetailClose}
        onStatusChange={handleTaskStatusChange}
      />

      {/* Global ChatBot Widget – always visible */}
      <ChatBot />
    </div>
  )
}

export default App

import { useState, useCallback } from 'react'
import { Sidebar } from './components/Layout/Sidebar'
import { Dashboard } from './components/Dashboard/Dashboard'
import { TaskList } from './components/TaskList/TaskList'
import { CustomerView } from './components/CustomerView/CustomerView'
import { TemplateList } from './components/Templates/TemplateList'
import { TaskDetail } from './components/TaskDetail/TaskDetail'
import { Bell, Search, User } from 'lucide-react'
import type { Task } from './services/unified'

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard')
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [isTaskDetailOpen, setIsTaskDetailOpen] = useState(false)

  const handleTaskClick = useCallback((task: Task) => {
    setSelectedTask(task)
    setIsTaskDetailOpen(true)
  }, [])

  const handleTaskDetailClose = useCallback(() => {
    setIsTaskDetailOpen(false)
    setSelectedTask(null)
  }, [])

  const handleTaskStatusChange = useCallback(() => {
    // Refresh will happen via re-render
    setIsTaskDetailOpen(false)
    setSelectedTask(null)
  }, [])

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard onTaskClick={handleTaskClick} />
      case 'tasks':
        return <TaskList onTaskClick={handleTaskClick} />
      case 'customers':
        return <CustomerView />
      case 'templates':
        return <TemplateList />
      case 'analytics':
        return (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg font-medium">Analyse</p>
            <p className="text-sm">Kommt bald...</p>
          </div>
        )
      case 'automations':
        return (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg font-medium">Automatisierung</p>
            <p className="text-sm">n8n-Integration in Entwicklung...</p>
          </div>
        )
      case 'settings':
        return (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg font-medium">Einstellungen</p>
            <p className="text-sm">API-Konfiguration in Entwicklung...</p>
          </div>
        )
      default:
        return <Dashboard />
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />

      {/* Main Content */}
      <div className="pl-64">
        {/* Header */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-white px-6">
          {/* Search */}
          <div className="relative w-96">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Suchen nach Kunden, Aufgaben, Bestellungen..."
              className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-10 pr-4 text-sm focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Right side */}
          <div className="flex items-center gap-4">
            {/* Notifications */}
            <button className="relative rounded-full p-2 hover:bg-gray-100">
              <Bell className="h-5 w-5 text-gray-600" />
              <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-medium text-white">
                3
              </span>
            </button>

            {/* User */}
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">Max Mazel</p>
                <p className="text-xs text-gray-500">Support Manager</p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                <User className="h-5 w-5" />
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6">
          {renderPage()}
        </main>
      </div>

      {/* Task Detail Modal */}
      <TaskDetail
        task={selectedTask}
        isOpen={isTaskDetailOpen}
        onClose={handleTaskDetailClose}
        onStatusChange={handleTaskStatusChange}
      />
    </div>
  )
}

export default App

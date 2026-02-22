import { useState, useEffect } from 'react'
import { Zap, Copy, Check, RefreshCw, Loader2, Bot, Workflow } from 'lucide-react'
import { api } from '../../services/api'
import { cn } from '../../utils/cn'

interface AutomationSuggestion {
  id: string
  patternType: string
  title: string
  description: string
  frequency: number
  lastOccurrence: string
  n8nWorkflow: string
  claudePrompt: string
}

const TYPE_LABEL: Record<string, string> = {
  shipping_confirmation: 'Versandbestätigung',
  payment_reminder:     'Zahlungserinnerung',
  ticket_response:      'Reklamation',
  lead_followup:        'Lead-Follow-up',
}
const TYPE_COLOR: Record<string, string> = {
  shipping_confirmation: 'bg-blue-100 text-blue-700',
  payment_reminder:      'bg-orange-100 text-orange-700',
  ticket_response:       'bg-red-100 text-red-700',
  lead_followup:         'bg-green-100 text-green-700',
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={copy}
      className={cn(
        'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
        copied
          ? 'bg-green-100 text-green-700'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      )}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? 'Kopiert!' : label}
    </button>
  )
}

export function AutomationSuggestions() {
  const [suggestions, setSuggestions] = useState<AutomationSuggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Record<string, 'n8n' | 'claude' | null>>({})

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.get('/automations')
      setSuggestions(res.data?.suggestions || [])
    } catch {
      setSuggestions([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const toggle = (id: string, tab: 'n8n' | 'claude') => {
    setExpanded(prev => ({
      ...prev,
      [id]: prev[id] === tab ? null : tab,
    }))
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Automatisierungen</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Erkannte Muster aus deiner Arbeit – fertige Prompts zum Kopieren
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

      {/* Info box */}
      <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-700">
        <strong>So funktioniert es:</strong> Die App erkennt Aufgaben, die du regelmäßig manuell erledigst.
        Kopiere den Claude-Prompt oder die n8n-Beschreibung und automatisiere sie mit einem Klick.
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <span className="ml-3 text-gray-500">Analysiere Muster...</span>
        </div>
      )}

      {!loading && suggestions.length === 0 && (
        <div className="text-center py-16">
          <Zap className="h-12 w-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">Noch keine Automatisierungsmuster erkannt.</p>
          <p className="text-sm text-gray-400 mt-1">Bearbeite mehr Aufgaben, damit die App Muster erkennen kann.</p>
        </div>
      )}

      <div className="space-y-4">
        {suggestions.map(s => {
          const tab = expanded[s.id] || null
          return (
            <div key={s.id} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              {/* Card header */}
              <div className="p-5">
                <div className="flex items-start gap-4">
                  <div className="rounded-lg bg-blue-100 p-2.5 shrink-0">
                    <Zap className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', TYPE_COLOR[s.patternType] || 'bg-gray-100 text-gray-600')}>
                        {TYPE_LABEL[s.patternType] || s.patternType}
                      </span>
                      <span className="text-xs text-gray-400">{s.frequency}× diese Woche</span>
                    </div>
                    <h3 className="font-semibold text-gray-900">{s.title}</h3>
                    <p className="text-sm text-gray-500 mt-0.5">{s.description}</p>
                  </div>
                </div>
              </div>

              {/* Tab buttons */}
              <div className="flex gap-2 px-5 pb-4">
                <button
                  onClick={() => toggle(s.id, 'claude')}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    tab === 'claude' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                >
                  <Bot className="h-4 w-4" />
                  Claude-Prompt
                </button>
                <button
                  onClick={() => toggle(s.id, 'n8n')}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    tab === 'n8n' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                >
                  <Workflow className="h-4 w-4" />
                  n8n Workflow
                </button>
              </div>

              {/* Expanded content */}
              {tab === 'claude' && (
                <div className="border-t bg-purple-50 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide">Claude-Prompt</p>
                    <CopyButton text={s.claudePrompt} label="Prompt kopieren" />
                  </div>
                  <pre className="text-xs text-gray-700 whitespace-pre-wrap bg-white rounded-lg border border-purple-200 p-4 font-mono">
                    {s.claudePrompt}
                  </pre>
                </div>
              )}

              {tab === 'n8n' && (
                <div className="border-t bg-orange-50 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide">n8n Workflow-Beschreibung</p>
                    <CopyButton text={s.n8nWorkflow} label="Beschreibung kopieren" />
                  </div>
                  <pre className="text-xs text-gray-700 whitespace-pre-wrap bg-white rounded-lg border border-orange-200 p-4 font-mono">
                    {s.n8nWorkflow}
                  </pre>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

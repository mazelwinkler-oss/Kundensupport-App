import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, Save, X, Loader2, Bot, ChevronDown, ChevronUp } from 'lucide-react'
import { api } from '../../services/api'
import { cn } from '../../utils/cn'

interface KnowledgeEntry {
  id: string
  question: string
  answer: string
  category: string
  keywords?: string
  useCount?: number
  createdAt?: string
  updatedAt?: string
}

const CATEGORIES = ['general', 'products', 'delivery', 'pricing', 'technical', 'warranty', 'service']
const CAT_LABEL: Record<string, string> = {
  general: 'Allgemein', products: 'Produkte', delivery: 'Lieferung',
  pricing: 'Preise', technical: 'Technik', warranty: 'Garantie', service: 'Service',
}

function EntryForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial?: Partial<KnowledgeEntry>
  onSave: (data: Omit<KnowledgeEntry, 'id' | 'useCount' | 'createdAt' | 'updatedAt'>) => void
  onCancel: () => void
  saving: boolean
}) {
  const [question, setQuestion] = useState(initial?.question || '')
  const [answer, setAnswer] = useState(initial?.answer || '')
  const [category, setCategory] = useState(initial?.category || 'general')
  const [keywords, setKeywords] = useState(initial?.keywords || '')

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 space-y-3">
      <div>
        <label className="text-xs font-medium text-gray-500 mb-1 block">Frage</label>
        <input
          value={question}
          onChange={e => setQuestion(e.target.value)}
          placeholder="z.B. Wie lange dauert die Lieferung eines Outdoor-Whirlpools?"
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-500 mb-1 block">Antwort</label>
        <textarea
          value={answer}
          onChange={e => setAnswer(e.target.value)}
          rows={4}
          placeholder="Die Antwort, die der Chatbot verwenden soll..."
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none resize-none"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Kategorie</label>
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            {CATEGORIES.map(c => (
              <option key={c} value={c}>{CAT_LABEL[c] || c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Keywords (kommasepariert)</label>
          <input
            value={keywords}
            onChange={e => setKeywords(e.target.value)}
            placeholder="lieferzeit, versand, dauer"
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onCancel} className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
          <X className="h-4 w-4" /> Abbrechen
        </button>
        <button
          onClick={() => onSave({ question, answer, category, keywords })}
          disabled={saving || !question.trim() || !answer.trim()}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-300"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Speichern
        </button>
      </div>
    </div>
  )
}

export function ChatbotTraining() {
  const [entries, setEntries] = useState<KnowledgeEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filterCat, setFilterCat] = useState<string>('all')

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.get('/chatbot/knowledge')
      setEntries(res.data || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleCreate = async (data: Omit<KnowledgeEntry, 'id' | 'useCount' | 'createdAt' | 'updatedAt'>) => {
    setSaving(true)
    try {
      await api.post('/chatbot/knowledge', data)
      setShowForm(false)
      load()
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async (id: string, data: Omit<KnowledgeEntry, 'id' | 'useCount' | 'createdAt' | 'updatedAt'>) => {
    setSaving(true)
    try {
      await api.patch(`/chatbot/knowledge/${id}`, data)
      setEditId(null)
      load()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Eintrag wirklich löschen?')) return
    await api.delete(`/chatbot/knowledge/${id}`)
    load()
  }

  const filtered = filterCat === 'all' ? entries : entries.filter(e => e.category === filterCat)
  const categories = [...new Set(entries.map(e => e.category))]

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-blue-100 p-2.5">
          <Bot className="h-6 w-6 text-blue-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Chatbot trainieren</h2>
          <p className="text-sm text-gray-500">Wissen für den SpaVida® Produkt-Assistenten verwalten</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditId(null) }}
          className="ml-auto flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" /> Eintrag hinzufügen
        </button>
      </div>

      {/* New entry form */}
      {showForm && (
        <EntryForm
          onSave={handleCreate}
          onCancel={() => setShowForm(false)}
          saving={saving}
        />
      )}

      {/* Stats + filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm text-gray-500">{entries.length} Einträge</span>
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setFilterCat('all')}
            className={cn('rounded-full px-3 py-1 text-xs font-medium transition-colors',
              filterCat === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}
          >
            Alle
          </button>
          {categories.map(c => (
            <button
              key={c}
              onClick={() => setFilterCat(c)}
              className={cn('rounded-full px-3 py-1 text-xs font-medium transition-colors',
                filterCat === c ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}
            >
              {CAT_LABEL[c] || c}
            </button>
          ))}
        </div>
      </div>

      {/* Entries */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-blue-500 mr-2" />
          <span className="text-gray-500">Lade Wissensbasis...</span>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(entry => (
            <div key={entry.id} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              {editId === entry.id ? (
                <div className="p-4">
                  <EntryForm
                    initial={entry}
                    onSave={data => handleUpdate(entry.id, data)}
                    onCancel={() => setEditId(null)}
                    saving={saving}
                  />
                </div>
              ) : (
                <>
                  <div
                    className="flex items-start gap-3 p-4 cursor-pointer hover:bg-gray-50"
                    onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                          {CAT_LABEL[entry.category] || entry.category}
                        </span>
                        {entry.useCount !== undefined && entry.useCount > 0 && (
                          <span className="text-xs text-gray-400">{entry.useCount}× genutzt</span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-gray-900">{entry.question}</p>
                      {expandedId !== entry.id && (
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{entry.answer}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={e => { e.stopPropagation(); setEditId(entry.id) }}
                        className="rounded-lg p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                        title="Bearbeiten"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); handleDelete(entry.id) }}
                        className="rounded-lg p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50"
                        title="Löschen"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      {expandedId === entry.id
                        ? <ChevronUp className="h-4 w-4 text-gray-400" />
                        : <ChevronDown className="h-4 w-4 text-gray-400" />
                      }
                    </div>
                  </div>

                  {expandedId === entry.id && (
                    <div className="border-t bg-gray-50 px-4 py-3 space-y-2">
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{entry.answer}</p>
                      {entry.keywords && (
                        <p className="text-xs text-gray-400">Keywords: {entry.keywords}</p>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="text-sm text-gray-400 italic text-center py-8">
              Keine Einträge in dieser Kategorie.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

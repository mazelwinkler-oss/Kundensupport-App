import { useState, useEffect } from 'react'
import { FileText, Copy, Plus, Check, Loader2, TrendingUp, Send, X } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { getTemplates, sendEmail, type Template } from '../../services/unified'
import { cn } from '../../utils/cn'

interface TemplateListProps {
  onSelectTemplate?: (template: Template) => void
}

const categoryColors: Record<string, string> = {
  Versand: 'bg-blue-100 text-blue-800',
  Reklamation: 'bg-red-100 text-red-800',
  Finanzen: 'bg-green-100 text-green-800',
  Allgemein: 'bg-gray-100 text-gray-800',
  Lieferverzoegerung: 'bg-yellow-100 text-yellow-800',
  Produktinfo: 'bg-purple-100 text-purple-800',
}

interface SendModalState {
  template: Template
  to: string
  subject: string
  body: string
  sending: boolean
  sent: boolean
  error: string | null
}

export function TemplateList({ onSelectTemplate }: TemplateListProps) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [sendModal, setSendModal] = useState<SendModalState | null>(null)

  useEffect(() => {
    loadTemplates()
  }, [])

  const loadTemplates = async () => {
    try {
      setLoading(true)
      const data = await getTemplates()
      setTemplates(data)
      setError(null)
    } catch (err) {
      console.error('Failed to load templates:', err)
      setError('Fehler beim Laden der Vorlagen')
    } finally {
      setLoading(false)
    }
  }

  const categories = ['all', ...new Set(templates.map(t => t.category))]

  const filteredTemplates = selectedCategory === 'all'
    ? templates
    : templates.filter(t => t.category === selectedCategory)

  // Sort by usage count (most used first)
  const sortedTemplates = [...filteredTemplates].sort((a, b) =>
    (b.usageCount || 0) - (a.usageCount || 0)
  )

  const handleCopy = async (template: Template) => {
    await navigator.clipboard.writeText(template.content)
    setCopiedId(template.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleOpenSend = (template: Template) => {
    setSendModal({
      template,
      to: '',
      subject: template.subject || '',
      body: template.content,
      sending: false,
      sent: false,
      error: null,
    })
  }

  const handleSend = async () => {
    if (!sendModal) return
    setSendModal(m => m ? { ...m, sending: true, error: null } : null)
    try {
      const result = await sendEmail({
        to: sendModal.to,
        subject: sendModal.subject,
        body: sendModal.body,
      })
      if (result.method === 'mailto' && result.mailtoLink) {
        window.open(result.mailtoLink)
        setSendModal(null)
      } else {
        setSendModal(m => m ? { ...m, sending: false, sent: true } : null)
        setTimeout(() => setSendModal(null), 1500)
      }
    } catch {
      setSendModal(m => m ? { ...m, sending: false, error: 'Fehler beim Senden' } : null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-500">Lade Vorlagen...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500">{error}</p>
        <button
          onClick={loadTemplates}
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Vorlagen</h2>
          <p className="text-sm text-gray-500">
            {templates.length} Vorlagen verfuegbar
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Neue Vorlage
        </Button>
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 flex-wrap">
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={cn(
              'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
              selectedCategory === category
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            {category === 'all' ? 'Alle' : category}
          </button>
        ))}
      </div>

      {/* Template Grid */}
      {sortedTemplates.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <FileText className="h-12 w-12 mx-auto mb-2 text-gray-300" />
          <p>Keine Vorlagen gefunden</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {sortedTemplates.map((template) => (
            <Card key={template.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-gray-400" />
                    <CardTitle className="text-base">{template.name}</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    {template.usageCount > 0 && (
                      <span className="flex items-center text-xs text-gray-500">
                        <TrendingUp className="h-3 w-3 mr-1" />
                        {template.usageCount}x
                      </span>
                    )}
                    <span className={cn(
                      'rounded-full px-2 py-0.5 text-xs font-medium',
                      categoryColors[template.category] || 'bg-gray-100 text-gray-800'
                    )}>
                      {template.category}
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {template.subject && (
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    Betreff: {template.subject}
                  </p>
                )}
                <p className="text-sm text-gray-500 line-clamp-3 whitespace-pre-line">
                  {template.content}
                </p>

                {/* Placeholders */}
                <div className="mt-3 flex flex-wrap gap-1">
                  {template.placeholders.map((placeholder) => (
                    <Badge key={placeholder} variant="default">
                      {'{' + placeholder + '}'}
                    </Badge>
                  ))}
                </div>

                {/* Actions */}
                <div className="mt-4 flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleCopy(template)}
                  >
                    {copiedId === template.id ? (
                      <>
                        <Check className="h-4 w-4 mr-1" />
                        Kopiert
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-1" />
                        Kopieren
                      </>
                    )}
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleOpenSend(template)}
                  >
                    <Send className="h-4 w-4 mr-1" />
                    Senden
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* E-Mail Send Modal */}
      {sendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">E-Mail senden</h3>
              <button onClick={() => setSendModal(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Empfänger</label>
                <input
                  type="email"
                  value={sendModal.to}
                  onChange={e => setSendModal(m => m ? { ...m, to: e.target.value } : null)}
                  placeholder="kunde@beispiel.de"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Betreff</label>
                <input
                  type="text"
                  value={sendModal.subject}
                  onChange={e => setSendModal(m => m ? { ...m, subject: e.target.value } : null)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Text</label>
                <textarea
                  rows={8}
                  value={sendModal.body}
                  onChange={e => setSendModal(m => m ? { ...m, body: e.target.value } : null)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {sendModal.error && (
              <p className="text-sm text-red-500">{sendModal.error}</p>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" size="sm" onClick={() => setSendModal(null)}>
                Abbrechen
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSend}
                disabled={sendModal.sending || !sendModal.to || sendModal.sent}
              >
                {sendModal.sent ? (
                  <><Check className="h-4 w-4 mr-1" />Gesendet</>
                ) : sendModal.sending ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-1" />Wird gesendet...</>
                ) : (
                  <><Send className="h-4 w-4 mr-1" />Senden</>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

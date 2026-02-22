import { useState, useEffect } from 'react'
import { X, Send, FileText, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { getTemplates, applyTemplate, sendEmail } from '../../services/unified'
import type { Template, Task } from '../../services/unified'
import { cn } from '../../utils/cn'

interface EmailComposerProps {
  isOpen: boolean
  onClose: () => void
  task?: Task | null
  defaultTo?: string
  defaultSubject?: string
  customerName?: string
  onSent?: () => void
}

export function EmailComposer({
  isOpen,
  onClose,
  task,
  defaultTo = '',
  defaultSubject = '',
  customerName,
  onSent,
}: EmailComposerProps) {
  const [to, setTo] = useState(defaultTo)
  const [subject, setSubject] = useState(defaultSubject)
  const [body, setBody] = useState('')
  const [templates, setTemplates] = useState<Template[]>([])
  const [showTemplates, setShowTemplates] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [mailtoFallback, setMailtoFallback] = useState('')

  useEffect(() => {
    if (isOpen) {
      setTo(defaultTo)
      setSubject(defaultSubject)
      setBody('')
      setSent(false)
      setError('')
      setMailtoFallback('')
      getTemplates().then(setTemplates).catch(() => {})
    }
  }, [isOpen, defaultTo, defaultSubject])

  const applySelectedTemplate = async (template: Template) => {
    const lastName = customerName?.split(' ').slice(-1)[0] || customerName || ''
    const vars: Record<string, string> = {
      Supportname: 'Marcel',
      Nachname: lastName,
      Anrede: 'Herr',
      Bestellnummer: (task?.metadata as Record<string, string>)?.orderNumber || '',
      Ticketnummer: task?.id?.slice(0, 8).toUpperCase() || '',
      Problembeschreibung: task?.title || '',
      Lieferdatum: '',
    }
    try {
      const filled = await applyTemplate(template.id, vars)
      setBody(filled)
      if (template.subject) {
        let sub = template.subject
        Object.entries(vars).forEach(([k, v]) => { sub = sub.replaceAll(`{${k}}`, v) })
        setSubject(sub)
      }
    } catch {
      setBody(template.content)
      if (template.subject) setSubject(template.subject)
    }
    setShowTemplates(false)
  }

  const handleSend = async () => {
    if (!to.trim() || !body.trim()) {
      setError('Empfänger und Inhalt sind erforderlich.')
      return
    }
    setSending(true)
    setError('')
    try {
      const result = await sendEmail({ to, subject, body })
      if (result.method === 'mailto' && result.mailtoLink) {
        setMailtoFallback(result.mailtoLink)
        window.open(result.mailtoLink, '_blank')
      }
      setSent(true)
      onSent?.()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Fehler beim Senden')
    } finally {
      setSending(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-xl shadow-2xl flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-semibold text-gray-900">E-Mail schreiben</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-gray-100">
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>

        {sent ? (
          /* Success state */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-4">
            <div className="rounded-full bg-green-100 p-4">
              <Send className="h-8 w-8 text-green-600" />
            </div>
            <div>
              <p className="text-lg font-semibold text-gray-900">E-Mail versendet!</p>
              <p className="text-sm text-gray-500 mt-1">
                {mailtoFallback
                  ? 'Ihr E-Mail-Programm wurde geöffnet.'
                  : 'Die E-Mail wurde erfolgreich gesendet und in Weclapp gespeichert.'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Schließen
            </button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {/* To */}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">An</label>
                <input
                  value={to}
                  onChange={e => setTo(e.target.value)}
                  placeholder="email@beispiel.de"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Subject */}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Betreff</label>
                <input
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder="Betreff eingeben..."
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Template picker */}
              <div>
                <button
                  onClick={() => setShowTemplates(v => !v)}
                  className="flex items-center gap-2 text-xs font-medium text-blue-600 hover:text-blue-700"
                >
                  <FileText className="h-3.5 w-3.5" />
                  Vorlage verwenden
                  {showTemplates ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
                {showTemplates && (
                  <div className="mt-2 rounded-lg border border-gray-200 divide-y overflow-hidden max-h-48 overflow-y-auto">
                    {templates.length === 0 && (
                      <p className="p-3 text-sm text-gray-400">Keine Vorlagen gefunden</p>
                    )}
                    {templates.map(t => (
                      <button
                        key={t.id}
                        onClick={() => applySelectedTemplate(t)}
                        className="w-full text-left px-3 py-2.5 hover:bg-blue-50 transition-colors"
                      >
                        <p className="text-sm font-medium text-gray-900">{t.name}</p>
                        <p className="text-xs text-gray-500 capitalize">{t.category}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Body */}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Inhalt</label>
                <textarea
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  rows={10}
                  placeholder="E-Mail-Text eingeben oder Vorlage wählen..."
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                />
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-5 py-4 border-t bg-gray-50 rounded-b-xl">
              <p className="text-xs text-gray-400">
                {body.length > 0 ? `${body.length} Zeichen` : 'Vorlage wählen oder Text eingeben'}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleSend}
                  disabled={sending || !to.trim() || !body.trim()}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors',
                    sending || !to.trim() || !body.trim()
                      ? 'bg-gray-300 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700'
                  )}
                >
                  {sending
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Send className="h-4 w-4" />}
                  {sending ? 'Sende...' : 'Senden'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

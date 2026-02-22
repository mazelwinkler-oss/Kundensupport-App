import { Lightbulb, Zap } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card'
import { Button } from '../ui/Button'
import type { AutomationSuggestion } from '../../services/unified'

interface AutomationSuggestionsProps {
  suggestions: AutomationSuggestion[]
  onSetup?: (suggestion: AutomationSuggestion) => void
}

export function AutomationSuggestions({ suggestions, onSetup }: AutomationSuggestionsProps) {
  if (suggestions.length === 0) return null

  return (
    <Card className="border-yellow-200 bg-yellow-50/50">
      <CardHeader className="flex flex-row items-center gap-2">
        <Lightbulb className="h-5 w-5 text-yellow-600" />
        <CardTitle className="text-yellow-800">Automatisierungs-Vorschlag</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-4">
          {suggestions.map((suggestion) => (
            <li key={suggestion.id} className="rounded-lg bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">{suggestion.title}</h4>
                  <p className="mt-1 text-sm text-gray-600">{suggestion.description}</p>
                  <div className="mt-2 flex items-center gap-4 text-sm">
                    <span className="text-gray-500">
                      {suggestion.frequency}x diese Woche
                    </span>
                    <span className="text-green-600 font-medium">
                      ~{suggestion.potentialTimeSaved} Zeitersparnis
                    </span>
                  </div>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => onSetup?.(suggestion)}
                >
                  <Zap className="h-4 w-4 mr-1" />
                  Einrichten
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

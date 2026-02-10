import { useState, useEffect } from 'react'
import { X } from 'lucide-react'

// Define AppSettings interface to match the backend
interface AppSettings {
  ANTHROPIC_BASE_URL: string
  ANTHROPIC_AUTH_TOKEN: string
  API_TIMEOUT_MS: string
  ANTHROPIC_MODEL: string
  ANTHROPIC_DEFAULT_HAIKU_MODEL: string
  ANTHROPIC_DEFAULT_OPUS_MODEL: string
  ANTHROPIC_DEFAULT_SONNET_MODEL: string
}

const DEFAULT_SETTINGS: AppSettings = {
  ANTHROPIC_BASE_URL: 'https://api.anthropic.com/v1',
  ANTHROPIC_AUTH_TOKEN: '',
  API_TIMEOUT_MS: '3000000',
  ANTHROPIC_MODEL: 'claude-haiku-4-5-20251001',
  ANTHROPIC_DEFAULT_HAIKU_MODEL: 'claude-haiku-4-5-20251001',
  ANTHROPIC_DEFAULT_OPUS_MODEL: 'claude-opus-4-5-20251101',
  ANTHROPIC_DEFAULT_SONNET_MODEL: 'claude-sonnet-4-5-20250929'
}

interface SettingsDialogProps {
  isOpen: boolean
  onClose: () => void
}

export function SettingsDialog({ isOpen, onClose }: SettingsDialogProps): React.JSX.Element | null {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      loadSettings()
    }
  }, [isOpen])

  async function loadSettings(): Promise<void> {
    setLoading(true)
    setError(null)
    try {
      const res = await window.electron.settingsGetAll()
      if (res.success && res.data) {
        setSettings(res.data as AppSettings)
      } else {
        setError(res.error || 'Failed to load settings')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error loading settings')
    } finally {
      setLoading(false)
    }
  }

  async function handleSave(): Promise<void> {
    setSaving(true)
    setError(null)
    try {
      // Save each setting
      const promises = Object.entries(settings).map(([key, value]) =>
        window.electron.settingsSet(key, value)
      )

      const results = await Promise.all(promises)
      const failed = results.filter((r) => !r.success)

      if (failed.length > 0) {
        throw new Error('Failed to save some settings')
      }

      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error saving settings')
    } finally {
      setSaving(false)
    }
  }

  const handleChange = (key: keyof AppSettings, value: string): void => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="w-[600px] rounded-lg border border-border bg-card shadow-lg">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="text-lg font-semibold text-foreground">Settings</h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 hover:bg-accent hover:text-accent-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-6">
          {loading ? (
            <div className="text-center text-sm text-muted-foreground">Loading settings...</div>
          ) : (
            <div className="space-y-4">
              {error && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="grid gap-2">
                <label className="text-sm font-medium text-foreground">Anthropic Base URL</label>
                <input
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={settings.ANTHROPIC_BASE_URL}
                  onChange={(e) => handleChange('ANTHROPIC_BASE_URL', e.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium text-foreground">Anthropic Auth Token</label>
                <input
                  type="password"
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={settings.ANTHROPIC_AUTH_TOKEN}
                  onChange={(e) => handleChange('ANTHROPIC_AUTH_TOKEN', e.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium text-foreground">API Timeout (ms)</label>
                <input
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={settings.API_TIMEOUT_MS}
                  onChange={(e) => handleChange('API_TIMEOUT_MS', e.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium text-foreground">Default Model</label>
                <input
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={settings.ANTHROPIC_MODEL}
                  onChange={(e) => handleChange('ANTHROPIC_MODEL', e.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium text-foreground">Default Haiku Model</label>
                <input
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={settings.ANTHROPIC_DEFAULT_HAIKU_MODEL}
                  onChange={(e) => handleChange('ANTHROPIC_DEFAULT_HAIKU_MODEL', e.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium text-foreground">Default Opus Model</label>
                <input
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={settings.ANTHROPIC_DEFAULT_OPUS_MODEL}
                  onChange={(e) => handleChange('ANTHROPIC_DEFAULT_OPUS_MODEL', e.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium text-foreground">Default Sonnet Model</label>
                <input
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={settings.ANTHROPIC_DEFAULT_SONNET_MODEL}
                  onChange={(e) => handleChange('ANTHROPIC_DEFAULT_SONNET_MODEL', e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-border p-4">
          <button
            onClick={onClose}
            className="rounded-md px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

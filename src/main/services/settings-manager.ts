import Store from 'electron-store'

export interface AppSettings {
  ANTHROPIC_BASE_URL: string
  ANTHROPIC_AUTH_TOKEN: string
  API_TIMEOUT_MS: string
  ANTHROPIC_MODEL: string
  ANTHROPIC_DEFAULT_HAIKU_MODEL: string
  ANTHROPIC_DEFAULT_OPUS_MODEL: string
  ANTHROPIC_DEFAULT_SONNET_MODEL: string
}

export const DEFAULT_SETTINGS: AppSettings = {
  ANTHROPIC_BASE_URL: 'https://api.anthropic.com/v1',
  ANTHROPIC_AUTH_TOKEN: '',
  API_TIMEOUT_MS: '3000000',
  ANTHROPIC_MODEL: 'claude-haiku-4-5-20251001',
  ANTHROPIC_DEFAULT_HAIKU_MODEL: 'claude-haiku-4-5-20251001',
  ANTHROPIC_DEFAULT_OPUS_MODEL: 'claude-opus-4-5-20251101',
  ANTHROPIC_DEFAULT_SONNET_MODEL: 'claude-sonnet-4-5-20250929'
}

export class SettingsManager {
  private store: Store<AppSettings>

  constructor() {
    this.store = new Store<AppSettings>({
      defaults: DEFAULT_SETTINGS
    })
  }

  get<K extends keyof AppSettings>(key: K): AppSettings[K] {
    return this.store.get(key)
  }

  getAll(): AppSettings {
    return this.store.store
  }

  set<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
    this.store.set(key, value)
  }
}

export const settingsManager = new SettingsManager()

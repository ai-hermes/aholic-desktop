import type { ElectronAPI as BaseElectronAPI } from '@electron-toolkit/preload'

type NativeTheme = 'dark' | 'light'

interface AppElectronAPI extends BaseElectronAPI {
  getNativeTheme: () => Promise<{ success: boolean; data?: NativeTheme }>
  onThemeChange: (callback: (theme: NativeTheme) => void) => () => void
  sessionsGetAll: () => Promise<{
    success: boolean
    data?: unknown
    error?: string
  }>
  sessionsGet: (
    sessionId: string,
    projectEncoded: string
  ) => Promise<{
    success: boolean
    data?: unknown
    error?: string
  }>
  sessionsExportMarkdown: (
    sessionId: string,
    projectEncoded: string
  ) => Promise<{
    success: boolean
    data?: unknown
    error?: string
  }>

  terminalSpawn: (options?: unknown) => Promise<{ success: boolean; data?: string; error?: string }>
  terminalWrite: (id: string, data: string) => void
  terminalResize: (id: string, cols: number, rows: number) => void
  terminalKill: (id: string) => Promise<{ success: boolean; error?: string }>
  onTerminalData: (callback: (id: string, data: string) => void) => () => void
  onTerminalExit: (callback: (id: string, exitCode: number, signal?: number) => void) => () => void

  claudeChatCreate: (params?: { model?: string; resume?: string }) => Promise<{
    success: boolean
    data?: { chatId: string }
    error?: string
  }>
  claudeChatSend: (params: {
    chatId: string
    input: string
  }) => Promise<{ success: boolean; error?: string }>
  claudeChatClose: (params: { chatId: string }) => Promise<{ success: boolean; error?: string }>
  onClaudeChatEvent: (callback: (payload: { chatId: string; event: unknown }) => void) => () => void

  settingsGet: (key: string) => Promise<{ success: boolean; data?: unknown; error?: string }>
  settingsGetAll: () => Promise<{ success: boolean; data?: unknown; error?: string }>
  settingsSet: (key: string, value: unknown) => Promise<{ success: boolean; error?: string }>
}

declare global {
  interface Window {
    electron: AppElectronAPI
    api: unknown
  }
}

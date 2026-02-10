import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI as baseElectronAPI } from '@electron-toolkit/preload'

// Extend the default ElectronAPI with app-specific IPC helpers
const appElectronAPI = {
  ...baseElectronAPI,

  // Theme
  getNativeTheme: (): Promise<{ success: boolean; data?: 'light' | 'dark' }> =>
    ipcRenderer.invoke('theme:getNative'),
  onThemeChange: (callback: (theme: 'light' | 'dark') => void): (() => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, theme: 'light' | 'dark'): void =>
      callback(theme)
    ipcRenderer.on('theme:changed', subscription)
    return () => {
      ipcRenderer.removeListener('theme:changed', subscription)
    }
  },

  // Sessions
  sessionsGetAll: (): Promise<{ success: boolean; data?: unknown; error?: string }> =>
    ipcRenderer.invoke('sessions:getAll'),
  sessionsGet: (
    sessionId: string,
    projectEncoded: string
  ): Promise<{ success: boolean; data?: unknown; error?: string }> =>
    ipcRenderer.invoke('sessions:get', { sessionId, projectEncoded }),
  sessionsExportMarkdown: (
    sessionId: string,
    projectEncoded: string
  ): Promise<{ success: boolean; data?: unknown; error?: string }> =>
    ipcRenderer.invoke('sessions:exportMarkdown', { sessionId, projectEncoded }),

  // Terminal
  terminalSpawn: (
    options?: unknown
  ): Promise<{ success: boolean; data?: string; error?: string }> =>
    ipcRenderer.invoke('terminal:spawn', options),
  terminalWrite: (id: string, data: string) => ipcRenderer.send('terminal:write', { id, data }),
  terminalResize: (id: string, cols: number, rows: number) =>
    ipcRenderer.send('terminal:resize', { id, cols, rows }),
  terminalKill: (id: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('terminal:kill', id),
  onTerminalData: (callback: (id: string, data: string) => void): (() => void) => {
    const subscription = (
      _event: Electron.IpcRendererEvent,
      payload: { id: string; data: string }
    ): void => callback(payload.id, payload.data)
    ipcRenderer.on('terminal:data', subscription)
    return () => {
      ipcRenderer.removeListener('terminal:data', subscription)
    }
  },
  onTerminalExit: (
    callback: (id: string, exitCode: number, signal?: number) => void
  ): (() => void) => {
    const subscription = (
      _event: Electron.IpcRendererEvent,
      payload: { id: string; exitCode: number; signal?: number }
    ): void => callback(payload.id, payload.exitCode, payload.signal)
    ipcRenderer.on('terminal:exit', subscription)
    return () => {
      ipcRenderer.removeListener('terminal:exit', subscription)
    }
  },

  // Claude Chat
  claudeChatCreate: (params?: {
    model?: string
  }): Promise<{ success: boolean; data?: { chatId: string }; error?: string }> =>
    ipcRenderer.invoke('claudeChat:create', params),
  claudeChatSend: (params: {
    chatId: string
    input: string
  }): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('claudeChat:send', params),
  claudeChatClose: (params: { chatId: string }): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('claudeChat:close', params),
  onClaudeChatEvent: (
    callback: (payload: { chatId: string; event: unknown }) => void
  ): (() => void) => {
    const subscription = (
      _event: Electron.IpcRendererEvent,
      payload: { chatId: string; event: unknown }
    ): void => callback(payload)
    ipcRenderer.on('claudeChat:event', subscription)
    return () => {
      ipcRenderer.removeListener('claudeChat:event', subscription)
    }
  }
}

const api = {}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', appElectronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = appElectronAPI
  // @ts-ignore (define in dts)
  window.api = api
}

import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI as baseElectronAPI } from '@electron-toolkit/preload'

// Extend the default ElectronAPI with Sessionly-specific IPC helpers
const sessionlyElectronAPI = {
  ...baseElectronAPI,

  // Theme
  getNativeTheme: () => ipcRenderer.invoke('theme:getNative'),
  onThemeChange: (callback: (theme: 'light' | 'dark') => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, theme: 'light' | 'dark') =>
      callback(theme)
    ipcRenderer.on('theme:changed', subscription)
    return () => {
      ipcRenderer.removeListener('theme:changed', subscription)
    }
  },

  // Sessions
  sessionsGetAll: () => ipcRenderer.invoke('sessions:getAll'),
  sessionsGet: (sessionId: string, projectEncoded: string) =>
    ipcRenderer.invoke('sessions:get', { sessionId, projectEncoded }),
  sessionsExportMarkdown: (sessionId: string, projectEncoded: string) =>
    ipcRenderer.invoke('sessions:exportMarkdown', { sessionId, projectEncoded }),

  // Terminal
  terminalSpawn: (options?: unknown) => ipcRenderer.invoke('terminal:spawn', options),
  terminalWrite: (id: string, data: string) => ipcRenderer.send('terminal:write', { id, data }),
  terminalResize: (id: string, cols: number, rows: number) =>
    ipcRenderer.send('terminal:resize', { id, cols, rows }),
  terminalKill: (id: string) => ipcRenderer.invoke('terminal:kill', id),
  onTerminalData: (callback: (id: string, data: string) => void) => {
    const subscription = (
      _event: Electron.IpcRendererEvent,
      payload: { id: string; data: string }
    ) => callback(payload.id, payload.data)
    ipcRenderer.on('terminal:data', subscription)
    return () => {
      ipcRenderer.removeListener('terminal:data', subscription)
    }
  },
  onTerminalExit: (callback: (id: string, exitCode: number, signal?: number) => void) => {
    const subscription = (
      _event: Electron.IpcRendererEvent,
      payload: { id: string; exitCode: number; signal?: number }
    ) => callback(payload.id, payload.exitCode, payload.signal)
    ipcRenderer.on('terminal:exit', subscription)
    return () => {
      ipcRenderer.removeListener('terminal:exit', subscription)
    }
  }
}

const api = {}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', sessionlyElectronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = sessionlyElectronAPI
  // @ts-ignore (define in dts)
  window.api = api
}

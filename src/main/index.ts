import { app, shell, BrowserWindow, ipcMain, nativeTheme, dialog } from 'electron'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import icon from '../../resources/logo.png?asset'
import type { TerminalOptions } from './terminal-manager'
import { loadWindowState, saveWindowState } from './window-state'
import { ClaudeChatManager } from './services/claude-chat-manager'

// Utility to check if running in development mode (electron-vite sets this in dev)
const isDev = !!process.env['ELECTRON_RENDERER_URL']

// Note: main process currently provides only a minimal window shell.

const claudeChatManager = new ClaudeChatManager()

async function createWindow(): Promise<void> {
  const persistedState = await loadWindowState()

  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: persistedState?.width ?? 900,
    height: persistedState?.height ?? 670,
    show: false,
    autoHideMenuBar: true,
    title: 'aholic',
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  if (persistedState?.isMaximized) {
    mainWindow.maximize()
  }

  let saveTimer: NodeJS.Timeout | undefined
  const scheduleSave = (): void => {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      void saveWindowState(mainWindow)
    }, 250)
  }

  mainWindow.on('resized', scheduleSave)
  mainWindow.on('moved', scheduleSave)
  mainWindow.on('maximize', scheduleSave)
  mainWindow.on('unmaximize', scheduleSave)
  mainWindow.on('close', () => {
    if (saveTimer) clearTimeout(saveTimer)
    void saveWindowState(mainWindow)
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  app.setAppUserModelId('com.electron')

  // Basic IPC handlers needed by the renderer
  ipcMain.handle('theme:getNative', async () => {
    const isDark = nativeTheme.shouldUseDarkColors
    return { success: true, data: isDark ? 'dark' : 'light' }
  })

  nativeTheme.on('updated', () => {
    const isDark = nativeTheme.shouldUseDarkColors
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send('theme:changed', isDark ? 'dark' : 'light')
    })
  })

  ipcMain.handle('sessions:getAll', async () => {
    try {
      const { getAllSessions } = await import('./services/session-store')
      const groups = await getAllSessions()
      return { success: true, data: groups }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get sessions'
      }
    }
  })
  ipcMain.handle(
    'sessions:get',
    async (_event, params: { sessionId: string; projectEncoded: string }) => {
      try {
        const { getSession } = await import('./services/session-store')
        const session = await getSession(params.sessionId, params.projectEncoded)
        if (!session) {
          return { success: false, error: 'Session not found' }
        }
        return { success: true, data: session }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get session'
        }
      }
    }
  )

  ipcMain.handle(
    'sessions:exportMarkdown',
    async (event, params: { sessionId: string; projectEncoded: string }) => {
      try {
        const { getSession } = await import('./services/session-store')
        const { sessionToMarkdown, generateExportFilename } =
          await import('./services/markdown-export')

        const session = await getSession(params.sessionId, params.projectEncoded)
        if (!session) {
          return { success: false, error: 'Session not found' }
        }

        const markdown = sessionToMarkdown(session)
        const defaultFilename = generateExportFilename(session)

        const window = BrowserWindow.fromWebContents(event.sender)
        const result = await dialog.showSaveDialog(window!, {
          title: 'Export Session as Markdown',
          defaultPath: defaultFilename,
          filters: [
            { name: 'Markdown', extensions: ['md'] },
            { name: 'All Files', extensions: ['*'] }
          ]
        })

        if (result.canceled || !result.filePath) {
          return { success: false, error: 'Export cancelled' }
        }

        await writeFile(result.filePath, markdown, 'utf-8')
        return { success: true, data: result.filePath }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to export session'
        }
      }
    }
  )

  ipcMain.handle('terminal:spawn', async (event, options?: TerminalOptions) => {
    try {
      const terminalManager = await import('./terminal-manager')
      const window = BrowserWindow.fromWebContents(event.sender)
      if (!window) {
        return { success: false, error: 'Window not found' }
      }
      const id = terminalManager.spawn(window, options)
      return { success: true, data: id }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to spawn terminal'
      }
    }
  })

  ipcMain.on('terminal:write', async (_event, params: { id: string; data: string }) => {
    try {
      const terminalManager = await import('./terminal-manager')
      terminalManager.write(params.id, params.data)
    } catch (error) {
      console.error('Failed to write to terminal:', error)
    }
  })

  ipcMain.on(
    'terminal:resize',
    async (_event, params: { id: string; cols: number; rows: number }) => {
      try {
        const terminalManager = await import('./terminal-manager')
        terminalManager.resize(params.id, params.cols, params.rows)
      } catch (error) {
        console.error('Failed to resize terminal:', error)
      }
    }
  )

  ipcMain.handle('terminal:kill', async (_event, id: string) => {
    try {
      const terminalManager = await import('./terminal-manager')
      terminalManager.kill(id)
      return { success: true, data: undefined }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to kill terminal'
      }
    }
  })

  ipcMain.handle(
    'claudeChat:create',
    async (_event, params?: { model?: string; resume?: string }) => {
      try {
        const { chatId } = claudeChatManager.create({
          model: params?.model,
          resume: params?.resume
        })
        return { success: true, data: { chatId } }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to create chat'
        }
      }
    }
  )

  ipcMain.handle('claudeChat:send', async (event, params: { chatId: string; input: string }) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) {
      return { success: false, error: 'Window not found' }
    }
    return await claudeChatManager.sendAndStream(params.chatId, params.input, window.webContents)
  })

  ipcMain.handle('claudeChat:close', async (_event, params: { chatId: string }) => {
    claudeChatManager.close(params.chatId)
    return { success: true, data: undefined }
  })

  // Settings IPC
  ipcMain.handle('settings:get', async (_event, key: string) => {
    try {
      const { settingsManager } = await import('./services/settings-manager')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { success: true, data: settingsManager.get(key as any) }
    } catch {
      return { success: false, error: 'Failed to get setting' }
    }
  })

  ipcMain.handle('settings:getAll', async () => {
    try {
      const { settingsManager } = await import('./services/settings-manager')
      return { success: true, data: settingsManager.getAll() }
    } catch {
      return { success: false, error: 'Failed to get all settings' }
    }
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ipcMain.handle('settings:set', async (_event, params: { key: string; value: any }) => {
    try {
      const { settingsManager } = await import('./services/settings-manager')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      settingsManager.set(params.key as any, params.value)
      return { success: true }
    } catch {
      return { success: false, error: 'Failed to set setting' }
    }
  })

  void createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  claudeChatManager.closeAll()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

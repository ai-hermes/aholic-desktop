import { randomUUID } from 'crypto'
import type { WebContents } from 'electron'
import { createClaudeChatSession, type ClaudeChatSession } from './claude-chat'

export type ClaudeChatEvent =
  | { type: 'assistant_text_delta'; delta: string }
  | { type: 'assistant_text_done'; text: string }
  | { type: 'error'; message: string }

type ChatEntry = {
  id: string
  session: ClaudeChatSession
  streaming: boolean
}

import { settingsManager } from './settings-manager'

export class ClaudeChatManager {
  private chats = new Map<string, ChatEntry>()

  create(params?: { model?: string; resume?: string }): { chatId: string } {
    const id = randomUUID()
    const settings = settingsManager.getAll()

    const ANTHROPIC_AUTH_TOKEN = settings.ANTHROPIC_AUTH_TOKEN
    const ANTHROPIC_BASE_URL = settings.ANTHROPIC_BASE_URL
    const ANTHROPIC_MODEL = settings.ANTHROPIC_MODEL
    const ANTHROPIC_DEFAULT_HAIKU_MODEL = settings.ANTHROPIC_DEFAULT_HAIKU_MODEL
    const ANTHROPIC_DEFAULT_OPUS_MODEL = settings.ANTHROPIC_DEFAULT_OPUS_MODEL
    const ANTHROPIC_DEFAULT_SONNET_MODEL = settings.ANTHROPIC_DEFAULT_SONNET_MODEL

    const session = createClaudeChatSession({
      model: params?.model,
      resume: params?.resume,
      baseUrl: ANTHROPIC_BASE_URL,
      timeoutMs: parseInt(settings.API_TIMEOUT_MS, 10),
      env: {
        PATH: process.env.PATH,
        DISABLE_TELEMETRY: '1',
        DISABLE_ERROR_REPORTING: '1',
        CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
        MCP_TIMEOUT: '60000',
        ANTHROPIC_AUTH_TOKEN,
        ANTHROPIC_BASE_URL,
        API_TIMEOUT_MS: settings.API_TIMEOUT_MS,
        ANTHROPIC_MODEL,
        ANTHROPIC_DEFAULT_HAIKU_MODEL,
        ANTHROPIC_DEFAULT_OPUS_MODEL,
        ANTHROPIC_DEFAULT_SONNET_MODEL
      },
      allowedTools: [
        'Task',
        'Bash',
        'Glob',
        'Grep',
        'LS',
        'ExitPlanMode',
        'Read',
        'Edit',
        'MultiEdit',
        'Write',
        'NotebookEdit',
        'WebFetch',
        'TodoWrite',
        'WebSearch',
        'BashOutput',
        'KillBash'
      ]
    })
    this.chats.set(id, { id, session, streaming: false })
    return { chatId: id }
  }

  async sendAndStream(
    chatId: string,
    input: string,
    webContents: WebContents
  ): Promise<{ success: true } | { success: false; error: string }> {
    const chat = this.chats.get(chatId)
    if (!chat) return { success: false, error: 'Chat not found' }
    if (chat.streaming) return { success: false, error: 'Chat is already streaming' }

    chat.streaming = true
    try {
      await chat.session.send(input)
      void this.pumpStream(chatId, chat.session, webContents)
      return { success: true }
    } catch (e) {
      chat.streaming = false
      return { success: false, error: e instanceof Error ? e.message : 'Failed to send message' }
    }
  }

  close(chatId: string): void {
    const chat = this.chats.get(chatId)
    if (!chat) return
    try {
      chat.session.close()
    } finally {
      this.chats.delete(chatId)
    }
  }

  closeAll(): void {
    for (const id of this.chats.keys()) {
      this.close(id)
    }
  }

  private async pumpStream(
    chatId: string,
    session: ClaudeChatSession,
    webContents: WebContents
  ): Promise<void> {
    try {
      for await (const event of session.stream()) {
        webContents.send('claudeChat:event', { chatId, event })
      }
    } finally {
      const chat = this.chats.get(chatId)
      if (chat) chat.streaming = false
    }
  }
}

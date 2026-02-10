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

export class ClaudeChatManager {
  private chats = new Map<string, ChatEntry>()

  create(params?: { model?: string; resume?: string }): { chatId: string } {
    const id = randomUUID()
    const session = createClaudeChatSession({ model: params?.model, resume: params?.resume })
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

export type ChatRole = 'user' | 'assistant'

export type ChatMessage = {
  id: string
  role: ChatRole
  text: string
  createdAt: number
}

export type ClaudeChatEvent =
  | { type: 'assistant_text_delta'; delta: string }
  | { type: 'assistant_text_done'; text: string }
  | { type: 'error'; message: string }

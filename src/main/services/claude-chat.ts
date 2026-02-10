import { unstable_v2_createSession, type SDKMessage } from '@anthropic-ai/claude-agent-sdk'

type ClaudeChatEvent =
  | { type: 'assistant_text_delta'; delta: string }
  | { type: 'assistant_text_done'; text: string }
  | { type: 'error'; message: string }

function extractAssistantText(msg: SDKMessage): string | null {
  if (msg.type !== 'assistant') return null
  return msg.message.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('')
}

export interface ClaudeChatSession {
  send: (input: string) => Promise<void>
  stream: () => AsyncGenerator<ClaudeChatEvent>
  close: () => void
}

export function createClaudeChatSession(params?: {
  model?: string
  includePartialMessages?: boolean
  resume?: string
}): ClaudeChatSession {
  const session = unstable_v2_createSession({
    model: params?.model ?? 'claude-sonnet-4-5-20250929',
    includePartialMessages: params?.includePartialMessages ?? true,
    resume: params?.resume
  } as never)

  return {
    send: async (input: string) => {
      await session.send(input)
    },
    stream: async function* () {
      try {
        let fullText = ''

        for await (const msg of session.stream()) {
          if (msg.type === 'stream_event') {
            const event = (msg as any).event
            if (event?.type === 'content_block_delta' && event?.delta?.type === 'text_delta') {
              const delta = String(event.delta.text ?? '')
              if (delta) {
                fullText += delta
                yield { type: 'assistant_text_delta', delta }
              }
            }
            continue
          }

          const text = extractAssistantText(msg)
          if (text) {
            fullText = text
          }
        }

        yield { type: 'assistant_text_done', text: fullText }
      } catch (e) {
        yield {
          type: 'error',
          message: e instanceof Error ? e.message : 'Failed to stream assistant response'
        }
      }
    },
    close: () => {
      session.close()
    }
  }
}

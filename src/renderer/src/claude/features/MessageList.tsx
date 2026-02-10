import { MessageSquareOff } from 'lucide-react'
import type { ProcessedMessage, SubagentSession } from '../types'
import { MessageBubble } from './Message/MessageBubble'

interface MessageListProps {
  messages: ProcessedMessage[]
  subagents?: Record<string, SubagentSession>
}

export function MessageList({ messages, subagents }: MessageListProps): React.JSX.Element {
  if (messages.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <div className="text-center">
          <MessageSquareOff className="mx-auto h-8 w-8 text-muted-foreground/30" />
          <p className="mt-2 text-xs text-muted-foreground">No messages in this session</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-background">
      <div className="space-y-4 max-w-4xl mx-auto px-6 py-6">
        {messages.map((message, index) => (
          <div
            key={message.uuid}
            className="content-visibility-auto"
            style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 100px' }}
          >
            <MessageBubble
              message={message}
              subagents={subagents}
              showTimestamp={
                index === 0 ||
                new Date(message.timestamp).getTime() -
                  new Date(messages[index - 1].timestamp).getTime() >
                  60000
              }
            />
          </div>
        ))}
      </div>
    </div>
  )
}

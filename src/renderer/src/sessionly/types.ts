// Lightweight copies of the core types from Sessionly's electron/shared/session-types.ts

export interface ThinkingBlock {
  type: 'thinking'
  thinking: string
  signature?: string
}

export interface ToolUseBlock {
  type: 'tool_use'
  id: string
  name: string
  input: Record<string, any>
  agentId?: string
}

export interface ToolResultBlock {
  type: 'tool_result'
  tool_use_id: string
  content: ToolResultContent
  is_error?: boolean
}

export type ToolResultContentItem =
  | { type: 'text'; text: string }
  | { type: 'image'; source: unknown }
export type ToolResultContent = string | ToolResultContentItem[]

export interface ProcessedMessage {
  uuid: string
  parentUuid: string | null
  timestamp: string
  role: 'user' | 'assistant'
  textContent: string
  thinkingBlocks: ThinkingBlock[]
  toolUseBlocks: ToolUseBlock[]
  toolResults: Record<string, ToolResultBlock>
  model?: string
}

export interface SubagentSession {
  agentId: string
  parentToolUseId: string
  messages: ProcessedMessage[]
  messageCount: number
}

export interface SessionSummary {
  id: string
  project: string
  projectEncoded: string
  firstMessage: string
  messageCount: number
  startTime: number | null
  endTime: number | null
  gitBranch: string | null
  model: string | null
  filePath: string
}

export interface Session {
  id: string
  project: string
  projectEncoded: string
  gitBranch: string | null
  cwd: string
  version: string
  startTime: number | null
  endTime: number | null
  messages: ProcessedMessage[]
  filePath: string
  subagents: Record<string, SubagentSession>
}

export interface ProjectGroup {
  project: string
  projectEncoded: string
  sessions: SessionSummary[]
}

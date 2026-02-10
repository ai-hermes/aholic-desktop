/**
 * Claude Code Session Types
 *
 * TypeScript interfaces for parsing and displaying Claude Code CLI session history
 * stored as JSONL files in ~/.claude/projects/
 */

// ============================================================================
// Raw JSONL Message Types (as stored in .jsonl files)
// ============================================================================

export interface TextBlock {
  type: 'text'
  text: string
}

export interface ThinkingBlock {
  type: 'thinking'
  thinking: string
  signature?: string
}

export interface ToolUseBlock {
  type: 'tool_use'
  id: string
  name: string
  input: Record<string, unknown>
  agentId?: string
}

export type ToolResultContentItem =
  | { type: 'text'; text: string }
  | { type: 'image'; source: unknown }
export type ToolResultContent = string | ToolResultContentItem[]

export interface ToolResultBlock {
  type: 'tool_result'
  tool_use_id: string
  content: ToolResultContent
  is_error?: boolean
}

export type ContentBlock = TextBlock | ThinkingBlock | ToolUseBlock | ToolResultBlock

export interface RawMessageContent {
  role: 'user' | 'assistant'
  content: string | ContentBlock[]
  model?: string
  id?: string
  type?: 'message'
  stop_reason?: string | null
  stop_sequence?: string | null
  usage?: {
    input_tokens: number
    output_tokens: number
    cache_creation_input_tokens?: number
    cache_read_input_tokens?: number
  }
}

export interface SessionTodo {
  content: string
  status: 'pending' | 'in_progress' | 'completed'
  activeForm: string
}

export interface FileHistorySnapshot {
  type: 'file-history-snapshot'
  messageId: string
  snapshot: {
    messageId: string
    trackedFileBackups: Record<string, unknown>
    timestamp: string
  }
  isSnapshotUpdate: boolean
}

export interface RawUserMessage {
  type: 'user'
  uuid: string
  parentUuid: string | null
  timestamp: string
  sessionId: string
  cwd: string
  version: string
  gitBranch?: string
  isSidechain: boolean
  userType: 'external' | 'internal'
  message: RawMessageContent
  thinkingMetadata?: {
    level: string
    disabled: boolean
    triggers: string[]
  }
  todos?: SessionTodo[]
}

export interface RawAssistantMessage {
  type: 'assistant'
  uuid: string
  parentUuid: string
  timestamp: string
  sessionId: string
  cwd: string
  version: string
  gitBranch?: string
  isSidechain: boolean
  userType: 'external' | 'internal'
  message: RawMessageContent
  requestId?: string
}

export interface ProgressMessage {
  type: 'progress'
  data: {
    agentId: string
    type: string
  }
  parentToolUseID: string
}

export type RawJSONLEntry =
  | FileHistorySnapshot
  | RawUserMessage
  | RawAssistantMessage
  | ProgressMessage

// ============================================================================
// Processed Types (for UI rendering)
// ============================================================================

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
  isStreaming?: boolean
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

// ============================================================================
// Helper type guards
// ============================================================================

export function isFileHistorySnapshot(entry: RawJSONLEntry): entry is FileHistorySnapshot {
  return entry.type === 'file-history-snapshot'
}

export function isProgressMessage(entry: RawJSONLEntry): entry is ProgressMessage {
  return (
    entry.type === 'progress' &&
    'data' in entry &&
    typeof (entry as ProgressMessage).data?.agentId === 'string'
  )
}

export function isUserMessage(entry: RawJSONLEntry): entry is RawUserMessage {
  return entry.type === 'user'
}

export function isAssistantMessage(entry: RawJSONLEntry): entry is RawAssistantMessage {
  return entry.type === 'assistant'
}

export function isTextBlock(block: ContentBlock): block is TextBlock {
  return block.type === 'text'
}

export function isThinkingBlock(block: ContentBlock): block is ThinkingBlock {
  return block.type === 'thinking'
}

export function isToolUseBlock(block: ContentBlock): block is ToolUseBlock {
  return block.type === 'tool_use'
}

export function isToolResultBlock(block: ContentBlock): block is ToolResultBlock {
  return block.type === 'tool_result'
}

/**
 * Session Store Service
 *
 * Handles reading and parsing Claude Code session files from ~/.claude/projects/
 * Uses streaming readline for memory-efficient parsing of large JSONL files.
 */

import * as fs from 'node:fs'
import * as fsp from 'node:fs/promises'
import * as path from 'node:path'
import * as os from 'node:os'
import * as readline from 'node:readline'

const MAX_CONCURRENT_OPERATIONS = 8

async function pLimit<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number = MAX_CONCURRENT_OPERATIONS
): Promise<T[]> {
  const results: T[] = new Array(tasks.length)
  let currentIndex = 0

  async function worker(): Promise<void> {
    while (currentIndex < tasks.length) {
      const index = currentIndex++
      results[index] = await tasks[index]()
    }
  }

  const workers = Array(Math.min(concurrency, tasks.length))
    .fill(null)
    .map(() => worker())
  await Promise.all(workers)
  return results
}

interface CachedSummary {
  summary: SessionSummary
  mtime: number
}

const sessionSummaryCache = new Map<string, CachedSummary>()

async function getCachedSessionSummary(filePath: string): Promise<SessionSummary | null> {
  try {
    const stats = await fsp.stat(filePath)
    const mtime = stats.mtimeMs

    const cached = sessionSummaryCache.get(filePath)
    if (cached && cached.mtime === mtime) {
      return cached.summary
    }

    const summary = await getSessionSummary(filePath)
    if (summary) {
      sessionSummaryCache.set(filePath, { summary, mtime })
    } else {
      sessionSummaryCache.delete(filePath)
    }
    return summary
  } catch {
    sessionSummaryCache.delete(filePath)
    return null
  }
}

export function clearSessionCache(): void {
  sessionSummaryCache.clear()
}

import type {
  RawJSONLEntry,
  RawUserMessage,
  RawAssistantMessage,
  Session,
  SessionSummary,
  ProcessedMessage,
  ProjectGroup,
  ContentBlock,
  ThinkingBlock,
  ToolUseBlock,
  ToolResultBlock,
  SubagentSession
} from '../shared/session-types'

import {
  isFileHistorySnapshot,
  isProgressMessage,
  isUserMessage,
  isAssistantMessage,
  isTextBlock,
  isThinkingBlock,
  isToolUseBlock,
  isToolResultBlock
} from '../shared/session-types'

export function getClaudeDir(): string {
  return path.join(os.homedir(), '.claude')
}

export function getProjectsDir(): string {
  return path.join(getClaudeDir(), 'projects')
}

export function decodeProjectPath(encoded: string): string {
  if (!encoded.startsWith('-')) {
    return encoded
  }

  const simpleDecode = encoded.replace(/-/g, '/')

  if (fs.existsSync(simpleDecode)) {
    return simpleDecode
  }

  const segments = encoded.slice(1).split('-')

  return findValidPath('/', segments) || simpleDecode
}

function findValidPath(basePath: string, remainingSegments: string[]): string | null {
  if (remainingSegments.length === 0) {
    return fs.existsSync(basePath) ? basePath : null
  }

  const withSlash = path.join(basePath, remainingSegments[0])
  if (fs.existsSync(withSlash)) {
    const result = findValidPath(withSlash, remainingSegments.slice(1))
    if (result) return result
  }

  if (remainingSegments.length >= 2) {
    const combined = remainingSegments[0] + '-' + remainingSegments[1]
    const newSegments = [combined, ...remainingSegments.slice(2)]
    const result = findValidPath(basePath, newSegments)
    if (result) return result
  }

  if (remainingSegments.length === 1) {
    const withSlashFinal = path.join(basePath, remainingSegments[0])
    if (fs.existsSync(withSlashFinal)) {
      return withSlashFinal
    }
  }

  return null
}

function extractTextContent(content: string | ContentBlock[]): string {
  if (typeof content === 'string') {
    return content
  }

  return content
    .filter(isTextBlock)
    .map((block) => block.text)
    .join('\n')
}

function extractThinkingBlocks(content: string | ContentBlock[]): ThinkingBlock[] {
  if (typeof content === 'string') {
    return []
  }
  return content.filter(isThinkingBlock) as ThinkingBlock[]
}

function extractToolUseBlocks(content: string | ContentBlock[]): ToolUseBlock[] {
  if (typeof content === 'string') {
    return []
  }
  return content.filter(isToolUseBlock) as ToolUseBlock[]
}

function extractToolResults(content: string | ContentBlock[]): Record<string, ToolResultBlock> {
  const results: Record<string, ToolResultBlock> = {}
  if (typeof content === 'string') {
    return results
  }
  for (const block of content) {
    if (isToolResultBlock(block)) {
      results[block.tool_use_id] = block
    }
  }
  return results
}

function processMessage(entry: RawUserMessage | RawAssistantMessage): ProcessedMessage {
  const content = entry.message.content
  return {
    uuid: entry.uuid,
    parentUuid: entry.parentUuid,
    timestamp: entry.timestamp,
    role: entry.message.role,
    textContent: extractTextContent(content),
    thinkingBlocks: extractThinkingBlocks(content),
    toolUseBlocks: extractToolUseBlocks(content),
    toolResults: extractToolResults(content),
    model: entry.message.model
  }
}

async function parseSessionFileWithAgentLinks(
  filePath: string
): Promise<{ session: Omit<Session, 'subagents'> | null; agentLinks: Record<string, string> }> {
  if (!fs.existsSync(filePath)) {
    return { session: null, agentLinks: {} }
  }

  const messages: ProcessedMessage[] = []
  const agentLinks: Record<string, string> = {}
  const sessionId = path.basename(filePath, '.jsonl')
  let project = ''
  let projectEncoded = ''
  let gitBranch: string | null = null
  let cwd = ''
  let version = ''
  let startTime: number | null = null
  let endTime: number | null = null
  let metadataExtracted = false

  const pathParts = filePath.split(path.sep)
  const projectsIdx = pathParts.indexOf('projects')
  if (projectsIdx !== -1 && projectsIdx + 1 < pathParts.length) {
    projectEncoded = pathParts[projectsIdx + 1]
    project = decodeProjectPath(projectEncoded)
  }

  const pendingToolResults: Record<string, ToolResultBlock> = {}

  const fileStream = fs.createReadStream(filePath, { encoding: 'utf-8' })
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  })

  try {
    for await (const line of rl) {
      if (!line.trim()) continue

      try {
        const entry = JSON.parse(line) as RawJSONLEntry

        if (isFileHistorySnapshot(entry)) {
          continue
        }

        if (isProgressMessage(entry)) {
          if (entry.data?.agentId && entry.parentToolUseID) {
            agentLinks[entry.data.agentId] = entry.parentToolUseID
          }
          continue
        }

        if (isUserMessage(entry) || isAssistantMessage(entry)) {
          if (!metadataExtracted) {
            metadataExtracted = true
            cwd = entry.cwd
            version = entry.version
            gitBranch = entry.gitBranch || null
          }

          const timestamp = new Date(entry.timestamp).getTime()
          if (startTime === null || timestamp < startTime) {
            startTime = timestamp
          }
          if (endTime === null || timestamp > endTime) {
            endTime = timestamp
          }

          const processed = processMessage(entry)

          if (isUserMessage(entry)) {
            for (const [toolId, result] of Object.entries(processed.toolResults)) {
              pendingToolResults[toolId] = result
            }
          }

          if (
            processed.textContent.trim() ||
            processed.toolUseBlocks.length > 0 ||
            processed.thinkingBlocks.length > 0
          ) {
            messages.push(processed)
          }
        }
      } catch (e) {
        console.warn(`Failed to parse line in ${filePath}:`, e)
      }
    }
  } finally {
    rl.close()
    fileStream.destroy()
  }

  for (const msg of messages) {
    for (const toolUse of msg.toolUseBlocks) {
      const result = pendingToolResults[toolUse.id]
      if (result) {
        msg.toolResults[toolUse.id] = result
      }
    }
  }

  if (messages.length === 0) {
    return { session: null, agentLinks }
  }

  return {
    session: {
      id: sessionId,
      project,
      projectEncoded,
      gitBranch,
      cwd,
      version,
      startTime,
      endTime,
      messages,
      filePath
    },
    agentLinks
  }
}

export async function parseSessionFile(filePath: string): Promise<Session | null> {
  const { session } = await parseSessionFileWithAgentLinks(filePath)
  if (!session) {
    return null
  }
  return { ...session, subagents: {} }
}

export async function getSessionSummary(filePath: string): Promise<SessionSummary | null> {
  if (!fs.existsSync(filePath)) {
    return null
  }

  const sessionId = path.basename(filePath, '.jsonl')
  let project = ''
  let projectEncoded = ''
  let firstMessage = ''
  let messageCount = 0
  let startTime: number | null = null
  let endTime: number | null = null
  let gitBranch: string | null = null
  let model: string | null = null
  let metadataExtracted = false

  const pathParts = filePath.split(path.sep)
  const projectsIdx = pathParts.indexOf('projects')
  if (projectsIdx !== -1 && projectsIdx + 1 < pathParts.length) {
    projectEncoded = pathParts[projectsIdx + 1]
    project = decodeProjectPath(projectEncoded)
  }

  const fileStream = fs.createReadStream(filePath, { encoding: 'utf-8' })
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  })

  try {
    for await (const line of rl) {
      if (!line.trim()) continue

      try {
        const entry = JSON.parse(line) as RawJSONLEntry

        if (isFileHistorySnapshot(entry)) {
          continue
        }

        if (isUserMessage(entry) || isAssistantMessage(entry)) {
          messageCount++

          if (!metadataExtracted) {
            metadataExtracted = true
            gitBranch = entry.gitBranch || null
          }

          if (!firstMessage && isUserMessage(entry)) {
            const content = entry.message.content
            firstMessage =
              typeof content === 'string'
                ? content.slice(0, 200)
                : extractTextContent(content).slice(0, 200)
          }

          if (!model && isAssistantMessage(entry) && entry.message.model) {
            model = entry.message.model
          }

          const timestamp = new Date(entry.timestamp).getTime()
          if (startTime === null || timestamp < startTime) {
            startTime = timestamp
          }
          if (endTime === null || timestamp > endTime) {
            endTime = timestamp
          }
        }
      } catch (e) {
        console.warn(`Failed to parse line in ${filePath}:`, e)
      }
    }
  } finally {
    rl.close()
    fileStream.destroy()
  }

  if (messageCount === 0) {
    return null
  }

  return {
    id: sessionId,
    project,
    projectEncoded,
    firstMessage,
    messageCount,
    startTime,
    endTime,
    gitBranch,
    model,
    filePath
  }
}

export async function listProjects(): Promise<string[]> {
  const projectsDir = getProjectsDir()

  try {
    await fsp.access(projectsDir)
  } catch {
    return []
  }

  try {
    const entries = await fsp.readdir(projectsDir, { withFileTypes: true })
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name)
  } catch (e) {
    console.error('Failed to list projects:', e)
    return []
  }
}

export async function listSessionFiles(projectEncoded: string): Promise<string[]> {
  const projectDir = path.join(getProjectsDir(), projectEncoded)

  try {
    await fsp.access(projectDir)
  } catch {
    return []
  }

  try {
    const files = await fsp.readdir(projectDir)
    return files
      .filter((name) => name.endsWith('.jsonl') && !name.startsWith('agent-'))
      .map((name) => path.join(projectDir, name))
  } catch (e) {
    console.error('Failed to list sessions:', e)
    return []
  }
}

export async function getAllSessions(): Promise<ProjectGroup[]> {
  const projects = await listProjects()

  const projectTasks = projects.map((projectEncoded) => async (): Promise<ProjectGroup | null> => {
    const sessionFiles = await listSessionFiles(projectEncoded)

    const summaryTasks = sessionFiles.map((filePath) => () => getCachedSessionSummary(filePath))
    const summaryResults = await pLimit(summaryTasks, MAX_CONCURRENT_OPERATIONS)

    const sessions = summaryResults.filter((s): s is SessionSummary => s !== null)

    if (sessions.length === 0) {
      return null
    }

    sessions.sort((a, b) => (b.startTime || 0) - (a.startTime || 0))

    return {
      project: decodeProjectPath(projectEncoded),
      projectEncoded,
      sessions
    }
  })

  const groupResults = await pLimit(projectTasks, MAX_CONCURRENT_OPERATIONS)

  const groups = groupResults.filter((g): g is ProjectGroup => g !== null)

  groups.sort((a, b) => {
    const aTime = a.sessions[0]?.startTime || 0
    const bTime = b.sessions[0]?.startTime || 0
    return bTime - aTime
  })

  return groups
}

function findSubagentFiles(projectDir: string, sessionId: string): string[] {
  const files: string[] = []

  const subagentsDir = path.join(projectDir, sessionId, 'subagents')
  if (fs.existsSync(subagentsDir)) {
    try {
      const subFiles = fs
        .readdirSync(subagentsDir)
        .filter((name) => name.startsWith('agent-') && name.endsWith('.jsonl'))
        .map((name) => path.join(subagentsDir, name))
      files.push(...subFiles)
    } catch (e) {
      console.warn('Failed to read subagents directory:', e)
    }
  }

  try {
    const projectFiles = fs
      .readdirSync(projectDir)
      .filter((name) => name.startsWith('agent-') && name.endsWith('.jsonl'))
      .map((name) => path.join(projectDir, name))
    files.push(...projectFiles)
  } catch (e) {
    console.warn('Failed to read project directory for agent files:', e)
  }

  return files
}

async function parseSubagentFile(filePath: string): Promise<ProcessedMessage[]> {
  if (!fs.existsSync(filePath)) {
    return []
  }

  const messages: ProcessedMessage[] = []
  const pendingToolResults: Record<string, ToolResultBlock> = {}

  const fileStream = fs.createReadStream(filePath, { encoding: 'utf-8' })
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  })

  try {
    for await (const line of rl) {
      if (!line.trim()) continue

      try {
        const entry = JSON.parse(line) as RawJSONLEntry

        if (isFileHistorySnapshot(entry) || isProgressMessage(entry)) {
          continue
        }

        if (isUserMessage(entry) || isAssistantMessage(entry)) {
          const processed = processMessage(entry)

          if (isUserMessage(entry)) {
            for (const [toolId, result] of Object.entries(processed.toolResults)) {
              pendingToolResults[toolId] = result
            }
          }

          if (
            processed.textContent.trim() ||
            processed.toolUseBlocks.length > 0 ||
            processed.thinkingBlocks.length > 0
          ) {
            messages.push(processed)
          }
        }
      } catch {
        // Skip malformed JSON lines
      }
    }
  } finally {
    rl.close()
    fileStream.destroy()
  }

  for (const msg of messages) {
    for (const toolUse of msg.toolUseBlocks) {
      const result = pendingToolResults[toolUse.id]
      if (result) {
        msg.toolResults[toolUse.id] = result
      }
    }
  }

  return messages
}

export async function getSession(
  sessionId: string,
  projectEncoded: string
): Promise<Session | null> {
  const projectDir = path.join(getProjectsDir(), projectEncoded)
  const filePath = path.join(projectDir, `${sessionId}.jsonl`)

  const { session, agentLinks } = await parseSessionFileWithAgentLinks(filePath)
  if (!session) {
    return null
  }

  const subagentFiles = findSubagentFiles(projectDir, sessionId)
  const subagents: Record<string, SubagentSession> = {}

  for (const subPath of subagentFiles) {
    const agentId = path.basename(subPath, '.jsonl').replace('agent-', '')
    const parentToolUseId = agentLinks[agentId]

    if (parentToolUseId) {
      const messages = await parseSubagentFile(subPath)
      if (messages.length > 0) {
        subagents[agentId] = {
          agentId,
          parentToolUseId,
          messages,
          messageCount: messages.length
        }
      }
    }
  }

  for (const msg of session.messages) {
    for (const toolUse of msg.toolUseBlocks) {
      if (toolUse.name === 'Task') {
        const match = Object.entries(subagents).find(([, s]) => s.parentToolUseId === toolUse.id)
        if (match) {
          toolUse.agentId = match[0]
        }
      }
    }
  }

  return { ...session, subagents }
}

export async function getAllSessionSummaries(): Promise<SessionSummary[]> {
  const groups = await getAllSessions()
  return groups.flatMap((g) => g.sessions)
}

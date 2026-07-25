import { executeTools, AIToolContext, AIToolResult } from './tools'
import { generateResponse } from './response-generator'
import { logAudit } from './audit'
import { conversationStore } from './conversation'
import { checkRateLimit, recordRequest } from './rate-limit'
import { canAccessAI } from './permissions'
import { User } from '@/lib/auth'

export interface LocalAIResult {
  answer: string
  toolResults: AIToolResult[]
  dateRangeLabel: string
  durationMs: number
  error?: string
}

export function processQuestion(
  question: string,
  user: User,
  permissions: string[],
  conversationId?: string
): LocalAIResult {
  const startTime = Date.now()

  if (!canAccessAI(user.role)) {
    const result: LocalAIResult = {
      answer: 'You do not have permission to use EMDPOS Intelligence.',
      toolResults: [],
      dateRangeLabel: '',
      durationMs: Date.now() - startTime,
      error: 'Permission denied',
    }
    logAudit({
      timestamp: new Date().toISOString(),
      user: user.email,
      role: user.role,
      question,
      toolsUsed: [],
      dateRange: '',
      status: 'denied',
      durationMs: result.durationMs,
      error: 'Permission denied',
    })
    return result
  }

  const rateCheck = checkRateLimit()
  if (!rateCheck.allowed) {
    const result: LocalAIResult = {
      answer: rateCheck.reason || 'Rate limit exceeded. Please try again later.',
      toolResults: [],
      dateRangeLabel: '',
      durationMs: Date.now() - startTime,
      error: 'Rate limited',
    }
    logAudit({
      timestamp: new Date().toISOString(),
      user: user.email,
      role: user.role,
      question,
      toolsUsed: [],
      dateRange: '',
      status: 'error',
      durationMs: result.durationMs,
      error: 'Rate limited',
    })
    return result
  }

  const ctx: AIToolContext = {
    user,
    permissions: permissions as AIToolContext['permissions'],
    timezone: 'Africa/Accra',
    currency: 'GHS',
  }

  const { results, rangeLabel } = executeTools(question, ctx)
  const answer = generateResponse(results, rangeLabel, question)

  recordRequest()

  const durationMs = Date.now() - startTime

  if (conversationId) {
    conversationStore.addMessage({
      conversationId,
      role: 'user',
      content: question,
    })
    conversationStore.addMessage({
      conversationId,
      role: 'assistant',
      content: answer,
      toolCalls: results.map((r) => ({ toolName: r.toolName, data: r.data })),
      dateRangeLabel: rangeLabel,
      model: 'local',
    })
  }

  logAudit({
    timestamp: new Date().toISOString(),
    user: user.email,
    role: user.role,
    question,
    toolsUsed: results.map((r) => r.toolName),
    dateRange: rangeLabel,
    status: 'success',
    durationMs,
    model: 'local',
  })

  return {
    answer,
    toolResults: results,
    dateRangeLabel: rangeLabel,
    durationMs,
  }
}

export { canAccessAI, checkRateLimit, recordRequest }

import { executeTools, AIToolContext, AIToolResult } from './tools'
import { generateResponse } from './response-generator'
import { logAudit } from './audit'
import { conversationStore } from './conversation'
import { checkRateLimit, recordRequest } from './rate-limit'
import { canAccessAI } from './permissions'
import { User } from '@/lib/auth'
import { parseDateRange, hasDateKeyword } from './date-range'

export interface LocalAIResult {
  answer: string
  toolResults: AIToolResult[]
  dateRangeLabel: string
  durationMs: number
  error?: string
}

/**
 * Resolve a follow-up question by inheriting context from the conversation.
 * If the user asks "sold by who" after asking about yesterday's sales,
 * we prepend "yesterday" to the question so the date range is preserved.
 */
function resolveWithContext(question: string, conversationId?: string): string {
  if (!conversationId || typeof window === 'undefined') return question

  // If the question already has a date keyword, no need to inherit
  if (hasDateKeyword(question)) return question

  // Get recent messages from the conversation
  const messages = conversationStore.getMessages(conversationId)
  if (messages.length === 0) return question

  // Find the most recent user message that has a date keyword
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (msg.role === 'user' && hasDateKeyword(msg.content)) {
      // Extract the date-related phrase from the previous question
      const prevLower = msg.content.toLowerCase()
      const dateKeywords = [
        'today', 'yesterday', 'this week', 'last week', 'this month',
        'last month', 'this quarter', 'last quarter', 'this year', 'last year',
      ]
      for (const kw of dateKeywords) {
        if (prevLower.includes(kw)) {
          // Check if the follow-up is a contextual question
          const lower = question.toLowerCase()
          const isFollowUp =
            lower.includes('who') || lower.includes('sold by') ||
            lower.includes('by who') || lower.includes('which') ||
            lower.includes('what about') || lower.includes('how about') ||
            lower.includes('and') || lower.includes('breakdown') ||
            lower.includes('by staff') || lower.includes('by cashier') ||
            lower.includes('by payment') || lower.includes('by category') ||
            lower.length < 20 // short questions are likely follow-ups
          if (isFollowUp) {
            return `${kw} ${question}`
          }
        }
      }
    }
  }

  return question
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
      answer: 'You do not have permission to use HOODMART Intelligence.',
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

  // Resolve follow-up questions with conversation context
  const resolvedQuestion = resolveWithContext(question, conversationId)

  const ctx: AIToolContext = {
    user,
    permissions: permissions as AIToolContext['permissions'],
    timezone: 'Africa/Accra',
    currency: 'GHS',
  }

  const { results, rangeLabel } = executeTools(resolvedQuestion, ctx)
  const answer = generateResponse(results, rangeLabel, resolvedQuestion)

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

import { processQuestion, resolveWithContext } from './engine'
import { conversationStore } from './conversation'
import { canAccessAI, type AIPermission } from './permissions'
import { checkRateLimit, recordRequest } from './rate-limit'
import { logAudit } from './audit'
import { reportRequest } from '@/lib/reporting/client'
import type { User } from '@/lib/auth'

export async function askAssistant(question: string, user: User, permissions: AIPermission[], conversationId?: string) {
  const previous = conversationId ? conversationStore.getMessages(conversationId).slice(-1)[0] : null
  const followUp = previous?.model === 'verified sales analytics' && /^(who|which|what about|how about|and|by |compare|breakdown)/i.test(question)
  const needsServer = followUp || ['cashier', 'salesgirl'].includes(user.role) || /sale|sold|revenue|staff|cashier|salesperson|sales person|employee|activit|summary|performance|analy[sz]/i.test(question)
  if (!needsServer) return { ...processQuestion(question, user, permissions, conversationId), model: 'local' }
  if (!canAccessAI(user.role)) throw new Error('You do not have permission to use Kofi AI.')
  const rate = checkRateLimit()
  if (!rate.allowed) throw new Error(rate.reason || 'Please wait before asking another question.')
  const started = Date.now()
  const resolved = resolveWithContext(question, conversationId)
  const result = await reportRequest('/api/reports/insights', { method: 'POST', body: JSON.stringify({ question: resolved }) })
  recordRequest()
  logAudit({ timestamp: new Date().toISOString(), user: user.email, role: user.role, question, toolsUsed: ['verified_sales_report'], dateRange: result.range, status: 'success', durationMs: Date.now() - started, model: 'verified sales analytics' })
  if (conversationId) {
    conversationStore.addMessage({ conversationId, role: 'user', content: question })
    conversationStore.addMessage({ conversationId, role: 'assistant', content: result.answer, dateRangeLabel: result.range, model: 'verified sales analytics' })
  }
  return { answer: result.answer as string, toolResults: [], dateRangeLabel: result.range as string, durationMs: Date.now() - started, model: 'verified sales analytics' }
}

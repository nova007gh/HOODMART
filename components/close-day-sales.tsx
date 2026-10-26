'use client'

import { useEffect, useRef, useState } from 'react'
import { CheckCircle, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { reportRequest } from '@/lib/reporting/client'
import { flushPending } from '@/lib/sync'
import { money } from '@/lib/store'
import type { SalesReport } from '@/lib/reporting/summary'

const smsLabels: Record<string, string> = {
  disabled: 'SMS reports are switched off by the administrator.',
  queued: 'SMS queued; not sent yet. Delivery requires the configured BMS service.',
  accepted: 'BMS accepted the SMS. Handset delivery is not yet confirmed.',
  sending: 'SMS submission is in progress. Do not resend.',
  unknown: 'SMS outcome is uncertain. Ask an administrator to check BMS before any resend.',
  rejected: 'SMS was rejected. Ask an administrator to review the BMS account.',
  canceled: 'SMS canceled because notification settings changed.',
}

export function CloseDaySales({ cartHasItems = false }: { cartHasItems?: boolean }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ date: string; cutoff: string; report: SalesReport; closed: boolean; sms?: string } | null>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { if (open) dialog.current?.showModal(); else dialog.current?.close() }, [open])

  const preview = async () => {
    setOpen(true); setBusy(true); setError(''); setResult(null)
    try {
      if (!navigator.onLine) throw new Error('Connect to the internet and sync sales before closing your day.')
      const pending = await flushPending()
      if (pending) throw new Error(`${pending} changes are still unsynced. Resolve sync before closing so totals are not incomplete.`)
      setResult(await reportRequest('/api/reports/close-day'))
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not prepare the shift report.') }
    finally { setBusy(false) }
  }

  const close = async () => {
    if (!result || busy) return
    setBusy(true); setError('')
    try {
      if (await flushPending()) throw new Error('Some changes are still unsynced. Try again after sync completes.')
      setResult(await reportRequest('/api/reports/close-day', { method: 'POST', body: JSON.stringify({ date: result.date }) }))
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not finalize your shift.') }
    finally { setBusy(false) }
  }

  return <>
    <Button type="button" variant="outline" disabled={busy || cartHasItems} onClick={preview} title={cartHasItems ? 'Complete or suspend your current cart first.' : 'Review and close your own sales for today'} className="no-print border-yellow-500/40 text-yellow-400">
      <CheckCircle className="mr-2 h-4 w-4" />Close today's sales
    </Button>
    <dialog ref={dialog} onCancel={() => setOpen(false)} onClose={() => setOpen(false)} aria-labelledby="close-day-title" className="no-print w-[calc(100%-2rem)] max-w-md rounded-2xl border border-yellow-500/30 bg-zinc-950 p-5 text-zinc-100 shadow-2xl backdrop:bg-black/60">
      <div className="mb-3 flex items-center justify-between gap-2"><h2 id="close-day-title" className="text-lg font-bold">{result?.closed ? 'Your shift report' : "Close today's sales"}</h2><button type="button" disabled={busy} aria-label="Close shift summary" onClick={() => setOpen(false)} className="p-2"><X className="h-5 w-5" /></button></div>
      {busy && <p role="status" className="flex items-center gap-2 text-sm text-yellow-300"><Loader2 className="h-4 w-4 animate-spin" />Verifying synced sales…</p>}
      {error && <p role="alert" className="my-3 text-sm text-red-300">{error}</p>}
      {result && <div className="space-y-3">
        <p className="text-xs text-zinc-400">{result.date} · Your sales only · Africa/Accra</p>
        <p className="text-2xl font-bold text-yellow-400">{money(result.report.revenue)}</p>
        <p className="text-sm">{result.report.transactions} sales · {result.report.items} items</p>
        <div className="rounded-lg border border-zinc-800 p-3"><p className="text-xs text-zinc-400">Best item by quantity</p><p className="text-sm">{result.report.bestItem ? `${result.report.bestItem.name} × ${result.report.bestItem.quantity}` : 'No items sold'}</p></div>
        <p className="text-xs text-zinc-400">{result.closed ? `Saved through ${new Date(result.cutoff).toLocaleTimeString('en-GH', { timeZone: 'Africa/Accra' })}. Later or late-synced sales are not part of this saved report.` : 'The final total is rechecked when you confirm. Sync every device used for your sales before closing.'}</p>
        <p className="text-xs text-zinc-400">One close per cashier per Ghana calendar day. This saves a summary; checkout stays open and no sales are deleted.</p>
        {result.sms && <p role="status" className="text-sm text-yellow-200">{smsLabels[result.sms] || 'SMS status is unavailable.'}</p>}
        <Button type="button" disabled={busy || result.report.transactions === 0 || Boolean(result.sms)} onClick={close} className="w-full gold-gradient text-black">{result.closed ? 'Check / queue shift SMS' : 'Confirm close & notify admin'}</Button>
      </div>}
      {!busy && !result && <Button type="button" variant="outline" onClick={preview} className="mt-3">Try again</Button>}
    </dialog>
  </>
}

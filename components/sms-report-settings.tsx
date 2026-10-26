'use client'

import { useEffect, useState } from 'react'
import { reportRequest } from '@/lib/reporting/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export function SMSReportSettings() {
  const [settings, setSettings] = useState({ enabled: false, daily_enabled: true, monthly_enabled: true, phone: '' })
  const [ready, setReady] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [recent, setRecent] = useState<Array<{ id: string; kind: string; status: string; message: string }>>([])
  const load = async () => {
    setError(''); setBusy(true)
    try {
      const result = await reportRequest('/api/reports/sms-settings')
      setSettings(result.settings); setReady(result.providerReady); setRecent(result.recent); setLoaded(true)
    } catch (error) { setError(error instanceof Error ? error.message : 'SMS setup is unavailable.') }
    finally { setBusy(false) }
  }
  useEffect(() => { load() }, [])
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setError(''); setNotice(''); setBusy(true)
    try {
      await reportRequest('/api/reports/sms-settings', { method: 'PUT', body: JSON.stringify(settings) })
      setNotice('SMS settings saved.'); await load()
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not save SMS settings.') }
    finally { setBusy(false) }
  }
  return <Card className="glass-card mb-6">
    <CardHeader><CardTitle className="text-white">Admin SMS reports · BMS Afrika</CardTitle></CardHeader>
    <CardContent>
      <form onSubmit={save} className="space-y-4">
        <p className="text-sm text-zinc-400">One SMS segment per daily cashier-close report and per monthly store report. No per-sale SMS. BMS credits apply.</p>
        <p className="text-xs text-zinc-400">Monthly: previous calendar month, 1st at 8:00 AM Africa/Accra. Late setup or an outage is caught up at the next daily 8 AM run. Reports contain synced sales only.</p>
        {!ready && <p className="text-sm text-yellow-300">Sending is not configured. Set BMS_SMS_API_KEY and an approved BMS_SMS_SENDER on the server. Never put API keys here.</p>}
        <label className="flex gap-2 text-sm"><input type="checkbox" checked={settings.enabled} disabled={!loaded || busy || (!ready && !settings.enabled)} onChange={event => setSettings({ ...settings, enabled: event.target.checked })} />Enable SMS reports</label>
        <label className="block text-sm">Administrator's Ghana phone number<input type="tel" autoComplete="tel" maxLength={20} placeholder="0241234567 or +233241234567" value={settings.phone} onChange={event => setSettings({ ...settings, phone: event.target.value })} disabled={!loaded || busy} className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2" /></label>
        <label className="flex gap-2 text-sm"><input type="checkbox" checked={settings.daily_enabled} disabled={!loaded || busy} onChange={event => setSettings({ ...settings, daily_enabled: event.target.checked })} />Daily cashier-close report</label>
        <label className="flex gap-2 text-sm"><input type="checkbox" checked={settings.monthly_enabled} disabled={!loaded || busy} onChange={event => setSettings({ ...settings, monthly_enabled: event.target.checked })} />Monthly store report</label>
        <p className="text-xs text-zinc-500">Switching reports off prevents queued sends, but cannot recall a message already submitted to BMS.</p>
        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
        {notice && <p role="status" className="text-sm text-green-300">{notice}</p>}
        <div className="flex gap-2"><Button type="submit" disabled={!loaded || busy} className="gold-gradient text-black">{busy ? 'Please wait…' : 'Save SMS settings'}</Button><Button type="button" variant="outline" onClick={load} disabled={busy}>Refresh status</Button></div>
      </form>
      {recent.length > 0 && <div className="mt-5 space-y-2"><h3 className="text-sm font-semibold">Recent SMS reports</h3><p className="text-xs text-zinc-500">Accepted means accepted by BMS, not confirmed handset delivery. Unknown/sending messages must be checked with BMS before retrying.</p>{recent.map(job => <div key={job.id} className="rounded border border-zinc-800 p-2 text-xs"><p className="font-semibold text-yellow-300">{job.kind} · {job.status}</p><p className="break-words text-zinc-400">{job.message}</p></div>)}</div>}
    </CardContent>
  </Card>
}

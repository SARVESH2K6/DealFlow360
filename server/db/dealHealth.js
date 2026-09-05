import { query } from './pool.js'

async function logActivityDb(text) {
  const id = `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  await query('INSERT INTO activity (id, text, timestamp) VALUES ($1, $2, $3)', [id, text, new Date().toISOString()])
}

export async function getDealHealth() {
  const { rows: items } = await query('SELECT * FROM deal_health ORDER BY flagged DESC')
  const stalled = items.filter((d) => d.type === 'stalled').length
  const anomalies = items.filter((d) => d.type === 'anomaly').length
  const slippage = items.filter((d) => d.type === 'slippage').length

  const { rows: quotations } = await query('SELECT status FROM quotations')
  const byStage = [
    { stage: 'Draft', count: quotations.filter((q) => q.status === 'draft').length },
    { stage: 'Pending', count: quotations.filter((q) => q.status === 'pending_approval').length },
    { stage: 'Negotiation', count: quotations.filter((q) => q.status === 'negotiation').length },
    { stage: 'Approved', count: quotations.filter((q) => q.status === 'approved').length },
    { stage: 'Confirmed', count: quotations.filter((q) => q.status === 'confirmed').length },
  ]

  return {
    stalled,
    anomalies,
    slippage,
    items: items.map((d) => ({
      id: d.id,
      deal: d.deal,
      quotationId: d.quotation_id,
      issue: d.issue,
      flagged: d.flagged,
      type: d.type,
      escalated: d.escalated,
      nudged: d.nudged,
    })),
    byStage,
  }
}

export async function escalate(id, userName) {
  const { rows } = await query('SELECT * FROM deal_health WHERE id = $1', [id])
  if (rows.length === 0) return null
  await query('UPDATE deal_health SET escalated = true WHERE id = $1', [id])
  await logActivityDb(`${userName} escalated ${rows[0].deal}: ${rows[0].issue}`)
  const { rows: updated } = await query('SELECT * FROM deal_health WHERE id = $1', [id])
  return { id: updated[0].id, deal: updated[0].deal, quotationId: updated[0].quotation_id, issue: updated[0].issue, flagged: updated[0].flagged, type: updated[0].type, escalated: updated[0].escalated, nudged: updated[0].nudged }
}

export async function nudge(id, userName) {
  const { rows } = await query('SELECT * FROM deal_health WHERE id = $1', [id])
  if (rows.length === 0) return null
  await query('UPDATE deal_health SET nudged = true WHERE id = $1', [id])
  await logActivityDb(`${userName} nudged the rep on ${rows[0].deal}`)
  const { rows: updated } = await query('SELECT * FROM deal_health WHERE id = $1', [id])
  return { id: updated[0].id, deal: updated[0].deal, quotationId: updated[0].quotation_id, issue: updated[0].issue, flagged: updated[0].flagged, type: updated[0].type, escalated: updated[0].escalated, nudged: updated[0].nudged }
}

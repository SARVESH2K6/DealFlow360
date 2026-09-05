import { query } from './pool.js'

export async function getActivity() {
  const { rows } = await query('SELECT * FROM activity ORDER BY timestamp DESC LIMIT 40')
  return rows.map((r) => ({ id: r.id, text: r.text, timestamp: r.timestamp }))
}

export async function logActivity(text) {
  const id = `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  await query('INSERT INTO activity (id, text, timestamp) VALUES ($1, $2, $3)', [id, text, new Date().toISOString()])
}

export async function getDashboardSummary() {
  const { rows: pRows } = await query("SELECT COUNT(*) AS cnt FROM approvals WHERE status = 'pending'")
  const pendingApprovals = Number(pRows[0]?.cnt || 0)

  const { rows: oRows } = await query("SELECT COUNT(*) AS cnt FROM quotations WHERE status IN ('draft', 'pending_approval', 'negotiation')")
  const openQuotations = Number(oRows[0]?.cnt || 0)

  const { rows: dRows } = await query('SELECT * FROM deal_health')
  const atRiskDeals = dRows.length

  const { rows: totalRows } = await query('SELECT SUM(amount) AS total FROM quotations')
  const totalDealValue = Number(totalRows[0]?.total || 0)

  const { rows: lRows } = await query('SELECT discount_percent FROM quotation_lines')
  const sumDisc = lRows.reduce((sum, r) => sum + Number(r.discount_percent), 0)
  const avgDiscount = lRows.length > 0 ? Math.round((sumDisc / lRows.length) * 10) / 10 : 0

  const { rows: qRows } = await query('SELECT id, number, customer_name, amount, status, risk_score, risk_level FROM quotations ORDER BY date DESC LIMIT 5')
  const deals = qRows.map((q) => ({
    id: q.id, number: q.number, customerName: q.customer_name, amount: Number(q.amount),
    status: q.status, riskScore: Number(q.risk_score), riskLevel: q.risk_level,
  }))

  const activity = await getActivity()

  return {
    pendingApprovals,
    openQuotations,
    atRiskDeals,
    totalDealValue,
    avgDiscount,
    deals,
    activity,
  }
}

export async function getReports() {
  const { rows: countRows } = await query('SELECT COUNT(*) AS cnt FROM quotations')
  const quotesCreated = Number(countRows[0]?.cnt || 0)

  // Hardcoded for now, could be dynamic
  const avgApprovalTime = '14.5 hours'

  const { rows: upsellRows } = await query(`
    SELECT product_name, SUM(qty) AS total_qty
    FROM quotation_lines
    WHERE category = 'Services'
    GROUP BY product_name
    ORDER BY total_qty DESC LIMIT 1
  `)
  const topUpsellProduct = upsellRows[0]?.product_name || 'Predictive Maintenance Suite'

  return { quotesCreated, avgApprovalTime, topUpsellProduct }
}

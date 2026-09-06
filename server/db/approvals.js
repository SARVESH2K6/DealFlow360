import { query } from './pool.js'
import { createFulfillmentFromQuote } from './fulfillment.js'

async function logActivityDb(text) {
  const id = `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  await query('INSERT INTO activity (id, text, timestamp) VALUES ($1, $2, $3)', [id, text, new Date().toISOString()])
}

async function appendAuditDb(approvalId, user, action, note) {
  await query(
    'INSERT INTO approval_audit_log (approval_id, user_name, user_id, action, date, note) VALUES ($1, $2, $3, $4, $5, $6)',
    [approvalId, user.name, user.id, action, new Date().toISOString(), note],
  )
}

// ── List ─────────────────────────────────────────────────────────────

export async function listApprovals() {
  const { rows } = await query(`
    SELECT a.id, a.quotation_id, a.status, a.stage, a.assigned_to, a.assigned_role, a.days_pending,
           q.number AS quotation_number, q.customer_name, q.amount, q.risk_level, q.risk_score, q.blended_risk
    FROM approvals a
    JOIN quotations q ON q.id = a.quotation_id
    ORDER BY a.days_pending DESC
  `)
  return rows.map((r) => ({
    id: r.id,
    quotationId: r.quotation_id,
    quotationNumber: r.quotation_number,
    customerName: r.customer_name,
    blendedRisk: Number(r.blended_risk),
    riskLevel: r.risk_level,
    riskScore: Number(r.risk_score),
    stage: r.stage,
    assignedTo: r.assigned_to,
    status: r.status,
    daysPending: r.days_pending,
    amount: Number(r.amount),
  }))
}

// ── Detail ───────────────────────────────────────────────────────────

export async function getApproval(id) {
  const { rows } = await query('SELECT * FROM approvals WHERE id = $1', [id])
  if (rows.length === 0) return null
  const a = rows[0]

  // Fetch quotation detail
  const { rows: qRows } = await query('SELECT * FROM quotations WHERE id = $1', [a.quotation_id])
  const q = qRows[0]
  const { rows: lineRows } = await query('SELECT * FROM quotation_lines WHERE quotation_id = $1', [q.id])
  const { rows: auditRows } = await query('SELECT * FROM approval_audit_log WHERE approval_id = $1 ORDER BY date', [id])

  const lines = lineRows.map((l) => ({
    id: l.id, productId: l.product_id, productName: l.product_name, category: l.category,
    qty: Number(l.qty), price: Number(l.price), discountPercent: Number(l.discount_percent),
    limit: l.line_limit != null ? Number(l.line_limit) : 0, status: l.line_status || 'within',
    comment: l.comment || '', counterDiscount: l.counter_discount != null ? Number(l.counter_discount) : undefined,
  }))

  return {
    id: a.id,
    quotationId: a.quotation_id,
    status: a.status,
    stage: a.stage,
    assignedTo: a.assigned_to,
    assignedRole: a.assigned_role,
    daysPending: a.days_pending,
    quotationNumber: q.number,
    customerName: q.customer_name,
    customerTier: q.customer_tier,
    blendedRisk: Number(q.blended_risk),
    riskLevel: q.risk_level,
    riskScore: Number(q.risk_score),
    flagReasons: q.flag_reasons || [],
    amount: Number(q.amount),
    auditLog: auditRows.map((r) => ({ user: r.user_name, userId: r.user_id, action: r.action, date: r.date, note: r.note })),
    quotation: {
      id: q.id, number: q.number, customerId: q.customer_id, customerName: q.customer_name,
      customerTier: q.customer_tier, date: q.date, amount: Number(q.amount), repName: q.rep_name, repId: q.rep_id,
      status: q.status, riskLevel: q.risk_level, riskScore: Number(q.risk_score), blendedRisk: Number(q.blended_risk),
      currency: q.currency, region: q.region, terms: q.terms, priceListId: q.price_list_id,
      lines, flagReasons: q.flag_reasons || [], upsells: [],
      portalStatus: q.portal_status, requestedDeliveryDate: q.requested_delivery_date,
    },
  }
}

// ── Actions ──────────────────────────────────────────────────────────

function canActOnStep(user, approval) {
  if (user.role === 'admin') return true
  if (approval.stage === 'sales_manager' && ['manager', 'finance'].includes(user.role)) return true
  if (approval.stage === 'finance' && user.role === 'finance') return true
  return false
}

export async function approveApproval(id, user, note) {
  const { rows } = await query('SELECT * FROM approvals WHERE id = $1', [id])
  if (rows.length === 0) return { error: 'Approval not found', status: 404 }
  const a = rows[0]
  if (a.status !== 'pending') return { error: 'Approval is not pending', status: 409 }
  if (!canActOnStep(user, a)) return { error: 'Not assigned to this step', status: 403 }

  const { rows: qRows } = await query('SELECT * FROM quotations WHERE id = $1', [a.quotation_id])
  const q = qRows[0]
  const noteText = note || 'Approved.'

  // Check 70% rule: does any line item's qty exceed 70% of that product's total warehouse stock?
  const { rows: lineRows } = await query('SELECT product_id, qty FROM quotation_lines WHERE quotation_id = $1', [q.id])
  let requiresFinance = false;
  for (const l of lineRows) {
    const { rows: stockRows } = await query(
      'SELECT COALESCE(SUM(in_stock), 0)::int AS total_stock FROM stock WHERE product_id = $1',
      [l.product_id]
    );
    const totalStock = stockRows[0]?.total_stock || 0;
    if (totalStock > 0 && (Number(l.qty) / totalStock) > 0.70) {
      requiresFinance = true;
      break;
    }
  }

  if (a.stage === 'sales_manager' && (q.risk_level === 'HIGH' || requiresFinance)) {
    await query("UPDATE approvals SET stage = 'finance', assigned_to = 'Sam Patel', assigned_role = 'finance', status = 'pending' WHERE id = $1", [id])
    await appendAuditDb(id, user, 'Approved', `${noteText} Routed to Finance.`)
  } else {
    // Both approved (or Finance just approved). Route to Customer.
    await query("UPDATE approvals SET stage = 'confirmed', status = 'approved', assigned_to = '—' WHERE id = $1", [id])
    await query("UPDATE quotations SET status = 'approved', portal_status = 'sent' WHERE id = $1", [a.quotation_id])
    await appendAuditDb(id, user, 'Approved', `${noteText} Internal approval complete. Sent to customer.`)
  }

  await logActivityDb(`${q.customer_name} quotation ${q.number} approved by ${user.name}`)
  return { data: await getApproval(id) }
}

export async function returnApproval(id, user, note) {
  const { rows } = await query('SELECT * FROM approvals WHERE id = $1', [id])
  if (rows.length === 0) return { error: 'Approval not found', status: 404 }
  const a = rows[0]
  if (a.status !== 'pending') return { error: 'Approval is not pending', status: 409 }
  if (!canActOnStep(user, a)) return { error: 'Not assigned to this step', status: 403 }

  const { rows: qRows } = await query('SELECT * FROM quotations WHERE id = $1', [a.quotation_id])
  const q = qRows[0]

  await query("UPDATE approvals SET status = 'returned', stage = 'submitted', assigned_to = $1 WHERE id = $2", [q.rep_name, id])
  await query("UPDATE quotations SET status = 'returned' WHERE id = $1", [a.quotation_id])
  await appendAuditDb(id, user, 'Returned', note || 'Returned for revision.')
  await logActivityDb(`${q.number} returned for revision by ${user.name}`)
  return { data: await getApproval(id) }
}

export async function rejectApproval(id, user, note) {
  const { rows } = await query('SELECT * FROM approvals WHERE id = $1', [id])
  if (rows.length === 0) return { error: 'Approval not found', status: 404 }
  const a = rows[0]
  if (a.status !== 'pending') return { error: 'Approval is not pending', status: 409 }
  if (!canActOnStep(user, a)) return { error: 'Not assigned to this step', status: 403 }

  const { rows: qRows } = await query('SELECT * FROM quotations WHERE id = $1', [a.quotation_id])
  const q = qRows[0]

  await query("UPDATE approvals SET status = 'rejected' WHERE id = $1", [id])
  await query("UPDATE quotations SET status = 'rejected', portal_status = 'rejected' WHERE id = $1", [a.quotation_id])
  await appendAuditDb(id, user, 'Rejected', note || 'Rejected.')
  await logActivityDb(`${q.number} rejected by ${user.name}`)
  return { data: await getApproval(id) }
}

export { createFulfillmentFromQuote }

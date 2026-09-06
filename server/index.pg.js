import { randomBytes } from 'crypto'
import cors from 'cors'
import express from 'express'
import { createServer } from 'http'
import jwt from 'jsonwebtoken'
import { Server } from 'socket.io'

import * as usersDb from './db/users.js'
import * as custDb from './db/customers.js'
import * as prodDb from './db/products.js'
import * as quotDb from './db/quotations.js'
import * as appDb from './db/approvals.js'
import * as fulfillDb from './db/fulfillment.js'
import * as subDb from './db/subscriptions.js'
import * as invDb from './db/invoices.js'
import * as healthDb from './db/dealHealth.js'
import * as portalDb from './db/portal.js'
import * as actDb from './db/activity.js'
import * as confDb from './db/discountConfig.js'

const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: { origin: true, credentials: true },
})

const PORT = Number(process.env.PORT || 3001)
const JWT_SECRET =
  process.env.JWT_SECRET && process.env.JWT_SECRET !== 'df360-dev-secret'
    ? process.env.JWT_SECRET
    : randomBytes(32).toString('hex')
const INTERNAL = ['rep', 'manager', 'finance', 'admin']
const APPROVERS = ['manager', 'finance', 'admin']

app.use(cors({ origin: true, credentials: true }))
app.use(express.json())

// Wrap async handlers
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

async function emitOrder(quotationId) {
  try {
    const quotation = await quotDb.getQuotation(quotationId)
    const approvalsList = await appDb.listApprovals()
    const approval = approvalsList.find((a) => a.quotationId === quotationId)
    
    io.to(`order:${quotationId}`).emit('order:updated', {
      quotationId,
      quotation: quotation || null,
      approval: approval ? await appDb.getApproval(approval.id) : null,
    })
    io.to('workspace').emit('workspace:updated', { type: 'quotation', id: quotationId })
  } catch (err) {
    console.error('Error emitting order update:', err)
  }
}

io.on('connection', (socket) => {
  socket.on('join', (room) => {
    if (typeof room === 'string' && room.length < 80) socket.join(room)
  })
  socket.on('leave', (room) => {
    if (typeof room === 'string') socket.leave(room)
  })
})

async function auth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    const live = await usersDb.findById(decoded.id)
    if (!live) return res.status(401).json({ error: 'Unauthorized' })
    req.user = usersDb.publicUser(live)
    next()
  } catch {
    res.status(401).json({ error: 'Unauthorized' })
  }
}

function requireRoles(roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    next()
  }
}

function signUser(user) {
  const payload = usersDb.publicUser(user)
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
  return { token, user: payload }
}

// ── Health ───────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'dealflow360-pg', time: new Date().toISOString() })
})

// ── Auth ─────────────────────────────────────────────────────────────

app.post('/api/auth/login', wrap(async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase()
  const password = String(req.body?.password || '')
  const user = await usersDb.findByCredentials(email, password)
  if (!user) return res.status(401).json({ error: 'Invalid email or password' })
  res.json(signUser(user))
}))

app.post('/api/auth/signup', wrap(async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase()
  const password = String(req.body?.password || '')
  const name = String(req.body?.name || '').trim()
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' })
  if (name.length < 2) return res.status(400).json({ error: 'Name is required' })
  const existing = await usersDb.findByEmail(email)
  if (existing) return res.status(409).json({ error: 'An account with that email already exists' })
  
  const user = await usersDb.createCustomerUser(email, password, name)
  res.status(201).json(signUser(user))
}))

app.get('/api/me', auth, (req, res) => {
  res.json(req.user)
})

// ── Customers & Products ─────────────────────────────────────────────

app.get('/api/customers', auth, requireRoles(INTERNAL), wrap(async (_req, res) => {
  res.json({ items: await custDb.listCustomers() })
}))

app.get('/api/products', auth, wrap(async (_req, res) => {
  res.json(await prodDb.listProducts())
}))

app.post('/api/products', auth, requireRoles(['admin']), wrap(async (req, res) => {
  res.status(201).json(await prodDb.createProduct(req.body))
}))

app.get('/api/products/:id', auth, wrap(async (req, res) => {
  const data = await prodDb.getProduct(req.params.id)
  if (!data) return res.status(404).json({ error: 'Not found' })
  res.json(data)
}))

app.patch('/api/products/:id', auth, requireRoles(['admin']), wrap(async (req, res) => {
  const data = await prodDb.patchProduct(req.params.id, req.body)
  if (!data) return res.status(404).json({ error: 'Not found' })
  res.json(data)
}))

app.get('/api/pricelists', auth, requireRoles(INTERNAL), wrap(async (_req, res) => {
  res.json({ items: await prodDb.listPricelists() })
}))

// ── Dashboard & Reports ──────────────────────────────────────────────

app.get('/api/dashboard/summary', auth, requireRoles(INTERNAL), wrap(async (_req, res) => {
  res.json(await actDb.getDashboardSummary())
}))

app.get('/api/reports', auth, requireRoles(['admin']), wrap(async (req, res) => {
  res.json({ ...await actDb.getReports(), filters: req.query })
}))

// ── Quotations ───────────────────────────────────────────────────────

app.get('/api/quotations', auth, wrap(async (req, res) => {
  res.json({ items: await quotDb.listQuotations(req.user) })
}))

app.post('/api/quotations', auth, requireRoles(['rep', 'manager', 'admin']), wrap(async (req, res) => {
  const q = await quotDb.createQuotation(req.body, req.user)
  if (!q) return res.status(400).json({ error: 'Unknown customer' })
  res.status(201).json(q)
}))

app.get('/api/quotations/:id', auth, wrap(async (req, res) => {
  const q = await quotDb.getQuotation(req.params.id)
  if (!q) return res.status(404).json({ error: 'Not found' })
  if (req.user.role === 'customer' && q.customerId !== req.user.customerId) return res.status(403).json({ error: 'Forbidden' })
  res.json(q)
}))

app.patch('/api/quotations/:id', auth, requireRoles(INTERNAL), wrap(async (req, res) => {
  const q = await quotDb.patchQuotation(req.params.id, req.body)
  if (!q) return res.status(404).json({ error: 'Not found' })
  res.json(q)
}))

app.post('/api/quotations/:id/lines', auth, requireRoles(INTERNAL), wrap(async (req, res) => {
  const q = await quotDb.addLine(req.params.id, req.body)
  if (!q) return res.status(404).json({ error: 'Not found' })
  res.json(q)
}))

app.patch('/api/quotations/:id/lines/:lineId', auth, requireRoles(INTERNAL), wrap(async (req, res) => {
  const q = await quotDb.patchLine(req.params.id, req.params.lineId, req.body)
  if (!q) return res.status(404).json({ error: 'Not found' })
  await emitOrder(req.params.id)
  res.json(q)
}))

app.delete('/api/quotations/:id/lines/:lineId', auth, requireRoles(INTERNAL), wrap(async (req, res) => {
  const q = await quotDb.deleteLine(req.params.id, req.params.lineId)
  if (!q) return res.status(404).json({ error: 'Not found' })
  await emitOrder(req.params.id)
  res.json(q)
}))

app.post('/api/quotations/:id/submit', auth, requireRoles(INTERNAL), wrap(async (req, res) => {
  const q = await quotDb.getQuotation(req.params.id)
  if (!q) return res.status(404).json({ error: 'Not found' })
  if (q.lines.length === 0) return res.status(400).json({ error: 'Cannot submit an empty quotation' })

  const { query } = await import('./db/pool.js')
  const { requiredApprovalLevel, nextId, loadDiscountConfig } = await import('./db/helpers.js')
  const config = await loadDiscountConfig()
  const level = requiredApprovalLevel(q.riskLevel, config)
  let approvalId

  let requiresFinance = false
  for (const l of q.lines) {
    const { rows: stockRows } = await query(
      'SELECT COALESCE(SUM(in_stock), 0)::int AS total_stock FROM stock WHERE product_id = $1',
      [l.productId],
    )
    const totalStock = stockRows[0]?.total_stock || 0
    if (totalStock > 0 && Number(l.qty) / totalStock > 0.70) {
      requiresFinance = true
      break
    }
  }

  const needsApproval = level !== 'none' || requiresFinance

  let fulfillmentId = null

  if (!needsApproval) {
    await query("UPDATE quotations SET status = 'approved', portal_status = 'sent' WHERE id = $1", [q.id])

    const { rows: existingA } = await query('SELECT id FROM approvals WHERE quotation_id = $1', [q.id])
    if (existingA.length > 0) {
      approvalId = existingA[0].id
      await query("UPDATE approvals SET status = 'approved', stage = 'confirmed', assigned_to = '—', assigned_role = 'none' WHERE id = $1", [approvalId])
    } else {
      approvalId = nextId('a')
      await query(`INSERT INTO approvals (id, quotation_id, status, stage, assigned_to, assigned_role, days_pending) VALUES ($1, $2, 'approved', 'confirmed', '—', 'none', 0)`, [approvalId, q.id])
    }

    await query(`INSERT INTO approval_audit_log (approval_id, user_name, user_id, action, date, note) VALUES ($1, $2, $3, 'Submitted', $4, 'Within policy and quantity limits. Auto-approved.')`, [approvalId, req.user.name, req.user.id, new Date().toISOString()])
    const fulfillment = await fulfillDb.createFulfillmentFromQuote(q.id)
    fulfillmentId = fulfillment?.id ?? null
    await actDb.logActivity(`${q.customerName} quotation ${q.number} auto-approved and sent to fulfillment`)
  } else {
    await query("UPDATE quotations SET status = 'pending_approval', portal_status = 'sent' WHERE id = $1", [q.id])
    
    const { rows: existingA } = await query('SELECT id FROM approvals WHERE quotation_id = $1', [q.id])
    const initialStage = level !== 'none' ? 'sales_manager' : 'finance';
    const initialAssignedTo = initialStage === 'sales_manager' ? 'Jordan Chen' : 'Sam Patel';
    const initialAssignedRole = initialStage === 'sales_manager' ? 'manager' : 'finance';

    if (existingA.length > 0) {
      approvalId = existingA[0].id
      await query("UPDATE approvals SET status = 'pending', stage = $1, assigned_to = $2, assigned_role = $3 WHERE id = $4", [initialStage, initialAssignedTo, initialAssignedRole, approvalId])
    } else {
      approvalId = nextId('a')
      await query(`INSERT INTO approvals (id, quotation_id, status, stage, assigned_to, assigned_role, days_pending) VALUES ($1, $2, 'pending', $3, $4, $5, 0)`, [approvalId, q.id, initialStage, initialAssignedTo, initialAssignedRole])
    }
    
    let reason = level !== 'none' ? `Blended risk ${q.riskLevel} (${q.riskScore}).` : `70% quantity rule triggered.`
    await query(`INSERT INTO approval_audit_log (approval_id, user_name, user_id, action, date, note) VALUES ($1, $2, $3, 'Submitted', $4, $5)`, [approvalId, req.user.name, req.user.id, new Date().toISOString(), `${reason} Routing to ${initialStage === 'sales_manager' ? 'Sales Manager' : 'Finance'}.`])
    await actDb.logActivity(`${q.customerName} quotation ${q.number} submitted for approval`)
  }
  
  await emitOrder(q.id)
  
  // Re-fetch to return latest state
  const updatedQ = await quotDb.getQuotation(q.id)
  res.json({
    quotation: updatedQ,
    approvalRequired: needsApproval,
    approvalId,
    fulfillmentId,
    riskScore: updatedQ.riskScore,
    riskLevel: updatedQ.riskLevel,
  })
}))

// ── Approvals ────────────────────────────────────────────────────────

app.get('/api/approvals', auth, requireRoles(APPROVERS), wrap(async (_req, res) => {
  res.json({ items: await appDb.listApprovals() })
}))

app.get('/api/approvals/:id', auth, requireRoles(INTERNAL), wrap(async (req, res) => {
  const data = await appDb.getApproval(req.params.id)
  if (!data) return res.status(404).json({ error: 'Not found' })
  res.json(data)
}))

app.post('/api/approvals/:id/approve', auth, requireRoles(APPROVERS), wrap(async (req, res) => {
  const result = await appDb.approveApproval(req.params.id, req.user, req.body?.note)
  if (result.error) return res.status(result.status).json({ error: result.error })
  await emitOrder(result.data.quotationId)
  res.json(result.data)
}))

app.post('/api/approvals/:id/return', auth, requireRoles(APPROVERS), wrap(async (req, res) => {
  const result = await appDb.returnApproval(req.params.id, req.user, req.body?.note)
  if (result.error) return res.status(result.status).json({ error: result.error })
  await emitOrder(result.data.quotationId)
  res.json(result.data)
}))

app.post('/api/approvals/:id/reject', auth, requireRoles(APPROVERS), wrap(async (req, res) => {
  const result = await appDb.rejectApproval(req.params.id, req.user, req.body?.note)
  if (result.error) return res.status(result.status).json({ error: result.error })
  await emitOrder(result.data.quotationId)
  res.json(result.data)
}))

// ── Fulfillment ──────────────────────────────────────────────────────

app.get('/api/fulfillment', auth, requireRoles(INTERNAL), wrap(async (_req, res) => {
  res.json(await fulfillDb.listFulfillment())
}))

app.get('/api/fulfillment/:id', auth, requireRoles(INTERNAL), wrap(async (req, res) => {
  const data = await fulfillDb.getFulfillmentOrder(req.params.id)
  if (!data) return res.status(404).json({ error: 'Not found' })
  res.json(data)
}))

app.post('/api/fulfillment/:id/accept-split', auth, requireRoles(['finance', 'admin']), wrap(async (req, res) => {
  const data = await fulfillDb.acceptSplit(req.params.id, req.user.name)
  io.to('workspace').emit('workspace:updated', { type: 'fulfillment', id: req.params.id })
  res.json(data)
}))

app.post('/api/fulfillment/:id/override', auth, requireRoles(['finance', 'admin']), wrap(async (req, res) => {
  const data = await fulfillDb.overrideFulfillment(req.params.id, req.body, req.user.name)
  io.to('workspace').emit('workspace:updated', { type: 'fulfillment', id: req.params.id })
  res.json(data)
}))

app.post('/api/fulfillment/:id/consolidate', auth, requireRoles(['finance', 'admin']), wrap(async (req, res) => {
  const data = await fulfillDb.consolidateBackorder(req.params.id, req.user.name)
  if (!data) return res.status(404).json({ error: 'Not found' })
  io.to('workspace').emit('workspace:updated', { type: 'fulfillment', id: req.params.id })
  res.json(data)
}))

// ── Subscriptions ────────────────────────────────────────────────────

app.get('/api/subscriptions', auth, requireRoles(INTERNAL), wrap(async (_req, res) => {
  res.json({ items: await subDb.listSubscriptions() })
}))

app.post('/api/subscriptions', auth, requireRoles(['admin']), wrap(async (req, res) => {
  res.status(201).json(await subDb.createSubscription(req.body))
}))

app.get('/api/subscriptions/:id', auth, requireRoles(INTERNAL), wrap(async (req, res) => {
  const data = await subDb.getSubscription(req.params.id)
  if (!data) return res.status(404).json({ error: 'Not found' })
  res.json(data)
}))

app.post('/api/subscriptions/:id/cancel', auth, requireRoles(['admin', 'finance', 'manager']), wrap(async (req, res) => {
  const data = await subDb.cancelSubscription(req.params.id, req.user.name)
  if (!data) return res.status(404).json({ error: 'Not found' })
  res.json(data)
}))

app.post('/api/subscriptions/:id/modify', auth, requireRoles(['admin', 'finance']), wrap(async (req, res) => {
  const data = await subDb.modifySubscription(req.params.id, req.body, req.user.name)
  if (!data) return res.status(404).json({ error: 'Not found' })
  res.json(data)
}))

// ── Invoices ─────────────────────────────────────────────────────────

app.get('/api/invoices', auth, requireRoles(INTERNAL), wrap(async (_req, res) => {
  res.json({ items: await invDb.listInvoices() })
}))

app.get('/api/invoices/:id', auth, requireRoles(INTERNAL), wrap(async (req, res) => {
  const data = await invDb.getInvoice(req.params.id)
  if (!data) return res.status(404).json({ error: 'Not found' })
  res.json(data)
}))

app.post('/api/invoices/:id/record-payment', auth, requireRoles(['rep', 'manager', 'finance', 'admin']), wrap(async (req, res) => {
  const data = await invDb.recordPayment(req.params.id, req.user)
  if (!data) return res.status(404).json({ error: 'Not found' })
  io.to('workspace').emit('workspace:updated', { type: 'invoice', id: req.params.id })
  res.json(data)
}))

app.post('/api/invoices/:id/status', auth, requireRoles(['rep', 'manager', 'finance', 'admin']), wrap(async (req, res) => {
  const data = await invDb.setInvoiceStatus(req.params.id, req.body?.status === 'paid' ? 'paid' : 'unpaid', req.user)
  if (!data) return res.status(404).json({ error: 'Not found' })
  io.to('workspace').emit('workspace:updated', { type: 'invoice', id: req.params.id })
  res.json(data)
}))

// ── Deal Health ──────────────────────────────────────────────────────

app.get('/api/deal-health', auth, requireRoles(APPROVERS), wrap(async (_req, res) => {
  res.json(await healthDb.getDealHealth())
}))

app.post('/api/deal-health/:id/escalate', auth, requireRoles(APPROVERS), wrap(async (req, res) => {
  const data = await healthDb.escalate(req.params.id, req.user.name)
  if (!data) return res.status(404).json({ error: 'Not found' })
  res.json(data)
}))

app.post('/api/deal-health/:id/nudge', auth, requireRoles(APPROVERS), wrap(async (req, res) => {
  const data = await healthDb.nudge(req.params.id, req.user.name)
  if (!data) return res.status(404).json({ error: 'Not found' })
  res.json(data)
}))

// ── Discount Config ──────────────────────────────────────────────────

app.get('/api/discount-config', auth, requireRoles(['admin', 'finance']), wrap(async (_req, res) => {
  res.json(await confDb.getDiscountConfig())
}))

app.post('/api/discount-config', auth, requireRoles(['admin']), wrap(async (req, res) => {
  res.json(await confDb.saveDiscountConfig(req.body))
}))

// ── Portal ───────────────────────────────────────────────────────────

app.post('/api/portal/quotes', auth, requireRoles(['customer']), wrap(async (req, res) => {
  const { lines } = req.body
  if (!lines || lines.length === 0) return res.status(400).json({ error: 'Cart is empty' })
  
  const q = await portalDb.createPortalQuote(req.user, lines)
  io.to('workspace').emit('workspace:updated', { type: 'quotation', id: q.id })
  res.status(201).json(q)
}))

app.get('/api/portal/quotes', auth, requireRoles(['customer']), wrap(async (req, res) => {
  res.json({ items: await portalDb.listPortalQuotes(req.user.customerId) })
}))

app.get('/api/portal/quote/:id', auth, requireRoles(['customer']), wrap(async (req, res) => {
  const data = await portalDb.getPortalQuote(req.params.id, req.user.customerId)
  if (!data) return res.status(404).json({ error: 'Not found' })
  res.json(data)
}))

app.post('/api/portal/quote/:id/negotiate', auth, requireRoles(['customer']), wrap(async (req, res) => {
  const result = await portalDb.negotiate(req.params.id, req.user.customerId, req.user, req.body)
  if (!result) return res.status(404).json({ error: 'Not found' })
  await emitOrder(result.quotationId)
  res.json(result)
}))

app.post('/api/portal/quote/:id/confirm', auth, requireRoles(['customer']), wrap(async (req, res) => {
  const result = await portalDb.confirmPortalQuote(req.params.id, req.user.customerId, req.user)
  if (!result) return res.status(404).json({ error: 'Not found' })
  await emitOrder(req.params.id)
  res.json(result)
}))

app.get('/api/portal/messages', auth, requireRoles(['customer']), wrap(async (req, res) => {
  res.json({ items: await portalDb.listPortalMessages(req.user.customerId) })
}))

app.get('/api/portal/profile', auth, requireRoles(['customer']), wrap(async (req, res) => {
  res.json(await portalDb.getPortalProfile(req.user))
}))

// ── Error handler & Boot ─────────────────────────────────────────────

app.use((err, _req, res, _next) => {
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON' })
  }
  if (err?.status) {
    return res.status(err.status).json({ error: err.message })
  }
  console.error(err)
  res.status(500).json({ error: 'Internal server error' })
})

httpServer.listen(PORT, () => {
  console.log(`DealFlow360 API on http://localhost:${PORT} (PostgreSQL Backend)`)
})

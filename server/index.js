import cors from 'cors'
import express from 'express'
import { createServer } from 'http'
import jwt from 'jsonwebtoken'
import { Server } from 'socket.io'
import {
  appendAudit,
  approvalDetail,
  computeQuotationRisk,
  db,
  getUpsells,
  listItem,
  logActivity,
  nextId,
  publicUser,
  requiredApprovalLevel,
} from './store.js'

const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: { origin: true, credentials: true },
})

const PORT = Number(process.env.PORT || 3001)
const JWT_SECRET = process.env.JWT_SECRET || 'df360-dev-secret'

app.use(cors({ origin: true, credentials: true }))
app.use(express.json())

function emitOrder(quotationId) {
  const quotation = db.quotations.find((q) => q.id === quotationId)
  if (quotation) computeQuotationRisk(quotation)
  const approval = db.approvals.find((a) => a.quotationId === quotationId)
  io.to(`order:${quotationId}`).emit('order:updated', {
    quotationId,
    quotation: quotation ? { ...quotation, upsells: getUpsells(quotation) } : null,
    approval: approval ? approvalDetail(approval) : null,
  })
  io.to('workspace').emit('workspace:updated', { type: 'quotation', id: quotationId })
}

io.on('connection', (socket) => {
  socket.on('join', (room) => {
    if (typeof room === 'string' && room.length < 80) socket.join(room)
  })
  socket.on('leave', (room) => {
    if (typeof room === 'string') socket.leave(room)
  })
})

function auth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  try {
    req.user = jwt.verify(token, JWT_SECRET)
    const live = db.users.find((u) => u.id === req.user.id)
    if (!live) return res.status(401).json({ error: 'Unauthorized' })
    req.user = { ...req.user, ...publicUser(live) }
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
  const payload = publicUser(user)
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
  return { token, user: payload }
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'dealflow360', time: new Date().toISOString() })
})

app.post('/api/auth/login', (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase()
  const password = String(req.body?.password || '')
  const user = db.users.find((u) => u.email === email && u.password === password)
  if (!user) return res.status(401).json({ error: 'Invalid email or password' })
  res.json(signUser(user))
})

app.post('/api/auth/signup', (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase()
  const password = String(req.body?.password || '')
  const name = String(req.body?.name || '').trim() || email.split('@')[0]
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' })
  if (db.users.some((u) => u.email === email)) {
    return res.status(409).json({ error: 'An account with that email already exists' })
  }
  const customerId = nextId('c', db.customers)
  const customer = {
    id: customerId,
    name: `${name} (portal)`,
    tier: 'Bronze',
    region: 'North America',
    terms: 'Net 30',
  }
  db.customers.push(customer)
  const user = {
    id: nextId('u', db.users),
    email,
    password,
    name,
    role: 'customer',
    customerId,
  }
  db.users.push(user)
  res.status(201).json(signUser(user))
})

app.get('/api/me', auth, (req, res) => {
  res.json(req.user)
})

app.get('/api/customers', auth, (_req, res) => {
  res.json({ items: db.customers })
})

app.get('/api/pricelists', auth, (_req, res) => {
  res.json({ items: db.pricelists })
})

app.get('/api/dashboard/summary', auth, (_req, res) => {
  const pendingApprovals = db.approvals.filter((a) => a.status === 'pending').length
  const openQuotations = db.quotations.filter((q) =>
    ['draft', 'pending_approval', 'negotiation'].includes(q.status),
  ).length
  const atRiskDeals = db.dealHealth.length
  let valueWeight = 0
  let discountWeight = 0
  for (const q of db.quotations) {
    computeQuotationRisk(q)
    for (const line of q.lines) {
      const v = line.qty * line.price
      valueWeight += v
      discountWeight += v * line.discountPercent
    }
  }
  const totalDealValue = db.quotations.reduce((sum, q) => sum + q.amount, 0)
  const avgDiscount = valueWeight === 0 ? 0 : discountWeight / valueWeight
  res.json({
    pendingApprovals,
    openQuotations,
    atRiskDeals,
    totalDealValue,
    avgDiscount: Math.round(avgDiscount * 10) / 10,
    deals: db.quotations.map((q) => ({
      id: q.id,
      number: q.number,
      customerName: q.customerName,
      amount: q.amount,
      status: q.status,
      riskScore: q.riskScore,
      riskLevel: q.riskLevel,
    })),
    activity: db.activity,
  })
})

app.get('/api/quotations', auth, (req, res) => {
  if (req.user.role === 'customer') {
    const items = db.quotations
      .filter((q) => q.customerId === req.user.customerId)
      .map(listItem)
    return res.json({ items })
  }
  res.json({ items: db.quotations.map((q) => listItem(computeQuotationRisk(q))) })
})

app.post('/api/quotations', auth, requireRoles(['rep', 'manager', 'admin']), (req, res) => {
  const customerId = req.body?.customerId || db.customers[0].id
  const customer = db.customers.find((c) => c.id === customerId)
  if (!customer) return res.status(400).json({ error: 'Unknown customer' })
  const seq = 1049 + db.quotations.length
  const quotation = computeQuotationRisk({
    id: nextId('q', db.quotations),
    number: `Q-${seq}`,
    customerId: customer.id,
    date: new Date().toISOString(),
    repId: req.user.id,
    repName: req.user.name,
    status: 'draft',
    currency: 'USD',
    region: customer.region,
    terms: customer.terms,
    priceListId: req.body?.priceListId || 'pl-usd',
    lines: [],
  })
  db.quotations.unshift(quotation)
  logActivity(`${customer.name} draft quotation ${quotation.number} created by ${req.user.name}`)
  res.status(201).json({ ...quotation, upsells: getUpsells(quotation) })
})

app.get('/api/quotations/:id', auth, (req, res) => {
  const quotation = db.quotations.find((q) => q.id === req.params.id)
  if (!quotation) return res.status(404).json({ error: 'Quotation not found' })
  if (req.user.role === 'customer' && quotation.customerId !== req.user.customerId) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  computeQuotationRisk(quotation)
  res.json({ ...quotation, upsells: getUpsells(quotation) })
})

app.patch('/api/quotations/:id', auth, (req, res) => {
  const quotation = db.quotations.find((q) => q.id === req.params.id)
  if (!quotation) return res.status(404).json({ error: 'Quotation not found' })
  const { customerId, priceListId, region, terms, currency } = req.body || {}
  if (customerId) {
    const customer = db.customers.find((c) => c.id === customerId)
    if (!customer) return res.status(400).json({ error: 'Unknown customer' })
    quotation.customerId = customer.id
    quotation.region = customer.region
    quotation.terms = customer.terms
  }
  if (priceListId) quotation.priceListId = priceListId
  if (region) quotation.region = region
  if (terms) quotation.terms = terms
  if (currency) quotation.currency = currency
  computeQuotationRisk(quotation)
  res.json({ ...quotation, upsells: getUpsells(quotation) })
})

app.post('/api/quotations/:id/lines', auth, (req, res) => {
  const quotation = db.quotations.find((q) => q.id === req.params.id)
  if (!quotation) return res.status(404).json({ error: 'Quotation not found' })
  const product = db.products.find((p) => p.id === req.body?.productId)
  if (!product) return res.status(400).json({ error: 'Unknown product' })
  quotation.lines.push({
    id: nextId('l', quotation.lines),
    productId: product.id,
    productName: product.name,
    category: product.category,
    qty: Number(req.body?.qty) || 1,
    price: product.price,
    discountPercent: Number(req.body?.discountPercent) || 0,
    comment: '',
  })
  computeQuotationRisk(quotation)
  res.json({ ...quotation, upsells: getUpsells(quotation) })
})

app.patch('/api/quotations/:id/lines/:lineId', auth, (req, res) => {
  const quotation = db.quotations.find((q) => q.id === req.params.id)
  if (!quotation) return res.status(404).json({ error: 'Quotation not found' })
  const line = quotation.lines.find((l) => l.id === req.params.lineId)
  if (!line) return res.status(404).json({ error: 'Line not found' })
  if (req.body?.discountPercent !== undefined) {
    line.discountPercent = Math.max(0, Math.min(80, Number(req.body.discountPercent)))
  }
  if (req.body?.qty !== undefined) line.qty = Math.max(1, Number(req.body.qty))
  computeQuotationRisk(quotation)
  emitOrder(quotation.id)
  res.json({ ...quotation, upsells: getUpsells(quotation) })
})

app.delete('/api/quotations/:id/lines/:lineId', auth, (req, res) => {
  const quotation = db.quotations.find((q) => q.id === req.params.id)
  if (!quotation) return res.status(404).json({ error: 'Quotation not found' })
  quotation.lines = quotation.lines.filter((l) => l.id !== req.params.lineId)
  computeQuotationRisk(quotation)
  res.json({ ...quotation, upsells: getUpsells(quotation) })
})

app.post('/api/quotations/:id/submit', auth, (req, res) => {
  const quotation = db.quotations.find((q) => q.id === req.params.id)
  if (!quotation) return res.status(404).json({ error: 'Quotation not found' })
  if (quotation.lines.length === 0) {
    return res.status(400).json({ error: 'Cannot submit an empty quotation' })
  }
  computeQuotationRisk(quotation)
  const level = requiredApprovalLevel(quotation)
  if (level === 'none') {
    quotation.status = 'confirmed'
    quotation.portalStatus = 'confirmed'
    let approval = db.approvals.find((a) => a.quotationId === quotation.id)
    if (!approval) {
      approval = {
        id: nextId('a', db.approvals),
        quotationId: quotation.id,
        status: 'approved',
        stage: 'confirmed',
        assignedTo: '—',
        assignedRole: 'none',
        daysPending: 0,
        auditLog: [],
      }
      db.approvals.unshift(approval)
    }
    approval.status = 'approved'
    approval.stage = 'confirmed'
    appendAudit(approval, req.user, 'Submitted', 'Within policy — no approval required.')
    appendAudit(approval, { id: 'system', name: 'System' }, 'Auto-approved', `Risk ${quotation.riskLevel} (${quotation.riskScore}).`)
    createFulfillmentFromQuote(quotation)
    logActivity(`${quotation.customerName} quotation ${quotation.number} confirmed (no approval required)`)
    emitOrder(quotation.id)
    return res.json({
      quotation,
      approvalRequired: false,
      approvalId: approval.id,
      riskScore: quotation.riskScore,
      riskLevel: quotation.riskLevel,
    })
  }

  quotation.status = 'pending_approval'
  quotation.portalStatus = 'sent'
  let approval = db.approvals.find((a) => a.quotationId === quotation.id)
  if (!approval) {
    approval = {
      id: nextId('a', db.approvals),
      quotationId: quotation.id,
      status: 'pending',
      stage: 'sales_manager',
      assignedTo: 'Jordan Chen',
      assignedRole: 'manager',
      daysPending: 0,
      auditLog: [],
    }
    db.approvals.unshift(approval)
  }
  approval.status = 'pending'
  approval.stage = 'sales_manager'
  approval.assignedTo = 'Jordan Chen'
  approval.assignedRole = 'manager'
  appendAudit(
    approval,
    req.user,
    'Submitted',
    `Blended risk ${quotation.riskLevel} (${quotation.riskScore}). Routing to ${level === 'finance' ? 'Sales Manager then Finance' : 'Sales Manager'}.`,
  )
  logActivity(
    `${quotation.customerName} quotation ${quotation.number} submitted for approval (blended ${quotation.riskLevel})`,
  )
  emitOrder(quotation.id)
  res.json({
    quotation,
    approvalRequired: true,
    approvalId: approval.id,
    riskScore: quotation.riskScore,
    riskLevel: quotation.riskLevel,
  })
})

function createFulfillmentFromQuote(quotation) {
  if (db.fulfillment.some((f) => f.quotationId === quotation.id)) return
  const hardware = quotation.lines.filter((l) => l.category === 'Hardware')
  db.fulfillment.unshift({
    id: nextId('f', db.fulfillment),
    quotationId: quotation.id,
    orderNumber: quotation.number.replace('Q-', 'SO-'),
    customerId: quotation.customerId,
    customerName: quotation.customerName,
    status: hardware.length ? 'ready' : 'ready',
    warehouse: 'East DC',
    lines: quotation.lines.map((l) => ({
      productId: l.productId,
      productName: l.productName,
      qty: l.qty,
      suggested: [
        {
          warehouse: l.category === 'Services' ? 'Services desk' : 'East DC',
          qtyFulfilled: l.qty,
          estShipments: 1,
          cost: l.category === 'Services' ? 0 : 120,
          available: 20,
        },
      ],
    })),
  })
}

app.get('/api/approvals', auth, (_req, res) => {
  const items = db.approvals.map((a) => {
    const q = db.quotations.find((x) => x.id === a.quotationId)
    computeQuotationRisk(q)
    return {
      id: a.id,
      quotationId: q.id,
      quotationNumber: q.number,
      customerName: q.customerName,
      blendedRisk: q.blendedRisk,
      riskLevel: q.riskLevel,
      riskScore: q.riskScore,
      stage: a.stage,
      assignedTo: a.assignedTo,
      status: a.status,
      daysPending: a.daysPending,
      amount: q.amount,
    }
  })
  res.json({ items })
})

app.get('/api/approvals/:id', auth, (req, res) => {
  const approval = db.approvals.find((a) => a.id === req.params.id)
  if (!approval) return res.status(404).json({ error: 'Approval not found' })
  res.json(approvalDetail(approval))
})

function canActOnStep(user, approval) {
  if (user.role === 'admin') return true
  if (approval.stage === 'sales_manager' && ['manager', 'finance'].includes(user.role)) return true
  if (approval.stage === 'finance' && user.role === 'finance') return true
  return false
}

app.post('/api/approvals/:id/approve', auth, (req, res) => {
  const approval = db.approvals.find((a) => a.id === req.params.id)
  if (!approval) return res.status(404).json({ error: 'Approval not found' })
  if (!canActOnStep(req.user, approval)) return res.status(403).json({ error: 'Not assigned to this step' })
  const quotation = db.quotations.find((q) => q.id === approval.quotationId)
  const note = String(req.body?.note || 'Approved.')
  if (approval.stage === 'sales_manager' && quotation.riskLevel === 'HIGH') {
    approval.stage = 'finance'
    approval.assignedTo = 'Sam Patel'
    approval.assignedRole = 'finance'
    approval.status = 'pending'
    appendAudit(approval, req.user, 'Approved', `${note} Routed to Finance.`)
  } else {
    approval.stage = 'confirmed'
    approval.status = 'approved'
    approval.assignedTo = '—'
    quotation.status = 'confirmed'
    quotation.portalStatus = 'confirmed'
    appendAudit(approval, req.user, 'Approved', note)
    createFulfillmentFromQuote(quotation)
  }
  logActivity(`${quotation.customerName} quotation ${quotation.number} approved by ${req.user.name}`)
  const detail = approvalDetail(approval)
  emitOrder(quotation.id)
  res.json(detail)
})

app.post('/api/approvals/:id/return', auth, (req, res) => {
  const approval = db.approvals.find((a) => a.id === req.params.id)
  if (!approval) return res.status(404).json({ error: 'Approval not found' })
  if (!canActOnStep(req.user, approval)) return res.status(403).json({ error: 'Not assigned to this step' })
  const quotation = db.quotations.find((q) => q.id === approval.quotationId)
  const note = String(req.body?.note || 'Returned for revision.')
  approval.status = 'returned'
  approval.stage = 'submitted'
  approval.assignedTo = quotation.repName
  quotation.status = 'draft'
  appendAudit(approval, req.user, 'Returned', note)
  logActivity(`${quotation.number} returned for revision by ${req.user.name}`)
  const detail = approvalDetail(approval)
  emitOrder(quotation.id)
  res.json(detail)
})

app.post('/api/approvals/:id/reject', auth, (req, res) => {
  const approval = db.approvals.find((a) => a.id === req.params.id)
  if (!approval) return res.status(404).json({ error: 'Approval not found' })
  if (!canActOnStep(req.user, approval)) return res.status(403).json({ error: 'Not assigned to this step' })
  const quotation = db.quotations.find((q) => q.id === approval.quotationId)
  const note = String(req.body?.note || 'Rejected.')
  approval.status = 'rejected'
  quotation.status = 'rejected'
  quotation.portalStatus = 'rejected'
  appendAudit(approval, req.user, 'Rejected', note)
  logActivity(`${quotation.number} rejected by ${req.user.name}`)
  const detail = approvalDetail(approval)
  emitOrder(quotation.id)
  res.json(detail)
})

app.get('/api/fulfillment', auth, (_req, res) => {
  res.json({
    stock: db.stock.map((s) => ({
      ...s,
      available: Math.max(0, s.inStock - s.reserved),
    })),
    orders: db.fulfillment.map((f) => ({
      id: f.id,
      orderNumber: f.orderNumber,
      customerName: f.customerName,
      status: f.status,
      warehouse: f.warehouse,
    })),
  })
})

app.get('/api/fulfillment/:id', auth, (req, res) => {
  const order = db.fulfillment.find((f) => f.id === req.params.id)
  if (!order) return res.status(404).json({ error: 'Fulfillment order not found' })
  res.json(order)
})

app.post('/api/fulfillment/:id/accept-split', auth, requireRoles(['finance', 'admin']), (req, res) => {
  const order = db.fulfillment.find((f) => f.id === req.params.id)
  if (!order) return res.status(404).json({ error: 'Fulfillment order not found' })
  order.status = 'ready'
  order.splitAccepted = true
  logActivity(`${order.orderNumber} split shipment accepted by ${req.user.name}`)
  io.to('workspace').emit('workspace:updated', { type: 'fulfillment', id: order.id })
  res.json(order)
})

app.post('/api/fulfillment/:id/override', auth, requireRoles(['finance', 'admin']), (req, res) => {
  const order = db.fulfillment.find((f) => f.id === req.params.id)
  if (!order) return res.status(404).json({ error: 'Fulfillment order not found' })
  if (Array.isArray(req.body?.lines)) {
    order.lines = req.body.lines
  }
  order.status = req.body?.status || 'ready'
  order.overridden = true
  logActivity(`${order.orderNumber} inventory override by ${req.user.name}`)
  io.to('workspace').emit('workspace:updated', { type: 'fulfillment', id: order.id })
  res.json(order)
})

app.get('/api/subscriptions', auth, (_req, res) => {
  res.json({ items: db.subscriptions })
})

app.post('/api/subscriptions', auth, requireRoles(['admin']), (req, res) => {
  const customer = db.customers.find((c) => c.id === req.body?.customerId) || db.customers[0]
  const sub = {
    id: nextId('s', db.subscriptions),
    customerId: customer.id,
    customerName: customer.name,
    plan: req.body?.plan || 'Custom Plan',
    cycle: req.body?.cycle || 'annual',
    nextBill: req.body?.nextBill || '2026-10-01',
    amount: Number(req.body?.amount) || 0,
    status: 'active',
    originatingOrderId: req.body?.originatingOrderId || null,
    oneTimeLines: [],
    recurringLines: [
      {
        plan: req.body?.plan || 'Custom Plan',
        cycle: req.body?.cycle || 'annual',
        nextBillDate: req.body?.nextBill || '2026-10-01',
        amount: Number(req.body?.amount) || 0,
      },
    ],
  }
  db.subscriptions.unshift(sub)
  res.status(201).json(sub)
})

app.get('/api/subscriptions/:id', auth, (req, res) => {
  const sub = db.subscriptions.find((s) => s.id === req.params.id)
  if (!sub) return res.status(404).json({ error: 'Subscription not found' })
  res.json(sub)
})

app.post('/api/subscriptions/:id/cancel', auth, (req, res) => {
  const sub = db.subscriptions.find((s) => s.id === req.params.id)
  if (!sub) return res.status(404).json({ error: 'Subscription not found' })
  sub.status = 'cancelled'
  logActivity(`${sub.plan} for ${sub.customerName} cancelled by ${req.user.name}`)
  res.json(sub)
})

app.post('/api/subscriptions/:id/modify', auth, (req, res) => {
  const sub = db.subscriptions.find((s) => s.id === req.params.id)
  if (!sub) return res.status(404).json({ error: 'Subscription not found' })
  if (req.body?.cycle) sub.cycle = req.body.cycle
  if (req.body?.amount !== undefined) sub.amount = Number(req.body.amount)
  if (req.body?.status) sub.status = req.body.status
  if (sub.recurringLines[0]) {
    sub.recurringLines[0].cycle = sub.cycle
    sub.recurringLines[0].amount = sub.amount
  }
  logActivity(`${sub.plan} for ${sub.customerName} modified by ${req.user.name}`)
  res.json(sub)
})

app.get('/api/invoices', auth, (_req, res) => {
  res.json({ items: db.invoices })
})

app.get('/api/invoices/:id', auth, (req, res) => {
  const invoice = db.invoices.find((i) => i.id === req.params.id)
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' })
  res.json(invoice)
})

function applyInvoiceStatus(invoice, status, user) {
  const paid = status === 'paid'
  invoice.status = paid ? 'paid' : 'unpaid'
  invoice.step = paid ? 'paid' : 'invoiced'
  invoice.lines = invoice.lines.map((l) => ({ ...l, status: invoice.status }))
  if (paid) {
    const labels = {
      rep: 'Sales Rep',
      manager: 'Sales Manager',
      finance: 'Finance',
      admin: 'Administrator',
    }
    invoice.paymentRecordedBy = {
      name: user.name,
      role: user.role,
      roleLabel: labels[user.role] || user.role,
    }
  } else {
    invoice.paymentRecordedBy = null
  }
  logActivity(`Invoice ${invoice.number} marked ${invoice.status} by ${user.name}`)
  io.to('workspace').emit('workspace:updated', { type: 'invoice', id: invoice.id })
  return invoice
}

app.post('/api/invoices/:id/record-payment', auth, requireRoles(['rep', 'manager', 'admin']), (req, res) => {
  const invoice = db.invoices.find((i) => i.id === req.params.id)
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' })
  res.json(applyInvoiceStatus(invoice, 'paid', req.user))
})

app.post('/api/invoices/:id/status', auth, requireRoles(['rep', 'manager', 'admin']), (req, res) => {
  const invoice = db.invoices.find((i) => i.id === req.params.id)
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' })
  const status = req.body?.status === 'paid' ? 'paid' : 'unpaid'
  res.json(applyInvoiceStatus(invoice, status, req.user))
})

app.get('/api/deal-health', auth, (_req, res) => {
  const stalled = db.dealHealth.filter((d) => d.type === 'stalled').length
  const anomalies = db.dealHealth.filter((d) => d.type === 'anomaly').length
  const slippage = db.dealHealth.filter((d) => d.type === 'slippage').length
  const byStage = [
    { stage: 'Draft', count: db.quotations.filter((q) => q.status === 'draft').length },
    { stage: 'Pending', count: db.quotations.filter((q) => q.status === 'pending_approval').length },
    { stage: 'Negotiation', count: db.quotations.filter((q) => q.status === 'negotiation').length },
    { stage: 'Approved', count: db.quotations.filter((q) => q.status === 'approved').length },
    { stage: 'Confirmed', count: db.quotations.filter((q) => q.status === 'confirmed').length },
  ]
  res.json({
    stalled,
    anomalies,
    slippage,
    items: db.dealHealth,
    byStage,
  })
})

app.post('/api/deal-health/:id/escalate', auth, (req, res) => {
  const item = db.dealHealth.find((d) => d.id === req.params.id)
  if (!item) return res.status(404).json({ error: 'Flag not found' })
  logActivity(`${req.user.name} escalated ${item.deal}: ${item.issue}`)
  item.escalated = true
  res.json(item)
})

app.post('/api/deal-health/:id/nudge', auth, (req, res) => {
  const item = db.dealHealth.find((d) => d.id === req.params.id)
  if (!item) return res.status(404).json({ error: 'Flag not found' })
  logActivity(`${req.user.name} nudged the rep on ${item.deal}`)
  item.nudged = true
  res.json(item)
})

app.get('/api/reports', auth, requireRoles(['admin']), (req, res) => {
  res.json({
    quotesCreated: db.quotations.length,
    avgApprovalTime: '1.8 days',
    topUpsellProduct: '24/7 Support Retainer',
    filters: req.query,
  })
})

app.get('/api/products', auth, (_req, res) => {
  res.json({
    items: db.products,
    stats: {
      totalProducts: db.products.length,
      pricelists: db.pricelists.length,
      variants: db.products.reduce((n, p) => n + p.variants.length, 0),
    },
  })
})

app.post('/api/products', auth, requireRoles(['admin']), (req, res) => {
  const product = {
    id: nextId('p', db.products),
    name: String(req.body?.name || 'Untitled product'),
    category: req.body?.category === 'Services' ? 'Services' : 'Hardware',
    price: Number(req.body?.price) || 0,
    unit: String(req.body?.unit || 'unit'),
    taxPercent: Number(req.body?.taxPercent) || 0,
    status: 'active',
    description: String(req.body?.description || ''),
    isSubscription: Boolean(req.body?.isSubscription),
    cycle: req.body?.isSubscription ? req.body?.cycle || 'annual' : null,
    quantity: req.body?.isSubscription ? Number(req.body?.quantity) || 1 : null,
    variants: Array.isArray(req.body?.variants) ? req.body.variants : [],
  }
  db.products.push(product)
  res.status(201).json(product)
})

app.get('/api/products/:id', auth, (req, res) => {
  const product = db.products.find((p) => p.id === req.params.id)
  if (!product) return res.status(404).json({ error: 'Product not found' })
  res.json({ product, pricelists: db.pricelists })
})

app.patch('/api/products/:id', auth, requireRoles(['admin']), (req, res) => {
  const product = db.products.find((p) => p.id === req.params.id)
  if (!product) return res.status(404).json({ error: 'Product not found' })
  const fields = ['name', 'category', 'price', 'unit', 'taxPercent', 'status', 'description', 'isSubscription', 'cycle', 'quantity', 'variants']
  for (const key of fields) {
    if (req.body?.[key] !== undefined) product[key] = req.body[key]
  }
  if (!product.isSubscription) {
    product.cycle = null
    product.quantity = null
  }
  res.json({ product, pricelists: db.pricelists })
})

app.get('/api/discount-config', auth, (_req, res) => {
  res.json(db.discountConfig)
})

app.post('/api/discount-config', auth, requireRoles(['admin']), (req, res) => {
  if (req.body?.tierDiscounts) db.discountConfig.tierDiscounts = req.body.tierDiscounts
  if (req.body?.categoryCeilings) db.discountConfig.categoryCeilings = req.body.categoryCeilings
  if (req.body?.approvalChain) db.discountConfig.approvalChain = req.body.approvalChain
  if (req.body?.thresholds) db.discountConfig.thresholds = req.body.thresholds
  for (const q of db.quotations) computeQuotationRisk(q)
  logActivity(`Discount configuration saved by ${req.user.name}`)
  res.json(db.discountConfig)
})

app.get('/api/portal/quotes', auth, requireRoles(['customer']), (req, res) => {
  const items = db.quotations
    .filter((q) => q.customerId === req.user.customerId && q.status !== 'draft')
    .map(listItem)
  res.json({ items })
})

app.get('/api/portal/quote/:id', auth, requireRoles(['customer']), (req, res) => {
  const quotation = db.quotations.find((q) => q.id === req.params.id)
  if (!quotation || quotation.customerId !== req.user.customerId) {
    return res.status(404).json({ error: 'Quotation not found' })
  }
  computeQuotationRisk(quotation)
  const safeLines = quotation.lines.map((l) => ({
    id: l.id,
    productName: l.productName,
    qty: l.qty,
    price: l.price,
    discountPercent: l.discountPercent,
    comment: l.comment || '',
    counterDiscount: l.counterDiscount ?? l.discountPercent,
    amount: l.qty * l.price * (1 - l.discountPercent / 100),
  }))
  res.json({
    id: quotation.id,
    number: quotation.number,
    customerName: quotation.customerName,
    amount: quotation.amount,
    status: quotation.status,
    portalStatus: quotation.portalStatus || (quotation.status === 'confirmed' ? 'confirmed' : 'sent'),
    requestedDeliveryDate: quotation.requestedDeliveryDate || '',
    currency: quotation.currency,
    terms: quotation.terms,
    lines: safeLines,
  })
})

app.post('/api/portal/quote/:id/negotiate', auth, requireRoles(['customer']), (req, res) => {
  const quotation = db.quotations.find((q) => q.id === req.params.id)
  if (!quotation || quotation.customerId !== req.user.customerId) {
    return res.status(404).json({ error: 'Quotation not found' })
  }
  const lines = Array.isArray(req.body?.lines) ? req.body.lines : []
  for (const incoming of lines) {
    const line = quotation.lines.find((l) => l.id === incoming.id)
    if (!line) continue
    if (incoming.comment !== undefined) line.comment = String(incoming.comment)
    if (incoming.counterDiscount !== undefined) {
      line.counterDiscount = Number(incoming.counterDiscount)
      line.discountPercent = Number(incoming.counterDiscount)
    }
  }
  if (req.body?.requestedDeliveryDate) {
    quotation.requestedDeliveryDate = String(req.body.requestedDeliveryDate)
  }
  quotation.status = 'negotiation'
  quotation.portalStatus = 'under_negotiation'
  computeQuotationRisk(quotation)
  let approval = db.approvals.find((a) => a.quotationId === quotation.id)
  if (!approval) {
    approval = {
      id: nextId('a', db.approvals),
      quotationId: quotation.id,
      status: 'pending',
      stage: 'sales_manager',
      assignedTo: 'Jordan Chen',
      assignedRole: 'manager',
      daysPending: 0,
      auditLog: [],
    }
    db.approvals.unshift(approval)
  }
  approval.status = 'pending'
  if (quotation.riskLevel !== 'LOW') {
    approval.stage = quotation.riskLevel === 'HIGH' ? 'sales_manager' : 'sales_manager'
    approval.assignedTo = 'Jordan Chen'
  }
  appendAudit(
    approval,
    req.user,
    'Negotiation',
    req.body?.note ||
      `Customer requested revised terms. Delivery ${quotation.requestedDeliveryDate || 'unchanged'}.`,
  )
  db.portalMessages.push({
    id: nextId('m', db.portalMessages),
    customerId: req.user.customerId,
    quotationId: quotation.id,
    from: req.user.name,
    body: req.body?.note || 'Submitted a negotiation request from the portal.',
    date: new Date().toISOString(),
  })
  logActivity(`${req.user.name} submitted a negotiation on ${quotation.number}`)
  emitOrder(quotation.id)
  res.json({ ok: true, quotationId: quotation.id, approvalId: approval.id })
})

app.post('/api/portal/quote/:id/confirm', auth, requireRoles(['customer']), (req, res) => {
  const quotation = db.quotations.find((q) => q.id === req.params.id)
  if (!quotation || quotation.customerId !== req.user.customerId) {
    return res.status(404).json({ error: 'Quotation not found' })
  }
  computeQuotationRisk(quotation)
  const level = requiredApprovalLevel(quotation)
  if (level !== 'none') {
    quotation.status = 'pending_approval'
    quotation.portalStatus = 'sent'
    let approval = db.approvals.find((a) => a.quotationId === quotation.id)
    if (!approval) {
      approval = {
        id: nextId('a', db.approvals),
        quotationId: quotation.id,
        status: 'pending',
        stage: 'sales_manager',
        assignedTo: 'Jordan Chen',
        assignedRole: 'manager',
        daysPending: 0,
        auditLog: [],
      }
      db.approvals.unshift(approval)
    }
    approval.status = 'pending'
    approval.stage = 'sales_manager'
    appendAudit(approval, req.user, 'Confirm attempted', 'Terms exceed thresholds — quote re-entered approval.')
    logActivity(`${quotation.number} re-entered approval after customer confirm (over threshold)`)
    emitOrder(quotation.id)
    return res.json({ ok: true, reenteredApproval: true, approvalId: approval.id })
  }
  quotation.status = 'confirmed'
  quotation.portalStatus = 'confirmed'
  createFulfillmentFromQuote(quotation)
  const approval = db.approvals.find((a) => a.quotationId === quotation.id)
  if (approval) {
    approval.status = 'approved'
    approval.stage = 'confirmed'
    appendAudit(approval, req.user, 'Confirmed', 'Customer confirmed quotation from portal.')
  }
  logActivity(`${req.user.name} confirmed quotation ${quotation.number}`)
  emitOrder(quotation.id)
  res.json({ ok: true, reenteredApproval: false })
})

app.get('/api/portal/messages', auth, requireRoles(['customer']), (req, res) => {
  const items = db.portalMessages.filter((m) => m.customerId === req.user.customerId)
  res.json({ items })
})

app.get('/api/portal/profile', auth, requireRoles(['customer']), (req, res) => {
  const customer = db.customers.find((c) => c.id === req.user.customerId)
  res.json({ user: req.user, customer })
})

app.use((err, _req, res, _next) => {
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON' })
  }
  console.error(err)
  res.status(500).json({ error: 'Internal server error' })
})

httpServer.listen(PORT, () => {
  console.log(`DealFlow360 API on http://localhost:${PORT}`)
})

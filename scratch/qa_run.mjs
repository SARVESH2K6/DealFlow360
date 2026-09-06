import jwt from 'jsonwebtoken'

const BASE = 'http://localhost:3001'
const SECRET = 'df360-dev-secret'

async function req(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = { raw: text }
  }
  return { status: res.status, json }
}

async function login(email) {
  const r = await req('/api/auth/login', { method: 'POST', body: { email, password: 'password' } })
  if (r.status !== 200) throw new Error(`login ${email} ${r.status} ${JSON.stringify(r.json)}`)
  return r.json.token
}

function banner(title) {
  console.log('\n=== ' + title + ' ===')
}

const findings = []
function found(sev, title, extra) {
  findings.push({ sev, title, extra })
  console.log(`[${sev}] ${title}`)
  if (extra) console.log('   ', extra)
}

async function main() {
  const rep = await login('ivan.p@example.net')
  const mgr = await login('olivia.t@example.org')
  const fin = await login('quinn.m@example.net')
  const adm = await login('beth.t@example.com')
  const cust = await login('marco.r@example.org')

  banner('AUTH')
  const bad = await req('/api/auth/login', { method: 'POST', body: { email: 'ivan.p@example.net', password: 'wrong' } })
  console.log('bad password', bad.status, bad.json)
  const noAuth = await req('/api/quotations')
  console.log('no token quotes', noAuth.status)

  const forged = jwt.sign({ id: 'u-adm', email: 'beth.t@example.com', name: 'Riley Nash', role: 'admin', customerId: null }, SECRET)
  const forgedMe = await req('/api/me', { token: forged })
  console.log('forged admin /me', forgedMe.status, forgedMe.json)

  banner('ROLE LEAKS as customer')
  for (const p of [
    '/api/approvals',
    '/api/customers',
    '/api/invoices',
    '/api/deal-health',
    '/api/discount-config',
    '/api/quotations',
    '/api/fulfillment',
    '/api/subscriptions',
    '/api/products',
    '/api/reports',
  ]) {
    const r = await req(p, { token: cust })
    console.log(p, r.status, r.json?.error || (Array.isArray(r.json?.items) ? `items=${r.json.items.length}` : Object.keys(r.json || {})))
    if (r.status === 200 && p !== '/api/quotations' && p !== '/api/products') {
      found('CRITICAL', `Customer JWT can GET ${p}`, `status ${r.status}`)
    }
  }

  banner('REP APPROVE')
  const alist = await req('/api/approvals', { token: mgr })
  const pending = (alist.json.items || []).find((a) => a.status === 'pending')
  console.log('pending sample', pending?.id, pending?.quotationNumber, pending?.status)
  if (pending) {
    const repApprove = await req(`/api/approvals/${pending.id}/approve`, { method: 'POST', token: rep, body: { note: 'qa-rep' } })
    console.log('rep approve', repApprove.status, repApprove.json)
    if (repApprove.status === 200) found('CRITICAL', 'Rep can approve via API', pending.id)
    else if (repApprove.status === 403) console.log('PASS rep blocked')
  }

  banner('CUSTOMER APPROVE')
  if (pending) {
    const c = await req(`/api/approvals/${pending.id}/approve`, { method: 'POST', token: cust, body: { note: 'qa-cust' } })
    console.log('cust approve', c.status, c.json)
    if (c.status === 200) found('CRITICAL', 'Customer can approve via API', pending.id)
  }

  banner('CREATE QUOTE + RISK BOUNDARIES')
  const created = await req('/api/quotations', { method: 'POST', token: rep, body: {} })
  console.log('create', created.status, created.json?.id, created.json?.number, created.json?.customerName, created.json?.customerTier)
  const qid = created.json.id
  const products = await req('/api/products', { token: rep })
  const hardware = (products.json.items || []).find((p) => p.category === 'Hardware') || products.json.items?.[0]
  const services = (products.json.items || []).find((p) => p.category === 'Services')
  console.log('products', hardware?.id, hardware?.name, hardware?.price, services?.id)

  const add = await req(`/api/quotations/${qid}/lines`, { method: 'POST', token: rep, body: { productId: hardware.id, qty: 1 } })
  const lineId = add.json.lines[0].id
  console.log('line', lineId, 'limit', add.json.lines[0].limit, 'status', add.json.lines[0].status)

  const limit = add.json.lines[0].limit

  async function setDisc(d) {
    const r = await req(`/api/quotations/${qid}/lines/${lineId}`, { method: 'PATCH', token: rep, body: { discountPercent: d } })
    const l = r.json.lines[0]
    return { status: r.status, discount: l.discountPercent, limit: l.limit, lineStatus: l.status, riskScore: r.json.riskScore, riskLevel: r.json.riskLevel, blended: r.json.blendedRisk, amount: r.json.amount, flags: r.json.flagReasons }
  }

  const atCeil = await setDisc(limit)
  console.log('exact ceiling', atCeil)
  const plus001 = await setDisc(Number((limit + 0.01).toFixed(4)))
  console.log('+0.01', plus001)
  const below = await setDisc(Math.max(0, limit - 5))
  console.log('below', below)
  const neg = await setDisc(-5)
  console.log('negative', neg)
  const nan = await req(`/api/quotations/${qid}/lines/${lineId}`, { method: 'PATCH', token: rep, body: { discountPercent: 'abc' } })
  console.log('non-numeric', nan.status, nan.json.lines?.[0]?.discountPercent, nan.json.riskScore, nan.json.error)
  const over100 = await setDisc(100)
  console.log('100%', over100)
  const over200 = await setDisc(200)
  console.log('200%', over200)

  banner('EMPTY SUBMIT')
  const emptyQ = await req('/api/quotations', { method: 'POST', token: rep, body: {} })
  const emptySubmit = await req(`/api/quotations/${emptyQ.json.id}/submit`, { method: 'POST', token: rep })
  console.log('empty submit', emptySubmit.status, emptySubmit.json)

  banner('SUBMIT AT CEILING')
  await setDisc(limit)
  const subCeil = await req(`/api/quotations/${qid}/submit`, { method: 'POST', token: rep })
  console.log('submit at ceiling', subCeil.status, {
    approvalRequired: subCeil.json.approvalRequired,
    riskLevel: subCeil.json.riskLevel,
    riskScore: subCeil.json.riskScore,
    qStatus: subCeil.json.quotation?.status,
    approvalId: subCeil.json.approvalId,
  })

  banner('EDIT AFTER SUBMIT')
  const editPending = await req(`/api/quotations/${qid}/lines/${lineId}`, { method: 'PATCH', token: rep, body: { discountPercent: limit + 20 } })
  console.log('edit pending', editPending.status, editPending.json.riskLevel, editPending.json.riskScore, editPending.json.status)

  banner('TWO-LINE WEIGHT')
  const q2 = await req('/api/quotations', { method: 'POST', token: rep, body: {} })
  await req(`/api/quotations/${q2.json.id}/lines`, { method: 'POST', token: rep, body: { productId: hardware.id, qty: 1 } })
  if (services) await req(`/api/quotations/${q2.json.id}/lines`, { method: 'POST', token: rep, body: { productId: services.id, qty: 1 } })
  const q2d = await req(`/api/quotations/${q2.json.id}`, { token: rep })
  console.log('two lines', q2d.json.lines.map((l) => ({ name: l.productName, price: l.price, limit: l.limit, cat: l.category })))
  if (q2d.json.lines.length >= 2) {
    const tiny = q2d.json.lines.reduce((a, b) => (a.price <= b.price ? a : b))
    const big = q2d.json.lines.reduce((a, b) => (a.price >= b.price ? a : b))
    await req(`/api/quotations/${q2.json.id}/lines/${tiny.id}`, { method: 'PATCH', token: rep, body: { discountPercent: tiny.limit + 40 } })
    await req(`/api/quotations/${q2.json.id}/lines/${big.id}`, { method: 'PATCH', token: rep, body: { discountPercent: big.limit } })
    const after = await req(`/api/quotations/${q2.json.id}`, { token: rep })
    console.log('weighted', {
      riskScore: after.json.riskScore,
      blended: after.json.blendedRisk,
      level: after.json.riskLevel,
      flags: after.json.flagReasons,
      lines: after.json.lines.map((l) => ({ n: l.productName, d: l.discountPercent, lim: l.limit, st: l.status, p: l.price })),
    })
  }

  banner('ZERO PRICE LINE')
  const q0 = await req('/api/quotations', { method: 'POST', token: rep, body: {} })
  const add0 = await req(`/api/quotations/${q0.json.id}/lines`, { method: 'POST', token: rep, body: { productId: hardware.id, qty: 1 } })
  const l0 = add0.json.lines[0].id
  // cannot set price via API easily - check patch
  const pricePatch = await req(`/api/quotations/${q0.json.id}/lines/${l0}`, { method: 'PATCH', token: rep, body: { price: 0, discountPercent: 50 } })
  console.log('price patch accepted?', pricePatch.json.lines?.[0]?.price, pricePatch.json.riskScore, pricePatch.json.riskLevel)

  banner('MANY SMALL OVERS')
  const qm = await req('/api/quotations', { method: 'POST', token: rep, body: {} })
  const ids = (products.json.items || []).slice(0, 3)
  for (const p of ids) {
    await req(`/api/quotations/${qm.json.id}/lines`, { method: 'POST', token: rep, body: { productId: p.id, qty: 1 } })
  }
  const qmd = await req(`/api/quotations/${qm.json.id}`, { token: rep })
  for (const l of qmd.json.lines) {
    await req(`/api/quotations/${qm.json.id}/lines/${l.id}`, { method: 'PATCH', token: rep, body: { discountPercent: l.limit + 2.5 } })
  }
  const qma = await req(`/api/quotations/${qm.json.id}`, { token: rep })
  console.log('many small', qma.json.riskScore, qma.json.riskLevel, qma.json.blendedRisk, qma.json.flagReasons)

  banner('DOUBLE APPROVE')
  if (pending) {
    const first = await req(`/api/approvals/${pending.id}/approve`, { method: 'POST', token: mgr, body: { note: 'qa-first' } })
    const second = await req(`/api/approvals/${pending.id}/approve`, { method: 'POST', token: mgr, body: { note: 'qa-second' } })
    console.log('first approve', first.status, first.json.status, first.json.stage, first.json.error)
    console.log('second approve', second.status, second.json.status, second.json.stage, second.json.error, 'audit', second.json.auditLog?.length)
  }

  banner('PORTAL NEGOTIATE CONFIRMED')
  const pquotes = await req('/api/portal/quotes', { token: cust })
  console.log('portal quotes', pquotes.status, (pquotes.json.items || []).map((x) => `${x.number}:${x.status}`).slice(0, 8))
  const conf = (pquotes.json.items || []).find((x) => x.status === 'confirmed') || pquotes.json.items?.[0]
  if (conf) {
    const pq = await req(`/api/portal/quote/${conf.id}`, { token: cust })
    console.log('portal quote', conf.number, pq.json.portalStatus, pq.json.status)
    const neg = await req(`/api/portal/quote/${conf.id}/negotiate`, {
      method: 'POST',
      token: cust,
      body: { lines: (pq.json.lines || []).map((l) => ({ id: l.id, counterDiscount: 50 })), note: 'qa-neg' },
    })
    console.log('negotiate', neg.status, neg.json)
  }

  banner('FULFILLMENT OVERRIDE')
  const flist = await req('/api/fulfillment', { token: fin })
  console.log('fulfillment orders', flist.status, flist.json.orders?.slice?.(0, 3) || Object.keys(flist.json || {}))
  const oid = flist.json.orders?.[0]?.id
  if (oid) {
    const ov = await req(`/api/fulfillment/${oid}/override`, {
      method: 'POST',
      token: fin,
      body: { status: 'ready', lines: [{ productId: 'p-x', productName: 'Ghost', qty: 999, suggested: [{ warehouse: 'X', qtyFulfilled: 999, estShipments: 1, cost: 0, available: 0 }] }] },
    })
    console.log('override 999', ov.status, ov.json.lines)
    const cons = await req(`/api/fulfillment/${oid}/consolidate`, { method: 'POST', token: fin })
    console.log('consolidate', cons.status, cons.json)
  }
  const ovRep = oid
    ? await req(`/api/fulfillment/${oid}/override`, { method: 'POST', token: rep, body: { status: 'ready' } })
    : { status: 'skip' }
  console.log('rep override', ovRep.status, ovRep.json)

  banner('SUB CANCEL AS CUSTOMER')
  const subs = await req('/api/subscriptions', { token: cust })
  console.log('cust subs', subs.status, subs.json.items?.length || subs.json?.length || subs.json)
  const subId = (subs.json.items || subs.json)?.[0]?.id
  if (subId) {
    const cancel = await req(`/api/subscriptions/${subId}/cancel`, { method: 'POST', token: cust })
    console.log('cust cancel sub', cancel.status, cancel.json)
  }

  banner('DEAL HEALTH ESCALATE')
  const dh = await req('/api/deal-health', { token: cust })
  console.log('cust deal-health', dh.status)
  const dhi = await req('/api/deal-health', { token: mgr })
  const hid = dhi.json.items?.[0]?.id
  if (hid) {
    const esc = await req(`/api/deal-health/${hid}/escalate`, { method: 'POST', token: cust })
    console.log('cust escalate', esc.status, esc.json)
  }

  banner('SQL SEARCH')
  // search is client-side; API has no search. Skip.

  banner('HEALTH')
  console.log(await req('/api/health'))

  console.log('\nFINDINGS DUMP', JSON.stringify(findings, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

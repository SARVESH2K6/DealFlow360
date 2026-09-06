/**
 * Live QA: backend (HTTP) + frontend (Playwright Chromium).
 * Writes scratch/qa_full_results.json
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import jwt from 'jsonwebtoken'
import { chromium } from 'playwright'

const __dirname = dirname(fileURLToPath(import.meta.url))
const API = 'http://localhost:3001'
const UI = process.env.QA_UI || 'http://localhost:5173'
const SECRET = 'df360-dev-secret'
const SHOTS = join(__dirname, 'qa-shots')
mkdirSync(SHOTS, { recursive: true })

const findings = []
const notes = []

function finding(f) {
  findings.push(f)
  console.log(`[${f.sev}] ${f.title}`)
}

function pass(title, extra = '') {
  notes.push({ kind: 'pass', title, extra })
  console.log(`[PASS] ${title}${extra ? ' — ' + extra : ''}`)
}

async function req(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = { raw: text.slice(0, 400) }
  }
  return { status: res.status, json }
}

async function loginApi(email, password = 'password') {
  const r = await req('/api/auth/login', { method: 'POST', body: { email, password } })
  if (r.status !== 200) throw new Error(`login ${email} ${r.status} ${JSON.stringify(r.json)}`)
  return r.json.token
}

async function shot(page, name) {
  await page.screenshot({ path: join(SHOTS, `${name}.png`), fullPage: true })
}

async function uiLogin(page, email, password = 'password') {
  await page.goto(`${UI}/login`, { waitUntil: 'networkidle' })
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill(password)
  await page.locator('form button[type="submit"]').click()
  await page.waitForURL(/\/(app|portal)/, { timeout: 15000 })
}

async function navText(page) {
  return (await page.locator('header nav').innerText()).replace(/\s+/g, ' ')
}

async function runBackend() {
  console.log('\n======== BACKEND ========')
  const rep = await loginApi('ivan.p@example.net')
  const mgr = await loginApi('olivia.t@example.org')
  const fin = await loginApi('quinn.m@example.net')
  const adm = await loginApi('beth.t@example.com')
  const cust = await loginApi('marco.r@example.org')

  const bad = await req('/api/auth/login', { method: 'POST', body: { email: 'ivan.p@example.net', password: 'wrong' } })
  if (bad.status === 401) pass('Wrong password rejected', String(bad.status))
  else finding({
    sev: 'HIGH', module: 'Authentication & Roles', title: 'Wrong password not rejected',
    steps: ['POST /api/auth/login with ivan.p@example.net / wrong'],
    expected: '401', actual: `${bad.status} ${JSON.stringify(bad.json)}`,
    screen: '/api/auth/login', cause: 'users.findByCredentials plaintext compare',
  })

  const noTok = await req('/api/quotations')
  if (noTok.status === 401) pass('Unauthenticated quotations blocked')
  else finding({
    sev: 'CRITICAL', module: 'Authentication & Roles', title: 'Quotations list reachable without token',
    steps: ['GET /api/quotations with no Authorization'],
    expected: '401', actual: String(noTok.status),
    screen: '/api/quotations', cause: 'missing auth middleware',
  })

  const forged = jwt.sign(
    { id: 'u-adm', email: 'beth.t@example.com', name: 'Riley Nash', role: 'admin', customerId: null },
    SECRET,
  )
  const forgedMe = await req('/api/me', { token: forged })
  if (forgedMe.status === 200) {
    finding({
      sev: 'CRITICAL', module: 'Authentication & Roles',
      title: 'Hardcoded JWT secret impersonates admin',
      steps: [
        "jwt.sign({id:'u-adm',...}, 'df360-dev-secret')",
        'GET /api/me with that Bearer token',
      ],
      expected: '401 unless JWT_SECRET is private',
      actual: `200 ${forgedMe.json?.user?.email || forgedMe.json?.email || JSON.stringify(forgedMe.json)}`,
      screen: '/api/me',
      cause: "JWT_SECRET = process.env.JWT_SECRET || 'df360-dev-secret'",
    })
  } else pass('Forged JWT rejected', String(forgedMe.status))

  const leakPaths = [
    '/api/approvals', '/api/customers', '/api/invoices', '/api/deal-health',
    '/api/discount-config', '/api/fulfillment', '/api/subscriptions', '/api/reports',
  ]
  const leaked = []
  for (const p of leakPaths) {
    const r = await req(p, { token: cust })
    if (r.status === 200) leaked.push(`${p} (${Array.isArray(r.json?.items) ? r.json.items.length + ' items' : '200'})`)
  }
  if (leaked.length) {
    finding({
      sev: 'CRITICAL', module: 'Authentication & Roles',
      title: 'Customer JWT can read internal operations endpoints',
      steps: ['Login as marco.r@example.org', `GET ${leaked.join(', ')}`],
      expected: '403 on internal GETs',
      actual: leaked.join('; '),
      screen: leaked.join(', '),
      cause: 'index.pg.js GET routes use auth only, no requireRoles',
    })
  } else pass('Customer blocked from internal GETs')

  const cancel = await req('/api/subscriptions/s-2/cancel', { method: 'POST', token: cust, body: {} })
  if (cancel.status === 200) {
    finding({
      sev: 'CRITICAL', module: 'Subscriptions list & billing detail',
      title: 'Customer can cancel a subscription via API',
      steps: ['Login as customer', 'POST /api/subscriptions/s-2/cancel'],
      expected: '403', actual: `200 ${JSON.stringify(cancel.json?.status || cancel.json)}`,
      screen: '/api/subscriptions/:id/cancel', cause: 'auth only, no requireRoles',
    })
  } else pass('Customer cannot cancel subscription', String(cancel.status))

  const dh = await req('/api/deal-health', { token: mgr })
  const dhId = dh.json?.items?.[0]?.id
  if (dhId) {
    const esc = await req(`/api/deal-health/${dhId}/escalate`, { method: 'POST', token: cust, body: {} })
    if (esc.status === 200) {
      finding({
        sev: 'CRITICAL', module: 'Deal Health & Anomaly Dashboard',
        title: 'Customer can escalate deal-health items',
        steps: ['Login as customer', `POST /api/deal-health/${dhId}/escalate`],
        expected: '403', actual: `200`,
        screen: '/api/deal-health/:id/escalate', cause: 'auth only',
      })
    } else pass('Customer cannot escalate deal-health', String(esc.status))
  }

  const cfg = await req('/api/discount-config', { token: adm })
  const hwCeil = cfg.json?.categoryCeilings?.find((c) => c.category === 'Hardware')?.maxDiscount
  const gold = cfg.json?.tierDiscounts?.find((t) => t.tier === 'Gold')?.maxDiscount
  const ceiling = Math.min(Number(hwCeil ?? 15), Number(gold ?? 18))
  notes.push({ kind: 'info', title: `Configured Hardware∩Gold ceiling`, extra: String(ceiling) })

  const created = await req('/api/quotations', { method: 'POST', token: rep, body: { customerId: 'c-acme' } })
  const qid = created.json?.id
  if (!qid) throw new Error('could not create quote ' + JSON.stringify(created))
  const withLine = await req(`/api/quotations/${qid}/lines`, {
    method: 'POST', token: rep, body: { productId: 'p-sensor', qty: 1 },
  })
  const lineId = withLine.json?.lines?.[0]?.id
  if (!lineId) throw new Error('no line ' + JSON.stringify(withLine.json))

  async function setDisc(pct) {
    return req(`/api/quotations/${qid}/lines/${lineId}`, {
      method: 'PATCH', token: rep, body: { discountPercent: pct },
    })
  }

  const atCeil = await setDisc(ceiling)
  const at = atCeil.json
  const expectedAt = 0
  if (at?.riskScore !== 0 || at?.riskLevel !== 'LOW') {
    finding({
      sev: 'HIGH', module: 'Blended Discount Risk Score',
      title: `Discount exactly at ceiling (${ceiling}%) is not riskScore 0 / no-approval as specified`,
      steps: [`Create Acme quote, Hardware line, PATCH discountPercent=${ceiling}`],
      expected: 'violation 0, riskScore 0, LOW, line within',
      actual: `score=${at?.riskScore} level=${at?.riskLevel} lineStatus=${at?.lines?.[0]?.status} blended=${at?.blendedRisk}`,
      screen: `PATCH /api/quotations/${qid}/lines/${lineId}`,
      cause: 'lineStatus near if discount >= limit-2; score uses blended*8 + overCount*18',
    })
  } else pass('Exact ceiling → score 0 LOW')

  const justOver = await setDisc(Number((ceiling + 0.01).toFixed(2)))
  const jo = justOver.json
  notes.push({
    kind: 'info',
    title: '15.01-style just-over',
    extra: `score=${jo?.riskScore} level=${jo?.riskLevel} blended=${jo?.blendedRisk} status=${jo?.lines?.[0]?.status} flags=${JSON.stringify(jo?.flagReasons)}`,
  })
  if (jo?.blendedRisk === 0 && (jo?.flagReasons?.length ?? 1) === 0 && jo?.riskLevel === 'MEDIUM') {
    finding({
      sev: 'HIGH', module: 'Blended Discount Risk Score',
      title: '0.01 over ceiling rounds blended/flags to 0 but still MEDIUM',
      steps: [`PATCH discountPercent=${ceiling + 0.01}`],
      expected: 'positive violation, flags present, manager if that is the configured rule',
      actual: `score=${jo?.riskScore} level=${jo?.riskLevel} blended=${jo?.blendedRisk} flags=${JSON.stringify(jo?.flagReasons)} line=${jo?.lines?.[0]?.status}`,
      screen: `PATCH /api/quotations/${qid}/lines/${lineId}`,
      cause: 'overBy rounded to 1 decimal → 0; overCount still 1 because status is over',
    })
  }

  const below = await setDisc(5)
  if (below.json?.riskScore !== 0 || Number(below.json?.blendedRisk) < 0) {
    finding({
      sev: 'HIGH', module: 'Blended Discount Risk Score',
      title: 'Discount below ceiling did not resolve to 0 / non-negative',
      steps: ['PATCH discountPercent=5 with ceiling 15'],
      expected: 'violation 0, no negative offset',
      actual: `score=${below.json?.riskScore} blended=${below.json?.blendedRisk}`,
      screen: `PATCH /api/quotations/${qid}/lines/${lineId}`,
      cause: 'computeRisk',
    })
  } else pass('Below-ceiling discount → 0, not negative')

  const neg = await setDisc(-5)
  if (neg.status === 200 && Number(neg.json?.lines?.[0]?.discountPercent) === 0) {
    finding({
      sev: 'MEDIUM', module: 'Quotation Builder',
      title: 'Negative discount is clamped to 0 instead of rejected',
      steps: ['PATCH discountPercent: -5'],
      expected: '400 validation error on both UI and API',
      actual: `200 stored ${neg.json?.lines?.[0]?.discountPercent}`,
      screen: `PATCH /api/quotations/${qid}/lines/${lineId}`,
      cause: 'Math.max(0, Math.min(80, Number(body.discountPercent)))',
    })
  } else if (neg.status >= 400) pass('Negative discount rejected', String(neg.status))

  const abc = await setDisc('abc')
  if (abc.status === 200) {
    finding({
      sev: 'HIGH', module: 'Quotation Builder',
      title: 'Non-numeric discount via API is not rejected',
      steps: ['PATCH discountPercent: "abc" bypassing the number input'],
      expected: '400 clean validation error',
      actual: `200 discount=${abc.json?.lines?.[0]?.discountPercent}`,
      screen: `PATCH /api/quotations/${qid}/lines/${lineId}`,
      cause: 'Number("abc") is NaN then persisted/coerced',
    })
  } else pass('Non-numeric discount rejected', String(abc.status))

  const hun = await setDisc(100)
  if (hun.status === 200 && Number(hun.json?.lines?.[0]?.discountPercent) === 80) {
    finding({
      sev: 'MEDIUM', module: 'Quotation Builder',
      title: '100% discount silently clamped to 80% with no error',
      steps: ['PATCH discountPercent: 100'],
      expected: '400 or an explicit cap with a message',
      actual: `200 stored ${hun.json?.lines?.[0]?.discountPercent}, amount=${hun.json?.amount}`,
      screen: `PATCH /api/quotations/${qid}/lines/${lineId}`,
      cause: 'clamp 0..80 in patchLine',
    })
  }

  await setDisc(5)
  const emptySubmit = await req('/api/quotations/' + (await req('/api/quotations', { method: 'POST', token: rep, body: { customerId: 'c-acme' } })).json.id + '/submit', {
    method: 'POST', token: rep, body: {},
  })
  if (emptySubmit.status === 400) pass('Empty quotation submit rejected')
  else finding({
    sev: 'HIGH', module: 'Quotation Builder', title: 'Empty quotation can be submitted',
    steps: ['POST quote', 'POST submit with 0 lines'],
    expected: '400', actual: String(emptySubmit.status),
    screen: '/api/quotations/:id/submit', cause: 'missing empty check',
  })

  const q2 = await req('/api/quotations', { method: 'POST', token: rep, body: { customerId: 'c-acme' } })
  await req(`/api/quotations/${q2.json.id}/lines`, { method: 'POST', token: rep, body: { productId: 'p-sensor', qty: 1 } })
  const l2 = (await req(`/api/quotations/${q2.json.id}`, { token: rep })).json.lines[0].id
  await req(`/api/quotations/${q2.json.id}/lines/${l2}`, { method: 'PATCH', token: rep, body: { discountPercent: 40 } })
  const submitted = await req(`/api/quotations/${q2.json.id}/submit`, { method: 'POST', token: rep, body: {} })
  const approvalId = submitted.json?.approvalId
  notes.push({
    kind: 'info',
    title: 'Submit 40% hardware',
    extra: `approvalRequired=${submitted.json?.approvalRequired} level=${submitted.json?.riskLevel} score=${submitted.json?.riskScore} status=${submitted.json?.quotation?.status} approvalId=${approvalId}`,
  })

  const afterSubmitPatch = await req(`/api/quotations/${q2.json.id}/lines/${l2}`, {
    method: 'PATCH', token: rep, body: { discountPercent: 10 },
  })
  if (afterSubmitPatch.status === 200) {
    finding({
      sev: 'CRITICAL', module: 'Quotation Builder',
      title: 'Line discount still writable after submit / pending approval',
      steps: [
        'Submit a quote that requires approval',
        `PATCH /api/quotations/${q2.json.id}/lines/${l2} {discountPercent:10}`,
      ],
      expected: '409/403 lock',
      actual: `200 status=${afterSubmitPatch.json?.status} discount=${afterSubmitPatch.json?.lines?.[0]?.discountPercent} risk=${afterSubmitPatch.json?.riskLevel}`,
      screen: `PATCH /api/quotations/:id/lines/:lineId`,
      cause: 'patchLine has no lifecycle guard',
    })
  } else pass('Post-submit line patch blocked', String(afterSubmitPatch.status))

  if (approvalId) {
    const repApprove = await req(`/api/approvals/${approvalId}/approve`, { method: 'POST', token: rep, body: { note: 'rep bypass' } })
    if (repApprove.status === 403) pass('Rep approve rejected server-side', repApprove.json?.error || '403')
    else finding({
      sev: 'CRITICAL', module: 'Approval Routing & Approval Detail screen',
      title: 'Rep can call approve API',
      steps: [`POST /api/approvals/${approvalId}/approve as ivan.p@example.net`],
      expected: '403', actual: `${repApprove.status} ${JSON.stringify(repApprove.json)}`,
      screen: '/api/approvals/:id/approve', cause: 'missing requireRoles or canActOnStep too loose',
    })
  }

  const custPatch = await req(`/api/quotations/${q2.json.id}`, {
    method: 'PATCH', token: cust, body: { terms: 'HACKED' },
  })
  if (custPatch.status === 200) {
    finding({
      sev: 'CRITICAL', module: 'Authentication & Roles',
      title: 'Customer can PATCH an internal quotation',
      steps: [`As marco.r@example.org PATCH /api/quotations/${q2.json.id} {terms:'HACKED'}`],
      expected: '403', actual: `200 terms=${custPatch.json?.terms}`,
      screen: 'PATCH /api/quotations/:id', cause: 'patch route is auth only, no role or owner check',
    })
  } else pass('Customer cannot PATCH quotation', String(custPatch.status))

  const portalList = await req('/api/portal/quotes', { token: cust })
  const listed = (portalList.json?.items || []).some((i) => i.id === q2.json.id)
  if (!listed && submitted.json?.quotation?.status === 'pending_approval') {
    finding({
      sev: 'HIGH', module: 'Customer Portal Negotiation screen',
      title: 'Quotes pending approval are hidden from the customer portal list',
      steps: ['Submit over-limit quote as rep', 'GET /api/portal/quotes as Acme customer'],
      expected: 'Customer can see the sent quote (portal_status sent) to negotiate while manager reviews',
      actual: `quote ${q2.json.id} status=${submitted.json?.quotation?.status} not in portal list (n=${portalList.json?.items?.length})`,
      screen: 'GET /api/portal/quotes',
      cause: "listPortalQuotes filters status NOT IN ('draft','pending_approval') even though submit sets portal_status='sent'",
    })
  }

  const negotiatePending = await req(`/api/portal/quote/${q2.json.id}/negotiate`, {
    method: 'POST',
    token: cust,
    body: {
      lines: [{ id: l2, counterDiscount: 45, comment: 'qa' }],
      requestedDeliveryDate: '2026-12-01',
      note: 'QA negotiate on pending',
    },
  })
  notes.push({ kind: 'info', title: 'Negotiate while pending', extra: `${negotiatePending.status} ${JSON.stringify(negotiatePending.json)}` })
  if (negotiatePending.status === 200) {
    finding({
      sev: 'HIGH', module: 'Customer Portal Negotiation screen',
      title: 'Customer can negotiate a quote that is still pending internal approval',
      steps: [`POST /api/portal/quote/${q2.json.id}/negotiate while status was pending_approval`],
      expected: 'Blocked until sent/approved, or a defined concurrent-merge rule',
      actual: `200 ${JSON.stringify(negotiatePending.json)}`,
      screen: '/api/portal/quote/:id/negotiate',
      cause: 'negotiate() has no status lock',
    })
  }

  const cons = await req('/api/fulfillment/f-1044/consolidate', { method: 'POST', token: fin, body: {} })
  if (cons.status === 404) {
    finding({
      sev: 'HIGH', module: 'Warehouse Fulfillment & Split logic',
      title: 'Consolidate endpoint missing on Postgres server',
      steps: ['POST /api/fulfillment/f-1044/consolidate as finance'],
      expected: '200 or 409 with a domain error',
      actual: `404 ${JSON.stringify(cons.json)}`,
      screen: 'POST /api/fulfillment/:id/consolidate',
      cause: 'route exists in index.memory.js only',
    })
  }

  const fulfillList = await req('/api/fulfillment', { token: fin })
  const fid = fulfillList.json?.orders?.[0]?.id || fulfillList.json?.items?.[0]?.id
  if (fid) {
    const ov = await req(`/api/fulfillment/${fid}/override`, {
      method: 'POST', token: fin, body: { lines: [{ qty: 99999 }] },
    })
    if (ov.status >= 500) {
      finding({
        sev: 'HIGH', module: 'Warehouse Fulfillment & Split logic',
        title: 'Fulfillment override with mismatched qty returns 500',
        steps: [`POST /api/fulfillment/${fid}/override with qty 99999`],
        expected: '400 validation', actual: `${ov.status} ${JSON.stringify(ov.json)}`,
        screen: `/api/fulfillment/${fid}/override`, cause: 'unhandled throw in override',
      })
    }
    const repOv = await req(`/api/fulfillment/${fid}/override`, {
      method: 'POST', token: rep, body: {},
    })
    if (repOv.status === 403) pass('Rep fulfillment override blocked')
    else finding({
      sev: 'HIGH', module: 'Warehouse Fulfillment & Split logic',
      title: 'Rep can call fulfillment override',
      steps: [`POST /api/fulfillment/${fid}/override as rep`],
      expected: '403', actual: String(repOv.status),
      screen: '/api/fulfillment/:id/override', cause: 'requireRoles missing or too wide',
    })
  }

  const twoLine = await req('/api/quotations', { method: 'POST', token: rep, body: { customerId: 'c-acme' } })
  await req(`/api/quotations/${twoLine.json.id}/lines`, { method: 'POST', token: rep, body: { productId: 'p-sensor', qty: 1 } })
  await req(`/api/quotations/${twoLine.json.id}/lines`, { method: 'POST', token: rep, body: { productId: 'p-support', qty: 1 } })
  const tl = (await req(`/api/quotations/${twoLine.json.id}`, { token: rep })).json
  const hw = tl.lines.find((l) => l.category === 'Hardware') || tl.lines[0]
  const sv = tl.lines.find((l) => l.id !== hw.id)
  await req(`/api/quotations/${twoLine.json.id}/lines/${hw.id}`, { method: 'PATCH', token: rep, body: { discountPercent: 55, qty: 1 } })
  if (sv) await req(`/api/quotations/${twoLine.json.id}/lines/${sv.id}`, { method: 'PATCH', token: rep, body: { discountPercent: ceiling } })
  const blended = (await req(`/api/quotations/${twoLine.json.id}`, { token: rep })).json
  const specViolation = Math.max(0, 55 - ceiling)
  const hwVal = hw.qty * hw.price
  const svVal = sv ? sv.qty * sv.price : 0
  const specScore = (specViolation * hwVal) / (hwVal + svVal)
  notes.push({
    kind: 'info',
    title: 'Two-line blended vs spec',
    extra: `spec≈${specScore.toFixed(2)} actual score=${blended.riskScore} blendedRisk=${blended.blendedRisk} level=${blended.riskLevel} lines=${JSON.stringify(blended.lines.map((l) => ({ n: l.productName, d: l.discountPercent, s: l.status })))}`,
  })
  if (Math.abs(blended.riskScore - specScore) > 5) {
    finding({
      sev: 'HIGH', module: 'Blended Discount Risk Score',
      title: 'Risk score is not the documented weighted-violation sum',
      steps: ['Two lines: Hardware 55% on small value, second line at ceiling'],
      expected: `riskScore ≈ sum(weight * max(0, d-ceiling)) ≈ ${specScore.toFixed(2)}`,
      actual: `score=${blended.riskScore} blendedRisk=${blended.blendedRisk} level=${blended.riskLevel}`,
      screen: `GET /api/quotations/${twoLine.json.id}`,
      cause: 'riskScore = min(100, round(blended*8 + overCount*18)); HIGH if any line >5pts over',
    })
  }

  const finSave = await req('/api/discount-config', { method: 'POST', token: fin, body: cfg.json })
  if (finSave.status === 403) pass('Finance cannot POST discount-config')
  else finding({
    sev: 'HIGH', module: 'Discount Tier & Approval Chain configuration screen',
    title: 'Finance can save discount config via API',
    steps: ['POST /api/discount-config as quinn.m@example.net'],
    expected: '403 (UI hides Save for finance)', actual: String(finSave.status),
    screen: 'POST /api/discount-config', cause: 'requireRoles([admin]) missing or includes finance',
  })

  return { qid, q2: q2.json.id, l2, approvalId, submitted: submitted.json, ceiling, blended }
}

async function runFrontend(apiCtx) {
  console.log('\n======== FRONTEND ========')
  const ceiling = apiCtx?.ceiling ?? 15
  apiCtx = { ceiling, ...apiCtx }
  const browser = await chromium.launch({ headless: true, channel: 'chrome' })
  const pageErrors = []

  async function newPage() {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
    const page = await context.newPage()
    page.on('pageerror', (err) => pageErrors.push(String(err)))
    return { context, page }
  }

  // --- Login validation ---
  {
    const { context, page } = await newPage()
    await page.goto(`${UI}/login`, { waitUntil: 'networkidle' })
    await page.locator('form button[type="submit"]').click()
    const stillLogin = page.url().includes('/login')
    const emailInvalid = await page.locator('input[type="email"]').evaluate((el) => !el.checkValidity())
    if (stillLogin && emailInvalid) pass('Empty login blocked by HTML required')
    else finding({
      sev: 'MEDIUM', module: 'Authentication & Roles',
      title: 'Empty login does not show validation',
      steps: ['Open /login', 'Click Log In with empty fields'],
      expected: 'Validation message, stay on /login',
      actual: `url=${page.url()} emailInvalid=${emailInvalid}`,
      screen: '/login', cause: 'missing client validation beyond HTML required',
    })

    await page.locator('input[type="email"]').fill('ivan.p@example.net')
    await page.locator('input[type="password"]').fill('wrong-password')
    await page.locator('form button[type="submit"]').click()
    await page.waitForTimeout(800)
    const err = await page.locator('p.text-danger').textContent().catch(() => null)
    await shot(page, 'login-wrong-password')
    if (err && page.url().includes('/login')) pass('Wrong password shows UI error', err.trim())
    else finding({
      sev: 'HIGH', module: 'Authentication & Roles',
      title: 'Wrong password does not surface a login error',
      steps: ['Login ivan.p@example.net / wrong-password'],
      expected: 'Inline error, stay on /login',
      actual: `url=${page.url()} error=${err}`,
      screen: '/login', cause: 'LoginPage catch ApiError',
    })

    await page.getByRole('button', { name: 'Forgot Password?' }).click()
    const notice = await page.locator('p.text-inkMuted').filter({ hasText: 'stub' }).count()
    if (notice > 0) {
      finding({
        sev: 'LOW', module: 'Authentication & Roles',
        title: 'Forgot Password is a stub with no reset flow',
        steps: ['Click Forgot Password?'],
        expected: 'Working reset or hide the control for the demo',
        actual: 'Notice: Forgot Password is a stub…',
        screen: '/login', cause: 'LoginPage setNotice stub',
      })
    }

    await page.getByRole('button', { name: 'Sign Up' }).click()
    await page.locator('input[type="email"]').fill(`qa-empty-name-${Date.now()}@example.com`)
    await page.locator('input[type="password"]').fill('password')
    await page.locator('form button[type="submit"]').click()
    await page.waitForTimeout(1500)
    const afterSignup = page.url()
    await shot(page, 'signup-empty-name')
    if (afterSignup.includes('/portal')) {
      finding({
        sev: 'MEDIUM', module: 'Authentication & Roles',
        title: 'Signup succeeds with an empty name',
        steps: ['Switch to Sign Up', 'Fill email+password only', 'Create account'],
        expected: 'Name required',
        actual: `Landed ${afterSignup}`,
        screen: '/login signup', cause: 'Name input has no required; createCustomerUser accepts empty name',
      })
    }
    await context.close()
  }

  // --- Rep role UI ---
  {
    const { context, page } = await newPage()
    await uiLogin(page, 'ivan.p@example.net')
    await shot(page, 'rep-dashboard')
    const nav = await navText(page)
    if (/\bApprovals\b/.test(nav) || /\bReports\b/.test(nav) || /\bProduct\b/.test(nav) || /\bConfig\b/.test(nav)) {
      finding({
        sev: 'HIGH', module: 'Authentication & Roles',
        title: 'Rep nav shows restricted tabs',
        steps: ['Login as ivan.p@example.net'],
        expected: 'No Approvals / Reports / Product / Config',
        actual: nav,
        screen: '/app/dashboard TopNav', cause: 'tabsForInternal',
      })
    } else pass('Rep nav hides Approvals/Reports/Product/Config', nav)

    await page.goto(`${UI}/app/approvals`, { waitUntil: 'networkidle' })
    if (page.url().includes('/app/dashboard')) pass('Rep /app/approvals redirected by RequireRole')
    else finding({
      sev: 'HIGH', module: 'Authentication & Roles',
      title: 'Rep can open the approvals list in the UI',
      steps: ['As rep, go to /app/approvals'],
      expected: 'Redirect to dashboard', actual: page.url(),
      screen: '/app/approvals', cause: 'RequireRole missing on list',
    })

    await page.goto(`${UI}/app/admin/discount-config`, { waitUntil: 'networkidle' })
    if (page.url().includes('/app/dashboard')) pass('Rep blocked from discount config page')
    else finding({
      sev: 'HIGH', module: 'Discount Tier & Approval Chain configuration screen',
      title: 'Rep can open discount config in the UI',
      steps: ['As rep, go to /app/admin/discount-config'],
      expected: 'Redirect', actual: page.url(),
      screen: '/app/admin/discount-config', cause: 'RequireRole',
    })

    await page.goto(`${UI}/app/quotations`, { waitUntil: 'networkidle' })
    await shot(page, 'rep-quotations')
    const filters = await page.locator('button, [class*="StatCard"]').allInnerTexts().catch(() => [])
    const joined = (await page.locator('main').innerText()).slice(0, 2500)
    if (!/Returned/i.test(joined) && !/Rejected/i.test(joined.split('Quotations')[1] || joined)) {
      finding({
        sev: 'MEDIUM', module: 'Quotation Builder',
        title: 'Quotations list has no Returned/Rejected filter chips',
        steps: ['Open /app/quotations as rep'],
        expected: 'Filter for returned and rejected (status exists in the model)',
        actual: 'Only Draft / Pending Approval / Approved / Negotiation / Confirmed',
        screen: '/app/quotations', cause: 'FILTERS in QuotationsListPage omits returned/rejected',
      })
    }

    await page.getByRole('button', { name: /New quotation/i }).click()
    await page.waitForURL(/\/app\/quotations\//, { timeout: 15000 })
    await page.waitForTimeout(600)
    const empty = await page.getByText('No line items').count()
    await shot(page, 'quote-empty-lines')
    if (empty > 0) pass('Empty line-item state renders')
    else finding({
      sev: 'MEDIUM', module: 'Quotation Builder',
      title: 'Zero line items does not show the empty state',
      steps: ['New quotation'],
      expected: 'EmptyState "No line items"', actual: 'Not found',
      screen: '/app/quotations/:id', cause: 'QuotationDetailPage empty branch',
    })
    const submitBtn = page.getByRole('button', { name: 'Submit Quote' })
    const submitDisabled = await submitBtn.isDisabled()
    if (submitDisabled) pass('Submit disabled with zero lines')
    else finding({
      sev: 'HIGH', module: 'Quotation Builder',
      title: 'Submit Quote is enabled with zero lines',
      steps: ['New quotation', 'Observe Submit Quote'],
      expected: 'disabled', actual: 'enabled',
      screen: '/app/quotations/:id', cause: 'disabled={data.lines.length === 0 || !editable}',
    })

    await page.locator('select').last().selectOption({ index: 1 }).catch(async () => {
      const opts = page.locator('select').last().locator('option')
      const n = await opts.count()
      if (n > 1) await page.locator('select').last().selectOption({ index: 1 })
    })
    await page.getByRole('button', { name: 'Add line' }).click()
    await page.waitForTimeout(800)
    const disc = page.locator('input[type="number"]').nth(1)
    await disc.waitFor({ timeout: 8000 })
    await disc.fill(String(apiCtx.ceiling))
    await page.waitForTimeout(700)
    const bodyAt = await page.locator('main').innerText()
    await shot(page, 'quote-at-ceiling')
    notes.push({ kind: 'info', title: 'UI at ceiling', extra: bodyAt.match(/Risk[\s\S]{0,80}|NEAR|Within|Over|LOW|MEDIUM|HIGH/gi)?.join(' | ') })

    await disc.fill(String((apiCtx.ceiling + 0.01).toFixed(2)))
    await page.waitForTimeout(900)
    await shot(page, 'quote-just-over')
    const bodyOver = await page.locator('main').innerText()
    notes.push({ kind: 'info', title: 'UI just over ceiling', extra: bodyOver.match(/Over limit|Near limit|Within limit|HIGH|MEDIUM|LOW|Score[^\n]*/gi)?.slice(0, 8).join(' | ') })

    await disc.fill('-5')
    await page.waitForTimeout(700)
    const discVal = await disc.inputValue()
    if (discVal === '0' || discVal === '' || Number(discVal) < 0) {
      if (Number(discVal) < 0) {
        finding({
          sev: 'MEDIUM', module: 'Quotation Builder',
          title: 'UI number input accepts a negative discount',
          steps: ['On a draft quote, type -5 in Discount'],
          expected: 'Rejected with a validation message',
          actual: `input value=${discVal}`,
          screen: '/app/quotations/:id Discount cell',
          cause: 'DebouncedNumberCell only Math.max(min, n) on commit; type=number still allows negatives in some browsers',
        })
      } else {
        finding({
          sev: 'MEDIUM', module: 'Quotation Builder',
          title: 'Negative discount in the UI is silently clamped, not rejected',
          steps: ['Type -5 in Discount on a draft line'],
          expected: 'Validation error',
          actual: `input became ${discVal || '(empty/clamped)'} with no error message`,
          screen: '/app/quotations/:id',
          cause: 'DebouncedNumberCell min={0}',
        })
      }
    }

    await disc.fill('100')
    await page.waitForTimeout(900)
    await shot(page, 'quote-100pct')
    const after100 = await page.locator('main').innerText()
    if (/100%/.test(after100) || (await disc.inputValue()) === '100') {
      notes.push({ kind: 'info', title: 'UI 100% before server clamp', extra: `input=${await disc.inputValue()}` })
    }

    await page.setViewportSize({ width: 375, height: 720 })
    await page.waitForTimeout(300)
    await shot(page, 'quote-mobile-375')
    const overflowX = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 4)
    if (overflowX) {
      finding({
        sev: 'LOW', module: 'Cross-cutting: navigation, empty states, loading states, error states, responsive behavior at different window sizes',
        title: 'Quotation detail overflows horizontally at 375px',
        steps: ['Open quotation detail', 'Resize to 375×720'],
        expected: 'No horizontal page scroll',
        actual: 'documentElement.scrollWidth > clientWidth',
        screen: '/app/quotations/:id @375px', cause: 'ledger rows / 36px header totals',
      })
    }
    await page.setViewportSize({ width: 1280, height: 800 })

    const dash = await (await fetch(API + '/api/dashboard/summary', {
      headers: { Authorization: `Bearer ${await page.evaluate(() => localStorage.getItem('df360_token'))}` },
    })).json()
    await page.goto(`${UI}/app/dashboard`, { waitUntil: 'networkidle' })
    const dashText = await page.locator('main').innerText()
    const apiCount = dash.deals?.length ?? dash.kpis
    notes.push({ kind: 'info', title: 'Dashboard vs API', extra: `uiHasSalesDashboard=${dashText.includes('Sales Dashboard')} dealsApi=${dash.deals?.length}` })
    if (!dashText.includes('Sales Dashboard')) {
      finding({
        sev: 'HIGH', module: 'Deal Health & Anomaly Dashboard',
        title: 'Dashboard failed to render after login',
        steps: ['Login as rep', 'Open /app/dashboard'],
        expected: 'Sales Dashboard', actual: dashText.slice(0, 200),
        screen: '/app/dashboard', cause: 'query error',
      })
    } else pass('Dashboard renders', `deals in API=${dash.deals?.length}`)

    await page.evaluate(() => {
      localStorage.setItem('df360_token', 'expired.jwt.token')
    })
    await page.goto(`${UI}/app/quotations`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(800)
    if (page.url().includes('/login')) pass('401 redirects to login')
    else finding({
      sev: 'HIGH', module: 'Authentication & Roles',
      title: 'Expired/garbage JWT does not send the UI back to login',
      steps: ['Set df360_token to garbage', 'Navigate to /app/quotations'],
      expected: 'Redirect /login', actual: page.url(),
      screen: 'api.ts 401 handler', cause: '401 handler or cached user still in localStorage',
    })

    await context.close()
  }

  // --- Manager UI: approvals, config copy, deal health ---
  {
    const { context, page } = await newPage()
    await uiLogin(page, 'olivia.t@example.org')
    const nav = await navText(page)
    if (!/approvals/i.test(nav)) {
      finding({
        sev: 'HIGH', module: 'Approval Routing & Approval Detail screen',
        title: 'Manager nav is missing Approvals',
        steps: ['Login as olivia.t@example.org'],
        expected: 'Approvals tab', actual: nav,
        screen: 'TopNav', cause: 'canSeeApprovals',
      })
    } else pass('Manager sees Approvals tab')
    if (/\bProduct\b/.test(nav) || /\bReports\b/.test(nav)) {
      finding({
        sev: 'MEDIUM', module: 'Authentication & Roles',
        title: 'Manager nav includes admin-only Product/Reports',
        steps: ['Login as manager'], expected: 'Hidden', actual: nav,
        screen: 'TopNav', cause: 'tabsForInternal',
      })
    }

    await page.goto(`${UI}/app/approvals`, { waitUntil: 'networkidle' })
    await shot(page, 'mgr-approvals')
    const tokenRep = await loginApi('ivan.p@example.net')
    const fresh = await req('/api/quotations', { method: 'POST', token: tokenRep, body: { customerId: 'c-acme' } })
    await req(`/api/quotations/${fresh.json.id}/lines`, { method: 'POST', token: tokenRep, body: { productId: 'p-sensor', qty: 1 } })
    const freshDetail = (await req(`/api/quotations/${fresh.json.id}`, { token: tokenRep })).json
    await req(`/api/quotations/${fresh.json.id}/lines/${freshDetail.lines[0].id}`, {
      method: 'PATCH', token: tokenRep, body: { discountPercent: 22 },
    })
    const freshSub = await req(`/api/quotations/${fresh.json.id}/submit`, { method: 'POST', token: tokenRep, body: {} })
    const freshAid = freshSub.json?.approvalId
    notes.push({ kind: 'info', title: 'Fresh pending for manager UI', extra: JSON.stringify({ id: fresh.json.id, aid: freshAid, req: freshSub.json?.approvalRequired, status: freshSub.json?.quotation?.status }) })
    if (freshAid) {
      await page.goto(`${UI}/app/approvals/${freshAid}`, { waitUntil: 'networkidle' })
      await page.waitForTimeout(600)
      await shot(page, 'mgr-approval-detail')
      const text = await page.locator('main').innerText()
      const hasApprove = await page.getByRole('button', { name: 'Approve' }).count()
      notes.push({ kind: 'info', title: 'Manager approval detail', extra: `hasApprove=${hasApprove} snippet=${text.slice(0, 400)}` })
      if (hasApprove === 0) {
        finding({
          sev: 'HIGH', module: 'Approval Routing & Approval Detail screen',
          title: 'Manager does not see Approve on a freshly submitted pending approval',
          steps: [`Submit 22% hardware quote`, `Open /app/approvals/${freshAid} as manager`],
          expected: 'Approve / Return / Reject',
          actual: text.match(/Actions appear[^\n]*/)?.[0] || text.slice(0, 280),
          screen: '/app/approvals/:id',
          cause: 'showActions requires status===pending and stage sales_manager|finance',
        })
      } else pass('Manager sees Approve on pending sales_manager step')
      if (/No line exceeded its limit/.test(text) && /MEDIUM|HIGH/.test(text)) {
        finding({
          sev: 'HIGH', module: 'Approval Routing & Approval Detail screen',
          title: 'Approval detail says no line exceeded its limit while risk is MEDIUM/HIGH',
          steps: [`Open approval ${freshAid}`],
          expected: 'flagReasons rows for over-limit lines',
          actual: 'Empty flag table + elevated risk stripe',
          screen: '/app/approvals/:id',
          cause: 'overBy rounded to 0 so flagReasons empty',
        })
      }
    }

    await page.goto(`${UI}/app/deal-health`, { waitUntil: 'networkidle' })
    await shot(page, 'mgr-deal-health')
    const dhText = await page.locator('main').innerText()
    if (!/Deal Health/.test(dhText)) {
      finding({
        sev: 'HIGH', module: 'Deal Health & Anomaly Dashboard',
        title: 'Deal Health page did not render',
        steps: ['Manager opens /app/deal-health'],
        expected: 'Deal Health heading', actual: dhText.slice(0, 200),
        screen: '/app/deal-health', cause: 'query/error',
      })
    } else pass('Deal Health page renders')

    await page.goto(`${UI}/app/admin/discount-config`, { waitUntil: 'networkidle' })
    if (page.url().includes('/dashboard')) {
      pass('Manager cannot open discount config (finance/admin only)')
    } else {
      await shot(page, 'mgr-config')
    }
    await context.close()
  }

  // --- Finance config + fulfillment ---
  {
    const { context, page } = await newPage()
    await uiLogin(page, 'quinn.m@example.net')
    await page.goto(`${UI}/app/admin/discount-config`, { waitUntil: 'networkidle' })
    await shot(page, 'fin-config')
    const save = await page.getByRole('button', { name: 'Save Configuration' }).count()
    const readNote = await page.getByText(/Finance has read access/).count()
    if (save === 0 && readNote > 0) pass('Finance sees read-only discount config')
    else if (save > 0) {
      finding({
        sev: 'HIGH', module: 'Discount Tier & Approval Chain configuration screen',
        title: 'Finance sees Save Configuration in the UI',
        steps: ['Login as finance', 'Open Config'],
        expected: 'Read-only, no Save', actual: 'Save button present',
        screen: '/app/admin/discount-config', cause: 'canEditDiscountConfig',
      })
    }
    const banner = await page.locator('main').innerText()
    if (/Changing the routing values is what the risk engine uses/.test(banner)) {
      finding({
        sev: 'HIGH', module: 'Discount Tier & Approval Chain configuration screen',
        title: 'Config screen claims routing values drive the engine; backend ignores them',
        steps: ['Open Config as finance/admin', 'Read the info banner'],
        expected: 'Copy matches requiredApprovalLevel(LOW/MEDIUM/HIGH) mapping',
        actual: 'Banner: "Changing the routing values is what the risk engine uses"',
        screen: '/app/admin/discount-config',
        cause: 'DiscountConfigPage InfoBanner vs helpers.requiredApprovalLevel never reading approvalChain',
      })
    }

    await page.goto(`${UI}/app/fulfillment`, { waitUntil: 'networkidle' })
    await shot(page, 'fin-fulfillment')
    const firstRow = page.locator('table tbody tr, [role="row"]').nth(1)
    if (await firstRow.count()) {
      await firstRow.click({ timeout: 3000 }).catch(() => {})
      await page.waitForTimeout(600)
      await shot(page, 'fin-fulfillment-detail')
      const ftext = await page.locator('main').innerText()
      if (/Consolidate Remaining Backorder/.test(ftext)) {
        const consBtn = page.getByRole('button', { name: /Consolidate Remaining Backorder/ })
        if (await consBtn.count()) {
          await consBtn.click({ timeout: 4000 }).catch(() => {})
        }
        await page.waitForTimeout(800)
        const after = await page.locator('main').innerText()
        const toastish = after + (await page.locator('body').innerText())
        if (/404|Cannot POST|Failed|error/i.test(toastish) || /Consolidate Remaining Backorder/.test(after)) {
          finding({
            sev: 'HIGH', module: 'Warehouse Fulfillment & Split logic',
            title: 'Consolidate Remaining Backorder button is shown but the API route 404s',
            steps: ['Finance opens a fulfillment with canConsolidate', 'Click Consolidate Remaining Backorder'],
            expected: 'Consolidation succeeds',
            actual: 'UI offers the action; POST /api/fulfillment/:id/consolidate is 404 on Postgres',
            screen: '/app/fulfillment/:id',
            cause: 'FulfillmentDetailPage vs missing index.pg.js route',
          })
        }
      }
    }
    await context.close()
  }

  // --- Admin products / invoices / subscriptions ---
  {
    const { context, page } = await newPage()
    await uiLogin(page, 'beth.t@example.com')
    const nav = await navText(page)
    if (!/\bProduct\b/.test(nav) || !/\bReports\b/.test(nav) || !/\bConfig\b/.test(nav)) {
      finding({
        sev: 'MEDIUM', module: 'Authentication & Roles',
        title: 'Admin nav missing Product/Reports/Config',
        steps: ['Login as beth.t@example.com'], expected: 'All admin tabs', actual: nav,
        screen: 'TopNav', cause: 'tabsForInternal',
      })
    } else pass('Admin nav complete', nav)

    await page.goto(`${UI}/app/products`, { waitUntil: 'networkidle' })
    await shot(page, 'admin-products')
    await page.goto(`${UI}/app/invoices`, { waitUntil: 'networkidle' })
    await shot(page, 'admin-invoices')
    const inv = await page.locator('main').innerText()
    if (/Failed to load|Error/i.test(inv) && !/Invoice/.test(inv)) {
      finding({
        sev: 'HIGH', module: 'Invoices & payment recording',
        title: 'Invoices page errors',
        steps: ['Admin opens /app/invoices'], expected: 'List or empty state', actual: inv.slice(0, 200),
        screen: '/app/invoices', cause: 'API',
      })
    } else pass('Invoices page renders')

    await page.goto(`${UI}/app/subscriptions`, { waitUntil: 'networkidle' })
    await shot(page, 'admin-subs')
    if (await page.getByRole('button', { name: /New Plan/ }).count()) pass('Admin can create subscription plans in UI')
    await context.close()
  }

  // --- Customer portal ---
  {
    const { context, page } = await newPage()
    await uiLogin(page, 'marco.r@example.org')
    if (!page.url().includes('/portal')) {
      finding({
        sev: 'CRITICAL', module: 'Authentication & Roles',
        title: 'Customer login did not land on the portal',
        steps: ['Login marco.r@example.org'], expected: '/portal/quotes', actual: page.url(),
        screen: '/login → portal', cause: 'isInternal / Navigate',
      })
    } else pass('Customer lands on portal', page.url())
    await shot(page, 'portal-quotes')
    const createBtn = await page.getByRole('button', { name: /Create Request/ }).count()
    if (createBtn === 0) {
      finding({
        sev: 'HIGH', module: 'Customer Portal Negotiation screen',
        title: 'Create Request button never renders on My Quotations',
        steps: ['Login as customer', 'View /portal/quotes'],
        expected: 'Create Request in the page header',
        actual: 'Button absent',
        screen: '/portal/quotes',
        cause: 'PortalQuotesListPage passes PageHeader action= but PageHeader only reads actions=',
      })
    }

    await page.goto(`${UI}/app/dashboard`, { waitUntil: 'networkidle' })
    if (page.url().includes('/portal')) pass('Customer blocked from /app/dashboard')
    else finding({
      sev: 'CRITICAL', module: 'Authentication & Roles',
      title: 'Customer can open the internal dashboard URL',
      steps: ['As customer, go to /app/dashboard'],
      expected: 'Redirect /portal/quotes', actual: page.url(),
      screen: 'InternalLayout', cause: 'role check',
    })

    await page.goto(`${UI}/portal/quotes`, { waitUntil: 'networkidle' })
    const firstQuote = page.locator('table tbody tr').first()
    if (await firstQuote.count()) {
      await firstQuote.click()
      await page.waitForURL(/\/portal\/quote\//, { timeout: 10000 })
      await shot(page, 'portal-quote-detail')
      const ptext = await page.locator('main').innerText()
      if (!/Submit Request|Confirm Quotation/.test(ptext)) {
        finding({
          sev: 'HIGH', module: 'Customer Portal Negotiation screen',
          title: 'Portal quote detail missing negotiate/confirm actions',
          steps: ['Open a portal quote'], expected: 'Submit Request + Confirm', actual: ptext.slice(0, 300),
          screen: '/portal/quote/:id', cause: 'PortalQuotePage',
        })
      } else pass('Portal quote detail has Submit Request / Confirm')

      const counter = page.locator('input[type="number"]').first()
      if (await counter.count()) {
        await counter.fill('-8')
        notes.push({ kind: 'info', title: 'Portal counter allows', extra: await counter.inputValue() })
        if (!counter.getAttribute('min')) {
          finding({
            sev: 'MEDIUM', module: 'Customer Portal Negotiation screen',
            title: 'Portal counter-discount input has no min and accepts negatives',
            steps: ['Open portal quote', 'Type -8 in Counter Discount %'],
            expected: 'min=0 and validation',
            actual: `value=${await counter.inputValue()} (no min attribute)`,
            screen: '/portal/quote/:id', cause: 'input type=number without min',
          })
        }
      }
    } else {
      finding({
        sev: 'MEDIUM', module: 'Customer Portal Negotiation screen',
        title: 'Portal quotes list is empty for Acme (or table missing)',
        steps: ['Login marco.r@example.org', 'View My Quotations'],
        expected: 'At least seed quotes', actual: 'No table rows',
        screen: '/portal/quotes', cause: 'pending_approval filter or empty seed',
      })
    }

    if (apiCtx.q2) {
      await page.goto(`${UI}/portal/quote/${apiCtx.q2}`, { waitUntil: 'networkidle' })
      await shot(page, 'portal-direct-pending-quote')
      const err = await page.getByText(/Not found|Forbidden|Failed/).count()
      const hasSubmit = await page.getByRole('button', { name: 'Submit Request' }).count()
      notes.push({ kind: 'info', title: 'Direct portal URL to pending quote', extra: `err=${err} submit=${hasSubmit} url=${page.url()}` })
    }
    await context.close()
  }

  // --- Two-device sync ---
  let syncResult = { pass: false, detail: 'not run' }
  {
    const tokenRep = await loginApi('ivan.p@example.net')
    const q = await req('/api/quotations', { method: 'POST', token: tokenRep, body: { customerId: 'c-acme' } })
    await req(`/api/quotations/${q.json.id}/lines`, { method: 'POST', token: tokenRep, body: { productId: 'p-sensor', qty: 1 } })
    const detail = (await req(`/api/quotations/${q.json.id}`, { token: tokenRep })).json
    const lid = detail.lines[0].id
    await req(`/api/quotations/${q.json.id}/lines/${lid}`, { method: 'PATCH', token: tokenRep, body: { discountPercent: 22 } })
    const sub = await req(`/api/quotations/${q.json.id}/submit`, { method: 'POST', token: tokenRep, body: {} })
    const aId = sub.json?.approvalId
    const { context: mgrCtx, page: mgrPage } = await newPage()
    const { context: custCtx, page: custPage } = await newPage()
    await uiLogin(mgrPage, 'olivia.t@example.org')
    if (aId) await mgrPage.goto(`${UI}/app/approvals/${aId}`, { waitUntil: 'networkidle' })
    else await mgrPage.goto(`${UI}/app/dashboard`, { waitUntil: 'networkidle' })
    await mgrPage.waitForTimeout(500)
    const before = await mgrPage.locator('main').innerText()

    await uiLogin(custPage, 'marco.r@example.org')
    await custPage.goto(`${UI}/portal/quote/${q.json.id}`, { waitUntil: 'networkidle' })
    await custPage.waitForTimeout(500)
    const portalReady = await custPage.getByRole('button', { name: 'Submit Request' }).count()
    if (portalReady) {
      const num = custPage.locator('input[type="number"]').first()
      await num.fill('33')
      await custPage.getByRole('button', { name: 'Submit Request' }).click()
      await custPage.waitForTimeout(500)
      await shot(custPage, 'sync-customer-after-submit')
      const appeared = await mgrPage.waitForFunction(
        (needle) => document.body.innerText.includes(needle),
        '33',
        { timeout: 8000 },
      ).then(() => true).catch(() => false)
      await shot(mgrPage, 'sync-manager-after-customer')
      const after = await mgrPage.locator('main').innerText()
      syncResult = {
        pass: appeared || after.includes('33'),
        detail: `approvalId=${aId} quote=${q.json.id} appeared33=${appeared} managerBeforeHas22=${before.includes('22')} afterHas33=${after.includes('33')} afterHasNegotiation=${/negotiation/i.test(after)}`,
      }
      if (syncResult.pass) pass('Two-device: manager approval updated after customer counter', syncResult.detail)
      else {
        finding({
          sev: 'CRITICAL', module: 'Real-time sync between internal workspace and customer portal',
          title: 'Customer counter-discount does not update the open Approval Detail within a few seconds',
          steps: [
            `Manager tab: /app/approvals/${aId}`,
            `Customer tab: /portal/quote/${q.json.id} set counter 33% Submit Request`,
            'Wait 8s without refresh on manager tab',
          ],
          expected: 'Manager view shows 33% (or under-negotiation) within a few seconds',
          actual: syncResult.detail,
          screen: '/app/approvals/:id vs /portal/quote/:id',
          cause: 'socket join order:{id}; dashboard/list not subscribed; pending quotes may 404 on portal; negotiate may fail',
        })
      }
    } else {
      const portalBody = await custPage.locator('main').innerText()
      syncResult = { pass: false, detail: `portal Submit missing. url=${custPage.url()} body=${portalBody.slice(0, 240)}` }
      finding({
        sev: 'CRITICAL', module: 'Real-time sync between internal workspace and customer portal',
        title: 'Cannot run live two-device demo: customer cannot open/act on the in-approval quote',
        steps: [
          'Submit over-limit quote as rep',
          `Customer opens /portal/quote/${q.json.id}`,
        ],
        expected: 'Customer can submit a counter while manager has Approval Detail open',
        actual: syncResult.detail,
        screen: '/portal/quote/:id',
        cause: 'pending_approval hidden from portal list; detail may error; buttons locked or page ErrorState',
      })
    }

    // Dashboard stale check: customer negotiates while manager is on dashboard
    await mgrPage.goto(`${UI}/app/dashboard`, { waitUntil: 'networkidle' })
    const dashBefore = await mgrPage.locator('main').innerText()
    if (portalReady) {
      await custPage.goto(`${UI}/portal/quote/${q.json.id}`, { waitUntil: 'networkidle' })
      const num2 = custPage.locator('input[type="number"]').first()
      if (await num2.count()) {
        await num2.fill('41')
        await custPage.getByRole('button', { name: 'Submit Request' }).click().catch(() => {})
        const dashUpdated = await mgrPage.waitForFunction(
          (n) => document.body.innerText.includes(n),
          '41',
          { timeout: 5000 },
        ).then(() => true).catch(() => false)
        if (!dashUpdated) {
          finding({
            sev: 'HIGH', module: 'Real-time sync between internal workspace and customer portal',
            title: 'Dashboard does not live-update when a customer negotiates',
            steps: ['Manager stays on Dashboard', 'Customer submits a counter'],
            expected: 'Badge/notification or deal row update',
            actual: `No "41" on dashboard after 5s. useDashboard has no useOrderSync. dashStillHasDeals=${dashBefore.includes('Deal')}`,
            screen: '/app/dashboard',
            cause: 'useDashboard is a plain useQuery with no socket/poll',
          })
        } else pass('Dashboard live-updated after portal negotiate')
      }
    }

    // Same-device two tabs
    const page2 = await mgrCtx.newPage()
    if (aId) {
      await page2.goto(`${UI}/app/approvals/${aId}`, { waitUntil: 'networkidle' })
      await mgrPage.goto(`${UI}/app/approvals/${aId}`, { waitUntil: 'networkidle' })
      const t1 = await mgrPage.locator('main').innerText()
      const t2 = await page2.locator('main').innerText()
      const score1 = t1.match(/Score\s+(\d+)/)?.[1]
      const score2 = t2.match(/Score\s+(\d+)/)?.[1]
      if (score1 && score2 && score1 !== score2) {
        finding({
          sev: 'HIGH', module: 'Real-time sync between internal workspace and customer portal',
          title: 'Two tabs on the same order show different risk scores',
          steps: ['Open approval in two tabs'],
          expected: 'Identical backend state',
          actual: `tab1=${score1} tab2=${score2}`,
          screen: '/app/approvals/:id', cause: 'stale react-query cache',
        })
      } else pass('Two tabs same approval scores match', `${score1}=${score2}`)
    }

    // Refresh safety net
    if (aId) {
      await mgrPage.reload({ waitUntil: 'networkidle' })
      const reloaded = await mgrPage.locator('main').innerText()
      if (/Approval not found|Failed/.test(reloaded) && !/Blended Risk/.test(reloaded)) {
        finding({
          sev: 'HIGH', module: 'Real-time sync between internal workspace and customer portal',
          title: 'F5 on Approval Detail fails to reload latest state',
          steps: [`F5 /app/approvals/${aId}`],
          expected: 'Latest state from server', actual: reloaded.slice(0, 200),
          screen: '/app/approvals/:id', cause: 'query error',
        })
      } else pass('F5 on approval detail reloads')
    }

    await mgrCtx.close()
    await custCtx.close()
  }

  // Unauthenticated deep link
  {
    const { context, page } = await newPage()
    await page.goto(`${UI}/app/dashboard`, { waitUntil: 'networkidle' })
    if (page.url().includes('/login')) pass('Logged-out deep link to /app redirects to login')
    else finding({
      sev: 'HIGH', module: 'Authentication & Roles',
      title: 'Logged-out user can see /app/dashboard',
      steps: ['Incognito', 'Open /app/dashboard'],
      expected: '/login', actual: page.url(),
      screen: 'InternalLayout', cause: 'user null check',
    })
    await context.close()
  }

  await browser.close()
  const uniqueErrors = [...new Set(pageErrors)]
  if (uniqueErrors.length) {
    finding({
      sev: 'HIGH', module: 'Cross-cutting: navigation, empty states, loading states, error states, responsive behavior at different window sizes',
      title: 'Unhandled frontend exceptions during QA',
      steps: ['Browse login, quotes, approvals, portal, config'],
      expected: 'No pageerror',
      actual: uniqueErrors.slice(0, 8).join(' || '),
      screen: 'Chromium pageerror',
      cause: 'See stack',
    })
  }
  return { syncResult, pageErrors: uniqueErrors }
}

const health = await req('/api/health')
if (health.status !== 200 && health.status !== 404) {
  console.error('API not healthy', health)
  process.exit(1)
}
const ping = await fetch(UI).catch((e) => ({ ok: false, error: String(e) }))
if (!ping.ok && ping.status === undefined) {
  console.error('UI not up', ping)
  process.exit(1)
}

let apiCtx = { ceiling: 15 }
let uiCtx = {}
try {
  if (process.env.QA_SKIP_BACKEND) {
    console.log('Skipping backend (QA_SKIP_BACKEND)')
  } else {
    apiCtx = { ceiling: 15, ...(await runBackend()) }
  }
} catch (e) {
  finding({
    sev: 'CRITICAL', module: 'Cross-cutting: navigation, empty states, loading states, error states, responsive behavior at different window sizes',
    title: 'Backend QA script crashed',
    steps: ['Run scratch/qa_full.mjs backend section'],
    expected: 'Complete', actual: String(e.stack || e),
    screen: 'QA harness', cause: String(e),
  })
}
try {
  uiCtx = await runFrontend(apiCtx)
} catch (e) {
  finding({
    sev: 'CRITICAL', module: 'Cross-cutting: navigation, empty states, loading states, error states, responsive behavior at different window sizes',
    title: 'Frontend QA script crashed',
    steps: ['Run Playwright against http://localhost:5173'],
    expected: 'Complete', actual: String(e.stack || e),
    screen: 'QA harness', cause: String(e),
  })
}

const out = {
  at: new Date().toISOString(),
  api: API,
  ui: UI,
  findings,
  notes,
  sync: uiCtx.syncResult,
  pageErrors: uiCtx.pageErrors,
}
writeFileSync(join(__dirname, 'qa_full_results.json'), JSON.stringify(out, null, 2))
console.log('\n======== SUMMARY ========')
const by = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 }
for (const f of findings) by[f.sev] = (by[f.sev] || 0) + 1
console.log(by, 'total', findings.length, 'passes', notes.filter((n) => n.kind === 'pass').length)
console.log('Wrote scratch/qa_full_results.json')

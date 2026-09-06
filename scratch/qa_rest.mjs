import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'

const UI = 'http://localhost:5173'
const API = 'http://localhost:3001'
const out = []

async function login(page, email) {
  await page.goto(UI + '/login', { waitUntil: 'networkidle' })
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill('password')
  await page.locator('form button[type="submit"]').click()
  await page.waitForURL(/\/(app|portal)/, { timeout: 15000 })
}

const browser = await chromium.launch({ headless: true, channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
const pageErrors = []
page.on('pageerror', (e) => pageErrors.push(String(e)))

await login(page, 'beth.t@example.com')
for (const path of ['/app/products', '/app/reports', '/app/invoices', '/app/subscriptions']) {
  await page.goto(UI + path, { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  const t = await page.locator('main').innerText()
  out.push({ path, heading: t.split('\n').slice(0, 8), hasError: /Failed to load|ErrorState|Not found/.test(t) && !/Invoice|Product|Report|Subscription/.test(t), len: t.length })
}

await page.goto(UI + '/app/invoices', { waitUntil: 'networkidle' })
const invRow = page.locator('table tbody tr').first()
if (await invRow.count()) {
  await invRow.click()
  await page.waitForTimeout(700)
  out.push({ path: page.url(), invoiceDetail: (await page.locator('main').innerText()).slice(0, 500) })
}

await page.goto(UI + '/app/subscriptions', { waitUntil: 'networkidle' })
const subRow = page.locator('table tbody tr').first()
if (await subRow.count()) {
  await subRow.click()
  await page.waitForTimeout(700)
  const st = await page.locator('main').innerText()
  out.push({ path: page.url(), subDetail: st.slice(0, 700), hasOneTime: /One-time lines/.test(st), hasRecurring: /Recurring lines/.test(st) })
}

await page.goto(UI + '/app/quotations', { waitUntil: 'networkidle' })
out.push({ quotations: (await page.locator('main').innerText()).slice(0, 200) })

await page.getByRole('button', { name: 'Log out' }).click()
await login(page, 'marco.r@example.org')
await page.goto(UI + '/portal/messages', { waitUntil: 'networkidle' })
out.push({ messages: (await page.locator('main').innerText()).slice(0, 300) })
await page.goto(UI + '/portal/profile', { waitUntil: 'networkidle' })
out.push({ profile: (await page.locator('main').innerText()).slice(0, 300) })

const token = await (await fetch(API + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'beth.t@example.com', password: 'password' }) })).json()
const subs = await (await fetch(API + '/api/subscriptions', { headers: { Authorization: 'Bearer ' + token.token } })).json()
const first = subs.items?.[0]
let subApi = null
if (first) {
  subApi = await (await fetch(API + '/api/subscriptions/' + first.id, { headers: { Authorization: 'Bearer ' + token.token } })).json()
}
const invs = await (await fetch(API + '/api/invoices', { headers: { Authorization: 'Bearer ' + token.token } })).json()

writeFileSync('scratch/qa_rest.json', JSON.stringify({ out, pageErrors, subApi: subApi && { id: subApi.id, oneTime: subApi.oneTimeLines, recurring: subApi.recurringLines, keys: Object.keys(subApi) }, invCount: invs.items?.length, subCount: subs.items?.length }, null, 2))
await browser.close()
console.log(JSON.stringify({ pageErrors, paths: out.map((o) => o.path || o.messages && 'messages' || o.profile && 'profile' || o), subKeys: subApi && Object.keys(subApi), oneTime: subApi?.oneTimeLines?.length, rec: subApi?.recurringLines?.length }, null, 2))

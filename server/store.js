/** In-memory store, seed data, and risk-score engine for DealFlow360. */

export const NOW = new Date('2026-09-05T09:30:00.000Z')

export const db = {
  users: [],
  customers: [],
  products: [],
  pricelists: [],
  quotations: [],
  approvals: [],
  fulfillment: [],
  stock: [],
  subscriptions: [],
  invoices: [],
  dealHealth: [],
  activity: [],
  portalMessages: [],
  discountConfig: null,
}

function iso(daysAgo, hours = 10) {
  const d = new Date(NOW)
  d.setUTCDate(d.getUTCDate() - daysAgo)
  d.setUTCHours(hours, 12, 0, 0)
  return d.toISOString()
}

export function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    customerId: user.customerId ?? null,
  }
}

export function lineLimit(line, customer, config) {
  const tier = config.tierDiscounts.find((t) => t.tier === customer.tier)
  const cat = config.categoryCeilings.find((c) => c.category === line.category)
  const tierMax = tier ? Number(tier.maxDiscount) : 10
  const catMax = cat ? Number(cat.maxDiscount) : 10
  return Math.min(tierMax, catMax)
}

export function lineStatus(discountPercent, limit) {
  if (discountPercent > limit) return 'over'
  if (discountPercent >= Math.max(0, limit - 2)) return 'near'
  return 'within'
}

export function computeQuotationRisk(quotation) {
  const customer = db.customers.find((c) => c.id === quotation.customerId)
  const config = db.discountConfig
  if (!customer) return quotation

  let weightedOver = 0
  let totalValue = 0
  const flagReasons = []

  for (const line of quotation.lines) {
    const limit = lineLimit(line, customer, config)
    line.limit = limit
    line.status = lineStatus(line.discountPercent, limit)
    const lineValue = line.qty * line.price
    totalValue += lineValue
    const overBy = Math.max(0, Math.round((line.discountPercent - limit) * 10) / 10)
    if (overBy > 0) {
      weightedOver += (overBy / 100) * lineValue
      flagReasons.push({
        line: line.productName,
        discountGiven: line.discountPercent,
        limitAllowed: limit,
        overBy,
      })
    }
  }

  const blended = totalValue === 0 ? 0 : (weightedOver / totalValue) * 100
  const overCount = quotation.lines.filter((l) => l.status === 'over').length
  const riskScore = Math.min(100, Math.round(blended * 8 + overCount * 18))

  const highCut = Number(config.thresholds.high)
  const medCut = Number(config.thresholds.medium)
  let riskLevel = 'LOW'
  if (blended >= highCut || quotation.lines.some((l) => l.discountPercent - l.limit > 5)) {
    riskLevel = 'HIGH'
  } else if (blended > medCut || overCount > 0) {
    riskLevel = 'MEDIUM'
  }

  quotation.amount = quotation.lines.reduce((sum, l) => {
    return sum + l.qty * l.price * (1 - l.discountPercent / 100)
  }, 0)
  quotation.riskScore = riskScore
  quotation.riskLevel = riskLevel
  quotation.blendedRisk = Math.round(blended * 10) / 10
  quotation.flagReasons = flagReasons
  quotation.customerTier = customer.tier
  quotation.customerName = customer.name
  return quotation
}

export function requiredApprovalLevel(quotation) {
  if (quotation.riskLevel === 'HIGH') return 'finance'
  if (quotation.riskLevel === 'MEDIUM') return 'manager'
  return 'none'
}

const UPSELL_PAIRS = {
  'p-sensor': ['p-spares', 'p-support', 'p-install'],
  'p-gateway': ['p-install', 'p-support', 'p-sensor'],
  'p-maint': ['p-sensor', 'p-gateway', 'p-support'],
  'p-install': ['p-support', 'p-spares', 'p-maint'],
  'p-support': ['p-maint', 'p-spares', 'p-sensor'],
  'p-spares': ['p-sensor', 'p-install', 'p-support'],
}

export function getUpsells(quotation) {
  const inCart = new Set(quotation.lines.map((l) => l.productId))
  const ranked = []
  for (const line of quotation.lines) {
    const pairs = UPSELL_PAIRS[line.productId] ?? []
    for (const id of pairs) {
      if (!inCart.has(id) && !ranked.includes(id)) ranked.push(id)
    }
  }
  if (ranked.length < 3) {
    for (const p of db.products) {
      if (!inCart.has(p.id) && !ranked.includes(p.id)) ranked.push(p.id)
    }
  }
  return ranked.slice(0, 3).map((id) => {
    const p = db.products.find((x) => x.id === id)
    return {
      productId: p.id,
      productName: p.name,
      price: p.price,
      marginNote:
        p.category === 'Services'
          ? 'High-margin services attach'
          : 'Completes the hardware bundle',
    }
  })
}

export function logActivity(text) {
  db.activity.unshift({
    id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    text,
    timestamp: new Date().toISOString(),
  })
  db.activity = db.activity.slice(0, 40)
}

export function appendAudit(approval, user, action, note) {
  approval.auditLog.push({
    user: user.name,
    userId: user.id,
    action,
    date: new Date().toISOString(),
    note,
  })
}

function seed() {
  db.discountConfig = {
    tierDiscounts: [
      { id: 'td-bronze', tier: 'Bronze', maxDiscount: 8 },
      { id: 'td-silver', tier: 'Silver', maxDiscount: 12 },
      { id: 'td-gold', tier: 'Gold', maxDiscount: 18 },
    ],
    categoryCeilings: [
      { id: 'cc-hw', category: 'Hardware', maxDiscount: 15 },
      { id: 'cc-sv', category: 'Services', maxDiscount: 25 },
    ],
    approvalChain: [
      { id: 'ac-1', range: 'Within limit', routing: 'No approval', trigger: 'within' },
      {
        id: 'ac-2',
        range: 'Over limit — blended medium',
        routing: 'Sales Manager',
        trigger: 'medium',
      },
      {
        id: 'ac-3',
        range: 'Over limit — blended high',
        routing: 'Sales Manager then Finance',
        trigger: 'high',
      },
    ],
    thresholds: { medium: 0, high: 4 },
  }

  db.users = [
    { id: 'u-rep', email: 'ivan.p@example.net', password: 'password', name: 'Alex Rivera', role: 'rep' },
    { id: 'u-mgr', email: 'olivia.t@example.org', password: 'password', name: 'Jordan Chen', role: 'manager' },
    { id: 'u-fin', email: 'quinn.m@example.net', password: 'password', name: 'Sam Patel', role: 'finance' },
    { id: 'u-adm', email: 'beth.t@example.com', password: 'password', name: 'Taylor Kim', role: 'admin' },
    {
      id: 'u-cust1',
      email: 'marco.r@example.org',
      password: 'password',
      name: 'Riley Hart',
      role: 'customer',
      customerId: 'c-acme',
    },
    {
      id: 'u-cust2',
      email: 'uma.s@example.org',
      password: 'password',
      name: 'Casey Nguyen',
      role: 'customer',
      customerId: 'c-globex',
    },
  ]

  db.customers = [
    { id: 'c-acme', name: 'Acme Corp', tier: 'Gold', region: 'North America', terms: 'Net 30' },
    { id: 'c-globex', name: 'Globex Industries', tier: 'Silver', region: 'EMEA', terms: 'Net 45' },
    { id: 'c-initech', name: 'Initech', tier: 'Bronze', region: 'North America', terms: 'Net 15' },
    { id: 'c-umbrella', name: 'Umbrella LLC', tier: 'Gold', region: 'APAC', terms: 'Net 30' },
    { id: 'c-stark', name: 'Stark Manufacturing', tier: 'Silver', region: 'North America', terms: 'Net 30' },
  ]

  db.products = [
    {
      id: 'p-sensor',
      name: 'Industrial Sensor Array',
      category: 'Hardware',
      price: 12500,
      unit: 'unit',
      taxPercent: 8,
      status: 'active',
      description: 'Factory-floor sensor pack with 24-month hardware warranty.',
      isSubscription: false,
      cycle: null,
      quantity: null,
      variants: [
        { id: 'v1', attribute: 'Range', values: '50m / 120m', extraPrice: 900 },
        { id: 'v2', attribute: 'Housing', values: 'Standard / IP67', extraPrice: 400 },
      ],
    },
    {
      id: 'p-gateway',
      name: 'Edge Gateway Pro',
      category: 'Hardware',
      price: 8900,
      unit: 'unit',
      taxPercent: 8,
      status: 'active',
      description: 'On-prem edge appliance for plant telemetry.',
      isSubscription: false,
      cycle: null,
      quantity: null,
      variants: [{ id: 'v3', attribute: 'Throughput', values: '1Gb / 10Gb', extraPrice: 1200 }],
    },
    {
      id: 'p-maint',
      name: 'Predictive Maintenance Suite',
      category: 'Services',
      price: 24000,
      unit: 'seat',
      taxPercent: 0,
      status: 'active',
      description: 'Recurring analytics suite billed at the start of each cycle.',
      isSubscription: true,
      cycle: 'annual',
      quantity: 1,
      variants: [{ id: 'v4', attribute: 'Tier', values: 'Standard / Plus', extraPrice: 6000 }],
    },
    {
      id: 'p-install',
      name: 'Onsite Installation',
      category: 'Services',
      price: 4500,
      unit: 'engagement',
      taxPercent: 0,
      status: 'active',
      description: 'Certified field install and commissioning.',
      isSubscription: false,
      cycle: null,
      quantity: null,
      variants: [],
    },
    {
      id: 'p-support',
      name: '24/7 Support Retainer',
      category: 'Services',
      price: 18000,
      unit: 'year',
      taxPercent: 0,
      status: 'active',
      description: 'Named-engineer retainer, billed at period start.',
      isSubscription: true,
      cycle: 'annual',
      quantity: 1,
      variants: [],
    },
    {
      id: 'p-spares',
      name: 'Spare Parts Kit',
      category: 'Hardware',
      price: 2100,
      unit: 'kit',
      taxPercent: 8,
      status: 'active',
      description: 'Critical spares for first-year coverage.',
      isSubscription: false,
      cycle: null,
      quantity: null,
      variants: [],
    },
  ]

  db.pricelists = [
    {
      id: 'pl-usd',
      name: 'Standard USD',
      currency: 'USD',
      rules: [
        { tier: 'Bronze', currency: 'USD', priceRule: 'List' },
        { tier: 'Silver', currency: 'USD', priceRule: 'List − 3%' },
        { tier: 'Gold', currency: 'USD', priceRule: 'List − 6%' },
      ],
    },
    {
      id: 'pl-eur',
      name: 'EMEA EUR',
      currency: 'EUR',
      rules: [
        { tier: 'Bronze', currency: 'EUR', priceRule: 'List × 0.92' },
        { tier: 'Silver', currency: 'EUR', priceRule: 'List × 0.89' },
        { tier: 'Gold', currency: 'EUR', priceRule: 'List × 0.86' },
      ],
    },
  ]

  db.stock = [
    { warehouse: 'East DC', productId: 'p-sensor', productName: 'Industrial Sensor Array', inStock: 42, reserved: 8 },
    { warehouse: 'East DC', productId: 'p-gateway', productName: 'Edge Gateway Pro', inStock: 18, reserved: 6 },
    { warehouse: 'East DC', productId: 'p-spares', productName: 'Spare Parts Kit', inStock: 60, reserved: 4 },
    { warehouse: 'West DC', productId: 'p-sensor', productName: 'Industrial Sensor Array', inStock: 11, reserved: 9 },
    { warehouse: 'West DC', productId: 'p-gateway', productName: 'Edge Gateway Pro', inStock: 7, reserved: 7 },
    { warehouse: 'West DC', productId: 'p-spares', productName: 'Spare Parts Kit', inStock: 22, reserved: 2 },
    { warehouse: 'Central DC', productId: 'p-sensor', productName: 'Industrial Sensor Array', inStock: 28, reserved: 3 },
    { warehouse: 'Central DC', productId: 'p-gateway', productName: 'Edge Gateway Pro', inStock: 14, reserved: 1 },
    { warehouse: 'Central DC', productId: 'p-spares', productName: 'Spare Parts Kit', inStock: 40, reserved: 0 },
  ]

  const q1042 = computeQuotationRisk({
    id: 'q-1042',
    number: 'Q-1042',
    customerId: 'c-acme',
    date: iso(4, 14),
    repId: 'u-rep',
    repName: 'Alex Rivera',
    status: 'pending_approval',
    currency: 'USD',
    region: 'North America',
    terms: 'Net 30',
    priceListId: 'pl-usd',
    lines: [
      {
        id: 'l-1042-1',
        productId: 'p-sensor',
        productName: 'Industrial Sensor Array',
        category: 'Hardware',
        qty: 6,
        price: 12500,
        discountPercent: 22,
        comment: '',
      },
      {
        id: 'l-1042-2',
        productId: 'p-maint',
        productName: 'Predictive Maintenance Suite',
        category: 'Services',
        qty: 1,
        price: 24000,
        discountPercent: 20,
        comment: '',
      },
      {
        id: 'l-1042-3',
        productId: 'p-install',
        productName: 'Onsite Installation',
        category: 'Services',
        qty: 2,
        price: 4500,
        discountPercent: 5,
        comment: '',
      },
    ],
  })

  const q1043 = computeQuotationRisk({
    id: 'q-1043',
    number: 'Q-1043',
    customerId: 'c-globex',
    date: iso(1, 11),
    repId: 'u-rep',
    repName: 'Alex Rivera',
    status: 'draft',
    currency: 'EUR',
    region: 'EMEA',
    terms: 'Net 45',
    priceListId: 'pl-eur',
    lines: [
      {
        id: 'l-1043-1',
        productId: 'p-gateway',
        productName: 'Edge Gateway Pro',
        category: 'Hardware',
        qty: 4,
        price: 8900,
        discountPercent: 6,
        comment: '',
      },
    ],
  })

  const q1044 = computeQuotationRisk({
    id: 'q-1044',
    number: 'Q-1044',
    customerId: 'c-initech',
    date: iso(12, 9),
    repId: 'u-rep',
    repName: 'Alex Rivera',
    status: 'approved',
    currency: 'USD',
    region: 'North America',
    terms: 'Net 15',
    priceListId: 'pl-usd',
    lines: [
      {
        id: 'l-1044-1',
        productId: 'p-spares',
        productName: 'Spare Parts Kit',
        category: 'Hardware',
        qty: 10,
        price: 2100,
        discountPercent: 4,
        comment: '',
      },
    ],
  })

  const q1045 = computeQuotationRisk({
    id: 'q-1045',
    number: 'Q-1045',
    customerId: 'c-acme',
    date: iso(2, 16),
    repId: 'u-rep',
    repName: 'Alex Rivera',
    status: 'negotiation',
    currency: 'USD',
    region: 'North America',
    terms: 'Net 30',
    priceListId: 'pl-usd',
    portalStatus: 'under_negotiation',
    requestedDeliveryDate: '2026-10-12',
    lines: [
      {
        id: 'l-1045-1',
        productId: 'p-sensor',
        productName: 'Industrial Sensor Array',
        category: 'Hardware',
        qty: 8,
        price: 12500,
        discountPercent: 16,
        comment: 'Need better pricing to match incumbent.',
        counterDiscount: 19,
      },
      {
        id: 'l-1045-2',
        productId: 'p-support',
        productName: '24/7 Support Retainer',
        category: 'Services',
        qty: 1,
        price: 18000,
        discountPercent: 10,
        comment: '',
        counterDiscount: 12,
      },
    ],
  })

  const q1046 = computeQuotationRisk({
    id: 'q-1046',
    number: 'Q-1046',
    customerId: 'c-stark',
    date: iso(18, 13),
    repId: 'u-rep',
    repName: 'Alex Rivera',
    status: 'confirmed',
    currency: 'USD',
    region: 'North America',
    terms: 'Net 30',
    priceListId: 'pl-usd',
    lines: [
      {
        id: 'l-1046-1',
        productId: 'p-gateway',
        productName: 'Edge Gateway Pro',
        category: 'Hardware',
        qty: 12,
        price: 8900,
        discountPercent: 8,
        comment: '',
      },
      {
        id: 'l-1046-2',
        productId: 'p-install',
        productName: 'Onsite Installation',
        category: 'Services',
        qty: 3,
        price: 4500,
        discountPercent: 0,
        comment: '',
      },
    ],
  })

  const q1047 = computeQuotationRisk({
    id: 'q-1047',
    number: 'Q-1047',
    customerId: 'c-umbrella',
    date: iso(6, 8),
    repId: 'u-rep',
    repName: 'Alex Rivera',
    status: 'pending_approval',
    currency: 'USD',
    region: 'APAC',
    terms: 'Net 30',
    priceListId: 'pl-usd',
    lines: [
      {
        id: 'l-1047-1',
        productId: 'p-maint',
        productName: 'Predictive Maintenance Suite',
        category: 'Services',
        qty: 2,
        price: 24000,
        discountPercent: 19,
        comment: '',
      },
    ],
  })

  const q1048 = computeQuotationRisk({
    id: 'q-1048',
    number: 'Q-1048',
    customerId: 'c-globex',
    date: iso(9, 15),
    repId: 'u-rep',
    repName: 'Alex Rivera',
    status: 'confirmed',
    currency: 'EUR',
    region: 'EMEA',
    terms: 'Net 45',
    priceListId: 'pl-eur',
    lines: [
      {
        id: 'l-1048-1',
        productId: 'p-sensor',
        productName: 'Industrial Sensor Array',
        category: 'Hardware',
        qty: 3,
        price: 12500,
        discountPercent: 9,
        comment: '',
      },
      {
        id: 'l-1048-2',
        productId: 'p-spares',
        productName: 'Spare Parts Kit',
        category: 'Hardware',
        qty: 6,
        price: 2100,
        discountPercent: 5,
        comment: '',
      },
    ],
  })

  db.quotations = [q1042, q1043, q1044, q1045, q1046, q1047, q1048]

  db.approvals = [
    {
      id: 'a-1042',
      quotationId: 'q-1042',
      status: 'pending',
      stage: 'sales_manager',
      assignedTo: 'Jordan Chen',
      assignedRole: 'manager',
      daysPending: 2,
      auditLog: [
        {
          user: 'Alex Rivera',
          userId: 'u-rep',
          action: 'Submitted',
          date: iso(2, 14),
          note: 'Gold account — requested aggressive hardware discount to close this quarter.',
        },
      ],
    },
    {
      id: 'a-1045',
      quotationId: 'q-1045',
      status: 'pending',
      stage: 'sales_manager',
      assignedTo: 'Jordan Chen',
      assignedRole: 'manager',
      daysPending: 1,
      auditLog: [
        {
          user: 'Alex Rivera',
          userId: 'u-rep',
          action: 'Submitted',
          date: iso(2, 16),
          note: 'Sent to Acme for review.',
        },
        {
          user: 'Riley Hart',
          userId: 'u-cust1',
          action: 'Negotiation',
          date: iso(1, 9),
          note: 'Customer requested 19% on sensors and delivery by 12 Oct 2026.',
        },
      ],
    },
    {
      id: 'a-1047',
      quotationId: 'q-1047',
      status: 'pending',
      stage: 'finance',
      assignedTo: 'Sam Patel',
      assignedRole: 'finance',
      daysPending: 4,
      auditLog: [
        {
          user: 'Alex Rivera',
          userId: 'u-rep',
          action: 'Submitted',
          date: iso(6, 8),
          note: 'Services-heavy deal for APAC gold account.',
        },
        {
          user: 'Jordan Chen',
          userId: 'u-mgr',
          action: 'Approved',
          date: iso(4, 11),
          note: 'Commercial fit is sound. Routing to Finance for blended-high review.',
        },
      ],
    },
    {
      id: 'a-1044',
      quotationId: 'q-1044',
      status: 'approved',
      stage: 'confirmed',
      assignedTo: '—',
      assignedRole: 'none',
      daysPending: 0,
      auditLog: [
        {
          user: 'Alex Rivera',
          userId: 'u-rep',
          action: 'Submitted',
          date: iso(12, 9),
          note: 'Within policy.',
        },
        {
          user: 'System',
          userId: 'system',
          action: 'Auto-approved',
          date: iso(12, 9),
          note: 'All lines within tier and category limits.',
        },
      ],
    },
  ]

  db.fulfillment = [
    {
      id: 'f-1046',
      quotationId: 'q-1046',
      orderNumber: 'SO-1046',
      customerId: 'c-stark',
      customerName: 'Stark Manufacturing',
      status: 'split_pending',
      warehouse: 'West DC',
      lines: [
        {
          productId: 'p-gateway',
          productName: 'Edge Gateway Pro',
          qty: 12,
          suggested: [
            { warehouse: 'West DC', qtyFulfilled: 0, estShipments: 1, cost: 210, available: 0 },
            { warehouse: 'East DC', qtyFulfilled: 8, estShipments: 1, cost: 340, available: 12 },
            { warehouse: 'Central DC', qtyFulfilled: 4, estShipments: 1, cost: 180, available: 13 },
          ],
        },
        {
          productId: 'p-install',
          productName: 'Onsite Installation',
          qty: 3,
          suggested: [
            { warehouse: 'Services desk', qtyFulfilled: 3, estShipments: 1, cost: 0, available: 99 },
          ],
        },
      ],
    },
    {
      id: 'f-1048',
      quotationId: 'q-1048',
      orderNumber: 'SO-1048',
      customerId: 'c-globex',
      customerName: 'Globex Industries',
      status: 'backorder',
      warehouse: 'East DC',
      lines: [
        {
          productId: 'p-sensor',
          productName: 'Industrial Sensor Array',
          qty: 3,
          suggested: [
            { warehouse: 'East DC', qtyFulfilled: 2, estShipments: 1, cost: 120, available: 34 },
            { warehouse: 'Central DC', qtyFulfilled: 1, estShipments: 1, cost: 95, available: 25 },
          ],
        },
        {
          productId: 'p-spares',
          productName: 'Spare Parts Kit',
          qty: 6,
          suggested: [
            { warehouse: 'East DC', qtyFulfilled: 6, estShipments: 1, cost: 80, available: 56 },
          ],
        },
      ],
    },
    {
      id: 'f-1044',
      quotationId: 'q-1044',
      orderNumber: 'SO-1044',
      customerId: 'c-initech',
      customerName: 'Initech',
      status: 'ready',
      warehouse: 'East DC',
      lines: [
        {
          productId: 'p-spares',
          productName: 'Spare Parts Kit',
          qty: 10,
          suggested: [
            { warehouse: 'East DC', qtyFulfilled: 10, estShipments: 1, cost: 90, available: 56 },
          ],
        },
      ],
    },
  ]

  db.subscriptions = [
    {
      id: 's-1',
      customerId: 'c-acme',
      customerName: 'Acme Corp',
      plan: 'Predictive Maintenance Suite',
      cycle: 'annual',
      nextBill: '2026-10-01',
      amount: 24000,
      status: 'active',
      originatingOrderId: 'q-1042',
      oneTimeLines: [
        { productName: 'Industrial Sensor Array', qty: 6, amount: 58500 },
        { productName: 'Onsite Installation', qty: 2, amount: 8550 },
      ],
      recurringLines: [
        { plan: 'Predictive Maintenance Suite', cycle: 'annual', nextBillDate: '2026-10-01', amount: 19200 },
      ],
    },
    {
      id: 's-2',
      customerId: 'c-acme',
      customerName: 'Acme Corp',
      plan: '24/7 Support Retainer',
      cycle: 'annual',
      nextBill: '2026-11-15',
      amount: 18000,
      status: 'active',
      originatingOrderId: 'q-1045',
      oneTimeLines: [{ productName: 'Industrial Sensor Array', qty: 8, amount: 84000 }],
      recurringLines: [
        { plan: '24/7 Support Retainer', cycle: 'annual', nextBillDate: '2026-11-15', amount: 16200 },
      ],
    },
    {
      id: 's-3',
      customerId: 'c-stark',
      customerName: 'Stark Manufacturing',
      plan: 'Predictive Maintenance Suite',
      cycle: 'quarterly',
      nextBill: '2026-09-30',
      amount: 6000,
      status: 'paused',
      originatingOrderId: 'q-1046',
      oneTimeLines: [{ productName: 'Edge Gateway Pro', qty: 12, amount: 98256 }],
      recurringLines: [
        { plan: 'Predictive Maintenance Suite', cycle: 'quarterly', nextBillDate: '2026-09-30', amount: 6000 },
      ],
    },
    {
      id: 's-4',
      customerId: 'c-initech',
      customerName: 'Initech',
      plan: '24/7 Support Retainer',
      cycle: 'annual',
      nextBill: '2026-01-12',
      amount: 18000,
      status: 'cancelled',
      originatingOrderId: 'q-1044',
      oneTimeLines: [{ productName: 'Spare Parts Kit', qty: 10, amount: 20160 }],
      recurringLines: [
        { plan: '24/7 Support Retainer', cycle: 'annual', nextBillDate: '—', amount: 0 },
      ],
    },
  ]

  db.invoices = [
    {
      id: 'inv-2201',
      number: 'INV-2201',
      customerId: 'c-stark',
      customerName: 'Stark Manufacturing',
      amount: 98256,
      status: 'unpaid',
      dueDate: '2026-09-20',
      step: 'invoiced',
      note: 'Partial delivery: 8 of 12 gateways shipped from East DC. Remainder on split shipment — invoice reflects shipped quantity plus committed install.',
      lines: [{ number: 'INV-2201', amount: 98256, status: 'unpaid', dueDate: '2026-09-20' }],
    },
    {
      id: 'inv-2198',
      number: 'INV-2198',
      customerId: 'c-globex',
      customerName: 'Globex Industries',
      amount: 44100,
      status: 'paid',
      dueDate: '2026-08-30',
      step: 'paid',
      note: 'Delivery and invoice quantities match. No reconciliation exception.',
      lines: [{ number: 'INV-2198', amount: 44100, status: 'paid', dueDate: '2026-08-30' }],
    },
    {
      id: 'inv-2194',
      number: 'INV-2194',
      customerId: 'c-initech',
      customerName: 'Initech',
      amount: 20160,
      status: 'unpaid',
      dueDate: '2026-09-02',
      step: 'invoiced',
      note: 'Overdue. Delivery complete; payment not yet recorded.',
      lines: [{ number: 'INV-2194', amount: 20160, status: 'unpaid', dueDate: '2026-09-02' }],
    },
    {
      id: 'inv-2188',
      number: 'INV-2188',
      customerId: 'c-acme',
      customerName: 'Acme Corp',
      amount: 19200,
      status: 'paid',
      dueDate: '2026-08-01',
      step: 'paid',
      note: 'Recurring line invoiced at start of billing period.',
      lines: [{ number: 'INV-2188', amount: 19200, status: 'paid', dueDate: '2026-08-01' }],
    },
  ]

  db.dealHealth = [
    {
      id: 'dh-1',
      deal: 'Q-1047 Umbrella LLC',
      quotationId: 'q-1047',
      issue: 'Stalled in Finance approval (4 days)',
      flagged: iso(1, 8),
      type: 'stalled',
    },
    {
      id: 'dh-2',
      deal: 'Q-1042 Acme Corp',
      quotationId: 'q-1042',
      issue: 'Hardware discount 7pts over category ceiling',
      flagged: iso(2, 14),
      type: 'anomaly',
    },
    {
      id: 'dh-3',
      deal: 'SO-1048 Globex Industries',
      quotationId: 'q-1048',
      issue: 'Delivery slippage — backorder on sensors',
      flagged: iso(0, 7),
      type: 'slippage',
    },
    {
      id: 'dh-4',
      deal: 'Q-1045 Acme Corp',
      quotationId: 'q-1045',
      issue: 'Customer negotiation open > 24h',
      flagged: iso(1, 9),
      type: 'stalled',
    },
  ]

  db.portalMessages = [
    {
      id: 'm-1',
      customerId: 'c-acme',
      quotationId: 'q-1045',
      from: 'Riley Hart',
      body: 'Can you move delivery to mid-October and improve the sensor discount?',
      date: iso(1, 9),
    },
    {
      id: 'm-2',
      customerId: 'c-acme',
      quotationId: 'q-1045',
      from: 'Alex Rivera',
      body: 'Logged. Pricing is with our sales manager — you will see an updated quote shortly.',
      date: iso(1, 10),
    },
  ]

  db.activity = [
    { id: 'act-1', text: 'Acme Corp quotation Q-1042 submitted for approval (blended HIGH)', timestamp: iso(2, 14) },
    { id: 'act-2', text: 'Riley Hart opened negotiation on Q-1045', timestamp: iso(1, 9) },
    { id: 'act-3', text: 'Jordan Chen approved Q-1047 — routed to Finance', timestamp: iso(4, 11) },
    { id: 'act-4', text: 'Initech quotation Q-1044 auto-approved (within limits)', timestamp: iso(12, 9) },
    { id: 'act-5', text: 'Stark Manufacturing order SO-1046 flagged split-pending at West DC', timestamp: iso(3, 12) },
    { id: 'act-6', text: 'Invoice INV-2198 marked paid — Globex Industries', timestamp: iso(5, 16) },
  ]
}

seed()

export function listItem(q) {
  return {
    id: q.id,
    number: q.number,
    customerId: q.customerId,
    customerName: q.customerName,
    date: q.date,
    amount: q.amount,
    repName: q.repName,
    status: q.status,
    riskLevel: q.riskLevel,
    riskScore: q.riskScore,
    blendedRisk: q.blendedRisk,
    customerTier: q.customerTier,
  }
}

export function approvalDetail(approval) {
  const q = db.quotations.find((x) => x.id === approval.quotationId)
  computeQuotationRisk(q)
  return {
    ...approval,
    quotation: q,
    customerName: q.customerName,
    customerTier: q.customerTier,
    blendedRisk: q.blendedRisk,
    riskLevel: q.riskLevel,
    riskScore: q.riskScore,
    flagReasons: q.flagReasons,
    amount: q.amount,
  }
}

export function nextId(prefix, list) {
  return `${prefix}-${Date.now().toString(36)}`
}

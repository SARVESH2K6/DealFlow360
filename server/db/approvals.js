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


// ── Fulfillment creation ─────────────────────────────────────────────

const CITY_COORDS = {
  'Mumbai': { lat: 19.0760, lon: 72.8777 },
  'Rajkot': { lat: 22.3039, lon: 70.8022 },
  'Ahmedabad': { lat: 23.0225, lon: 72.5714 },
  'Jodhpur': { lat: 26.2389, lon: 73.0243 },
  'Anand': { lat: 22.5645, lon: 72.9289 },
  'Pune': { lat: 18.5204, lon: 73.8567 },
  'Surat': { lat: 21.1702, lon: 72.8311 },
  'Nagpur': { lat: 21.1458, lon: 79.0882 },
  'Vadodara': { lat: 22.3072, lon: 73.1812 },
  'Gandhinagar': { lat: 23.2156, lon: 72.6369 }
};

function getDistanceHaversine(lat1, lon1, lat2, lon2) {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

async function getRoutingDistance(city1, city2) {
  const c1 = CITY_COORDS[city1];
  const c2 = CITY_COORDS[city2];
  if (!c1 || !c2) return 9999;
  
  try {
    const url = `http://router.project-osrm.org/route/v1/driving/${c1.lon},${c1.lat};${c2.lon},${c2.lat}?overview=false`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.routes && data.routes.length > 0) {
      return data.routes[0].distance / 1000;
    }
  } catch (err) {
    console.error("OSRM fetch error, falling back to Haversine", err);
  }
  return getDistanceHaversine(c1.lat, c1.lon, c2.lat, c2.lon);
}

async function calculateEstimatedDelivery(quotationId) {
  const { rows: qRows } = await query('SELECT * FROM quotations WHERE id = $1', [quotationId])
  if (qRows.length === 0) return 0
  const q = qRows[0]
  
  const { rows: custRows } = await query('SELECT city FROM customers WHERE id = $1', [q.customer_id])
  const customerCity = custRows[0]?.city || 'Ahmedabad'

  const { rows: lineRows } = await query('SELECT * FROM quotation_lines WHERE quotation_id = $1', [quotationId])
  
  let totalEstimatedCost = 0;
  for (const l of lineRows) {
    if (l.category === 'Services') continue;
    
    const { rows: stockRows } = await query(
      'SELECT warehouse, (in_stock - reserved) AS available FROM stock WHERE product_id = $1 AND (in_stock - reserved) > 0',
      [l.product_id]
    )

    const warehouses = [];
    for (const w of stockRows) {
      const distance = await getRoutingDistance(w.warehouse, customerCity);
      warehouses.push({ warehouse: w.warehouse, available: Number(w.available), distance });
    }

    warehouses.sort((a, b) => {
      if (a.distance !== b.distance) return a.distance - b.distance;
      return b.available - a.available;
    });

    let remainingQty = Number(l.qty);
    for (const w of warehouses) {
      if (remainingQty <= 0) break;
      const take = Math.min(remainingQty, w.available);
      const costPerKm = 0.5;
      const cost = Math.round(w.distance * costPerKm);
      totalEstimatedCost += cost; // Note: this cost is per split line, same as the actual algorithm!
      remainingQty -= take;
    }
  }

  await query('UPDATE quotations SET estimated_delivery_cost = $1 WHERE id = $2', [totalEstimatedCost, quotationId]);
  return totalEstimatedCost;
}

async function createFulfillmentFromQuote(quotationId) {
  const { rows: existing } = await query('SELECT id FROM fulfillment_orders WHERE quotation_id = $1', [quotationId])
  if (existing.length > 0) return

  const { rows: qRows } = await query('SELECT * FROM quotations WHERE id = $1', [quotationId])
  const q = qRows[0]
  const { rows: lineRows } = await query('SELECT * FROM quotation_lines WHERE quotation_id = $1', [quotationId])

  const fId = nextId('f')
  await query(
    `INSERT INTO fulfillment_orders (id, quotation_id, order_number, customer_id, customer_name, status, warehouse)
     VALUES ($1, $2, $3, $4, $5, 'ready', 'Multiple')`,
    [fId, quotationId, q.number.replace('Q-', 'SO-'), q.customer_id, q.customer_name],
  )

  const { rows: custRows } = await query('SELECT city FROM customers WHERE id = $1', [q.customer_id])
  const customerCity = custRows[0]?.city || 'Ahmedabad'

  for (const l of lineRows) {
    const { rows: flRows } = await query(
      'INSERT INTO fulfillment_lines (fulfillment_id, product_id, product_name, qty) VALUES ($1, $2, $3, $4) RETURNING id',
      [fId, l.product_id, l.product_name, Number(l.qty)],
    )
    const flId = flRows[0].id

    if (l.category === 'Services') {
      await query(
        'INSERT INTO fulfillment_suggested (fulfillment_line_id, warehouse, qty_fulfilled, est_shipments, cost, available) VALUES ($1, $2, $3, 1, 0, 20)',
        [flId, 'Services desk', Number(l.qty)],
      )
      continue
    }

    const { rows: stockRows } = await query(
      'SELECT warehouse, (in_stock - reserved) AS available FROM stock WHERE product_id = $1 AND (in_stock - reserved) > 0',
      [l.product_id]
    )

    const warehouses = [];
    for (const w of stockRows) {
      const distance = await getRoutingDistance(w.warehouse, customerCity);
      warehouses.push({ warehouse: w.warehouse, available: Number(w.available), distance });
    }

    warehouses.sort((a, b) => {
      if (a.distance !== b.distance) return a.distance - b.distance;
      return b.available - a.available;
    });

    let remainingQty = Number(l.qty);
    for (const w of warehouses) {
      if (remainingQty <= 0) break;
      const take = Math.min(remainingQty, w.available);
      
      const costPerKm = 0.5;
      const cost = Math.round(w.distance * costPerKm);

      await query(
        'INSERT INTO fulfillment_suggested (fulfillment_line_id, warehouse, qty_fulfilled, est_shipments, cost, available) VALUES ($1, $2, $3, 1, $4, $5)',
        [flId, w.warehouse, take, cost, w.available],
      )
      remainingQty -= take;
      
      await query(
        'UPDATE stock SET reserved = reserved + $1 WHERE warehouse = $2 AND product_id = $3',
        [take, w.warehouse, l.product_id]
      )
    }

    if (remainingQty > 0) {
       await query(
        'INSERT INTO fulfillment_suggested (fulfillment_line_id, warehouse, qty_fulfilled, est_shipments, cost, available) VALUES ($1, $2, $3, 0, 0, 0)',
        [flId, 'Backorder', remainingQty],
      )
    }
  }
}

export { createFulfillmentFromQuote, calculateEstimatedDelivery }

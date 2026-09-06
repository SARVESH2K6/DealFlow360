import { query } from './pool.js'
import { nextId, httpError } from './helpers.js'

async function logActivityDb(text) {
  const id = `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  await query('INSERT INTO activity (id, text, timestamp) VALUES ($1, $2, $3)', [id, text, new Date().toISOString()])
}

function remainingBackorderQty(lines) {
  return lines.reduce((sum, line) => {
    const filled = (line.suggested || []).reduce((n, row) => n + Number(row.qtyFulfilled || 0), 0)
    return sum + Math.max(0, Number(line.qty) - filled)
  }, 0)
}

async function productAvailability(productId) {
  const { rows } = await query(
    'SELECT warehouse, in_stock, reserved FROM stock WHERE product_id = $1 ORDER BY (in_stock - reserved) DESC',
    [productId],
  )
  return rows.map((s) => ({
    warehouse: s.warehouse,
    inStock: Number(s.in_stock),
    reserved: Number(s.reserved),
    available: Math.max(0, Number(s.in_stock) - Number(s.reserved)),
  }))
}

async function canConsolidateOrder(order) {
  if (!order || order.status !== 'backorder') return false
  if (remainingBackorderQty(order.lines) <= 0) return false
  for (const line of order.lines) {
    const filled = line.suggested.reduce((n, row) => n + Number(row.qtyFulfilled || 0), 0)
    const remaining = Math.max(0, line.qty - filled)
    if (remaining === 0) continue
    const stock = await productAvailability(line.productId)
    const available = stock.reduce((n, s) => n + s.available, 0)
    if (available < remaining) return false
  }
  return true
}

function withMeta(order, canConsolidate, remainingQty) {
  return { ...order, canConsolidate, remainingQty }
}

export async function listFulfillment() {
  const { rows: stockRows } = await query('SELECT * FROM stock')
  const stock = stockRows.map((s) => ({
    warehouse: s.warehouse,
    productId: s.product_id,
    productName: s.product_name,
    inStock: Number(s.in_stock),
    reserved: Number(s.reserved),
    available: Math.max(0, Number(s.in_stock) - Number(s.reserved)),
  }))

  const { rows: orderRows } = await query('SELECT * FROM fulfillment_orders ORDER BY order_number')
  const orders = []
  for (const f of orderRows) {
    const detail = await getFulfillmentOrder(f.id)
    if (!detail) continue
    orders.push({
      id: detail.id,
      orderNumber: detail.orderNumber,
      customerName: detail.customerName,
      status: detail.status,
      warehouse: detail.warehouse,
      canConsolidate: detail.canConsolidate,
      remainingQty: detail.remainingQty,
    })
  }

  return { stock, orders }
}

export async function getFulfillmentOrder(id) {
  const { rows } = await query('SELECT * FROM fulfillment_orders WHERE id = $1', [id])
  if (rows.length === 0) return null
  const f = rows[0]

  const { rows: lineRows } = await query('SELECT * FROM fulfillment_lines WHERE fulfillment_id = $1', [id])
  const lines = []
  for (const l of lineRows) {
    const { rows: sugRows } = await query('SELECT * FROM fulfillment_suggested WHERE fulfillment_line_id = $1', [l.id])
    lines.push({
      id: l.id,
      productId: l.product_id,
      productName: l.product_name,
      qty: Number(l.qty),
      suggested: sugRows.map((s) => ({
        warehouse: s.warehouse,
        qtyFulfilled: Number(s.qty_fulfilled),
        estShipments: Number(s.est_shipments),
        cost: Number(s.cost),
        available: Number(s.available),
      })),
    })
  }

  const order = {
    id: f.id,
    quotationId: f.quotation_id,
    orderNumber: f.order_number,
    customerId: f.customer_id,
    customerName: f.customer_name,
    status: f.status,
    warehouse: f.warehouse,
    lines,
    splitAccepted: f.split_accepted,
    overridden: f.overridden,
  }
  const remainingQty = remainingBackorderQty(lines)
  const canConsolidate = await canConsolidateOrder(order)
  return withMeta(order, canConsolidate, remainingQty)
}

export async function createFulfillmentFromQuote(quotationId) {
  const { rows: existing } = await query('SELECT id FROM fulfillment_orders WHERE quotation_id = $1', [quotationId])
  if (existing.length > 0) return getFulfillmentOrder(existing[0].id)

  const { rows: qRows } = await query('SELECT * FROM quotations WHERE id = $1', [quotationId])
  if (qRows.length === 0) return null
  const q = qRows[0]
  const { rows: lineRows } = await query('SELECT * FROM quotation_lines WHERE quotation_id = $1', [quotationId])

  const fId = nextId('f')
  let status = 'ready'
  let primaryWarehouse = 'East DC'
  const planned = []

  for (const l of lineRows) {
    const qty = Number(l.qty)
    if (l.category === 'Services') {
      planned.push({
        productId: l.product_id,
        productName: l.product_name,
        qty,
        suggested: [
          { warehouse: 'Services desk', qtyFulfilled: qty, estShipments: 1, cost: 0, available: qty },
        ],
      })
      continue
    }

    const stock = await productAvailability(l.product_id)
    const totalAvail = stock.reduce((n, s) => n + s.available, 0)
    let remaining = qty
    const suggested = []
    for (const s of stock) {
      if (remaining <= 0) break
      const take = Math.min(remaining, s.available)
      if (take <= 0) continue
      suggested.push({
        warehouse: s.warehouse,
        qtyFulfilled: take,
        estShipments: 1,
        cost: 120,
        available: s.available,
      })
      await query(
        'UPDATE stock SET reserved = reserved + $1 WHERE warehouse = $2 AND product_id = $3',
        [take, s.warehouse, l.product_id],
      )
      remaining -= take
    }

    if (remaining > 0) status = 'backorder'
    else if (suggested.length > 1 && status === 'ready') status = 'split_pending'

    if (suggested[0]) primaryWarehouse = suggested[0].warehouse
    planned.push({ productId: l.product_id, productName: l.product_name, qty, suggested })
  }

  await query(
    `INSERT INTO fulfillment_orders (id, quotation_id, order_number, customer_id, customer_name, status, warehouse)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [fId, quotationId, q.number.replace('Q-', 'SO-'), q.customer_id, q.customer_name, status, primaryWarehouse],
  )

  for (const line of planned) {
    const { rows: flRows } = await query(
      'INSERT INTO fulfillment_lines (fulfillment_id, product_id, product_name, qty) VALUES ($1, $2, $3, $4) RETURNING id',
      [fId, line.productId, line.productName, line.qty],
    )
    const flId = flRows[0].id
    for (const s of line.suggested) {
      await query(
        'INSERT INTO fulfillment_suggested (fulfillment_line_id, warehouse, qty_fulfilled, est_shipments, cost, available) VALUES ($1, $2, $3, $4, $5, $6)',
        [flId, s.warehouse, s.qtyFulfilled, s.estShipments, s.cost, s.available],
      )
    }
  }

  return getFulfillmentOrder(fId)
}

export async function acceptSplit(id, userName) {
  const order = await getFulfillmentOrder(id)
  if (!order) return null
  await query("UPDATE fulfillment_orders SET status = 'ready', split_accepted = true WHERE id = $1", [id])
  await logActivityDb(`${order.orderNumber} split shipment accepted by ${userName}`)
  return getFulfillmentOrder(id)
}

export async function overrideFulfillment(id, body, userName) {
  const order = await getFulfillmentOrder(id)
  if (!order) return null
  if (!Array.isArray(body?.lines) || body.lines.length === 0) {
    throw httpError(400, 'Override must include fulfillment lines')
  }

  for (const incoming of body.lines) {
    const match = order.lines.find((l) => l.productId === incoming.productId) || order.lines[0]
    const orderedQty = Number(incoming.qty ?? match?.qty)
    if (!Number.isFinite(orderedQty) || orderedQty < 1) {
      throw httpError(400, 'Each line quantity must be at least 1')
    }
    const suggested = Array.isArray(incoming.suggested) ? incoming.suggested : match?.suggested || []
    let filled = 0
    for (const s of suggested) {
      const q = Number(s.qtyFulfilled)
      if (!Number.isFinite(q) || q < 0) {
        throw httpError(400, 'Fulfilled quantity cannot be negative')
      }
      filled += q
    }
    if (filled !== orderedQty) {
      throw httpError(400, `Override quantities must sum to the ordered amount (${orderedQty})`)
    }
  }

  await query('UPDATE fulfillment_orders SET status = $1, overridden = true WHERE id = $2', [body.status || 'ready', id])
  await query('DELETE FROM fulfillment_suggested WHERE fulfillment_line_id IN (SELECT id FROM fulfillment_lines WHERE fulfillment_id = $1)', [id])
  await query('DELETE FROM fulfillment_lines WHERE fulfillment_id = $1', [id])
  for (const l of body.lines) {
    const { rows } = await query(
      'INSERT INTO fulfillment_lines (fulfillment_id, product_id, product_name, qty) VALUES ($1, $2, $3, $4) RETURNING id',
      [id, l.productId, l.productName, l.qty],
    )
    if (Array.isArray(l.suggested)) {
      for (const s of l.suggested) {
        await query(
          'INSERT INTO fulfillment_suggested (fulfillment_line_id, warehouse, qty_fulfilled, est_shipments, cost, available) VALUES ($1, $2, $3, $4, $5, $6)',
          [rows[0].id, s.warehouse, s.qtyFulfilled, s.estShipments ?? 1, s.cost ?? 0, s.available ?? 0],
        )
      }
    }
  }
  await logActivityDb(`${order.orderNumber} inventory override by ${userName}`)
  return getFulfillmentOrder(id)
}

export async function consolidateBackorder(id, userName) {
  const order = await getFulfillmentOrder(id)
  if (!order) return null
  if (!(await canConsolidateOrder(order))) {
    throw httpError(400, 'Remaining backorder cannot be consolidated yet')
  }

  for (const line of order.lines) {
    let remaining = line.qty - line.suggested.reduce((n, row) => n + Number(row.qtyFulfilled || 0), 0)
    if (remaining <= 0) continue
    const stock = await productAvailability(line.productId)
    for (const s of stock) {
      if (remaining <= 0) break
      const take = Math.min(remaining, s.available)
      if (take <= 0) continue
      const existing = line.suggested.find((r) => r.warehouse === s.warehouse)
      if (existing) {
        await query(
          'UPDATE fulfillment_suggested SET qty_fulfilled = qty_fulfilled + $1, available = $2 WHERE fulfillment_line_id = $3 AND warehouse = $4',
          [take, s.available - take, line.id, s.warehouse],
        )
      } else {
        await query(
          'INSERT INTO fulfillment_suggested (fulfillment_line_id, warehouse, qty_fulfilled, est_shipments, cost, available) VALUES ($1, $2, $3, 1, 120, $4)',
          [line.id, s.warehouse, take, s.available - take],
        )
      }
      await query(
        'UPDATE stock SET reserved = reserved + $1 WHERE warehouse = $2 AND product_id = $3',
        [take, s.warehouse, line.productId],
      )
      remaining -= take
    }
  }

  await query("UPDATE fulfillment_orders SET status = 'ready' WHERE id = $1", [id])
  await logActivityDb(`${order.orderNumber} remaining backorder consolidated by ${userName}`)
  return getFulfillmentOrder(id)
}

import { query } from './pool.js'

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
  const orders = orderRows.map((f) => ({
    id: f.id,
    orderNumber: f.order_number,
    customerName: f.customer_name,
    status: f.status,
    warehouse: f.warehouse,
  }))

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

  let estimatedDeliveryCost = 0
  let finalDeliveryCost = 0
  if (f.quotation_id) {
    const { rows: qRows } = await query('SELECT estimated_delivery_cost, final_delivery_cost FROM quotations WHERE id = $1', [f.quotation_id])
    if (qRows.length > 0) {
      estimatedDeliveryCost = Number(qRows[0].estimated_delivery_cost)
      finalDeliveryCost = Number(qRows[0].final_delivery_cost)
    }
  }

  return {
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
    estimatedDeliveryCost,
    finalDeliveryCost,
  }
}

export async function acceptSplit(id, userName) {
  await query("UPDATE fulfillment_orders SET status = 'ready', split_accepted = true WHERE id = $1", [id])
  const logId = `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  const { rows } = await query('SELECT order_number, quotation_id FROM fulfillment_orders WHERE id = $1', [id])
  const orderInfo = rows[0]
  await query('INSERT INTO activity (id, text, timestamp) VALUES ($1, $2, $3)', [logId, `${orderInfo?.order_number} split shipment accepted by ${userName}`, new Date().toISOString()])
  
  if (orderInfo?.quotation_id) {
    const { rows: sumRows } = await query(`
      SELECT COALESCE(SUM(fs.cost), 0) as total_cost 
      FROM fulfillment_suggested fs
      JOIN fulfillment_lines fl ON fs.fulfillment_line_id = fl.id
      WHERE fl.fulfillment_id = $1
    `, [id])
    await query('UPDATE quotations SET final_delivery_cost = $1 WHERE id = $2', [sumRows[0].total_cost, orderInfo.quotation_id])
  }

  return getFulfillmentOrder(id)
}

export async function overrideFulfillment(id, body, userName) {
  await query('UPDATE fulfillment_orders SET status = $1, overridden = true WHERE id = $2', [body.status || 'ready', id])
  // If lines provided, replace them
  if (Array.isArray(body.lines)) {
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
            [rows[0].id, s.warehouse, s.qtyFulfilled, s.estShipments, s.cost, s.available],
          )
        }
      }
    }
  }
  const logId = `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  const { rows } = await query('SELECT order_number, quotation_id FROM fulfillment_orders WHERE id = $1', [id])
  const orderInfo = rows[0]
  await query('INSERT INTO activity (id, text, timestamp) VALUES ($1, $2, $3)', [logId, `${orderInfo?.order_number} inventory override by ${userName}`, new Date().toISOString()])
  
  if (orderInfo?.quotation_id) {
    const { rows: sumRows } = await query(`
      SELECT COALESCE(SUM(fs.cost), 0) as total_cost 
      FROM fulfillment_suggested fs
      JOIN fulfillment_lines fl ON fs.fulfillment_line_id = fl.id
      WHERE fl.fulfillment_id = $1
    `, [id])
    await query('UPDATE quotations SET final_delivery_cost = $1 WHERE id = $2', [sumRows[0].total_cost, orderInfo.quotation_id])
  }

  return getFulfillmentOrder(id)
}

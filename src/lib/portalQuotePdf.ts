import { jsPDF } from 'jspdf'
import type { PortalQuote } from './types'
import { formatDate, moneyExact } from './format'

const SHEET: [number, number, number] = [251, 246, 236]
const INK: [number, number, number] = [26, 26, 24]
const MUTED: [number, number, number] = [94, 88, 78]
const FAINT: [number, number, number] = [142, 135, 122]
const BRONZE: [number, number, number] = [176, 137, 72]
const COMMIT: [number, number, number] = [15, 61, 46]

function line(doc: jsPDF, y: number, color = BRONZE, width = 0.35) {
  doc.setDrawColor(...color)
  doc.setLineWidth(width)
  doc.line(18, y, 192, y)
}

export function downloadPortalQuotePdf(quote: PortalQuote): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const subtotal = quote.lines.reduce((s, l) => s + l.qty * l.price, 0)
  const net = quote.lines.reduce((s, l) => s + l.amount, 0)
  const discount = subtotal - net
  const tax = quote.lines.reduce((s, l) => s + l.amount * (l.taxPercent / 100), 0)
  const total = net + tax

  doc.setFillColor(...SHEET)
  doc.rect(0, 0, 210, 297, 'F')
  doc.setDrawColor(...BRONZE)
  doc.setLineWidth(0.35)
  doc.line(18, 16, 192, 16)
  doc.line(18, 17.6, 192, 17.6)

  doc.setFont('times', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(...COMMIT)
  doc.text('DealFlow360', 18, 28)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...BRONZE)
  doc.text('CUSTOMER QUOTE', 18, 34)

  doc.setFont('times', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(...INK)
  doc.text(quote.number, 192, 28, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...MUTED)
  doc.text(moneyExact(total, quote.currency), 192, 35, { align: 'right' })

  line(doc, 42, INK, 0.15)

  doc.setFont('times', 'bold')
  doc.setFontSize(20)
  doc.setTextColor(...INK)
  doc.text(`Quote for ${quote.customerName}`, 18, 54)

  const meta = [
    ['Prepared by', quote.repName],
    ['Date', formatDate(quote.date)],
    ['Terms', quote.terms],
    ['Delivery', quote.requestedDeliveryDate ? formatDate(quote.requestedDeliveryDate) : '—'],
  ]
  let y = 62
  for (const [label, value] of meta) {
    if (!label || !value) continue
    y += 7
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...MUTED)
    doc.text(label, 18, y)
    doc.setFont('times', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...INK)
    doc.text(value, 192, y, { align: 'right' })
  }

  y += 12
  doc.setFont('times', 'bold')
  doc.setFontSize(14)
  doc.text('Line items', 18, y)
  y += 3
  line(doc, y)
  y += 8
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...MUTED)
  doc.text('PRODUCT', 18, y)
  doc.text('QTY', 118, y)
  doc.text('UNIT', 142, y)
  doc.text('TOTAL', 192, y, { align: 'right' })

  for (const item of quote.lines) {
    y += 8
    line(doc, y, INK, 0.12)
    y += 7
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...INK)
    doc.text(item.productName, 18, y)
    doc.setFont('times', 'bold')
    doc.setFontSize(11)
    const unit = item.price * (1 - item.discountPercent / 100)
    doc.text(String(item.qty), 118, y)
    doc.text(moneyExact(unit, quote.currency), 142, y)
    doc.text(moneyExact(item.amount, quote.currency), 192, y, { align: 'right' })
    if (item.description) {
      y += 5
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(...MUTED)
      const wrapped = doc.splitTextToSize(item.description, 90)
      doc.text(wrapped, 18, y)
      y += Math.max(0, wrapped.length - 1) * 3.5
    }
  }

  y += 10
  line(doc, y, INK, 0.2)
  const totals: [string, string][] = [
    ['Subtotal', moneyExact(subtotal, quote.currency)],
    ['Discount', `−${moneyExact(discount, quote.currency)}`],
    ['Tax', moneyExact(tax, quote.currency)],
    ['Total', moneyExact(total, quote.currency)],
  ]
  for (const [label, value] of totals) {
    if (!label || !value) continue
    y += 8
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...MUTED)
    doc.text(label, 120, y)
    doc.setFont('times', 'bold')
    doc.setFontSize(label === 'Total' ? 14 : 11)
    doc.setTextColor(...INK)
    doc.text(value, 192, y, { align: 'right' })
  }

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...FAINT)
  doc.text('DealFlow360  ·  confidential customer copy', 18, 282)
  doc.save(`${quote.number}.pdf`)
}

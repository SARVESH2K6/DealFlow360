import { jsPDF } from 'jspdf'
import type { Invoice } from './types'
import { formatDate, moneyExact, roleLabel } from './format'

const SHEET: [number, number, number] = [251, 246, 236]
const INK: [number, number, number] = [26, 26, 24]
const MUTED: [number, number, number] = [94, 88, 78]
const FAINT: [number, number, number] = [142, 135, 122]
const BRONZE: [number, number, number] = [176, 137, 72]
const COMMIT: [number, number, number] = [15, 61, 46]
const OK: [number, number, number] = [31, 122, 69]
const DANGER: [number, number, number] = [194, 48, 40]

function line(doc: jsPDF, y: number, color = BRONZE, width = 0.35) {
  doc.setDrawColor(...color)
  doc.setLineWidth(width)
  doc.line(18, y, 192, y)
}

export function downloadInvoicePdf(invoice: Invoice): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const paid = invoice.status === 'paid'
  const items = invoice.items ?? []

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
  doc.text('PRIVATE OPERATIONS LEDGER', 18, 34)

  doc.setFontSize(8)
  doc.text('STATEMENT', 192, 26, { align: 'right' })
  doc.setFont('times', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(...INK)
  doc.text(invoice.number, 192, 34, { align: 'right' })

  line(doc, 42, [26, 26, 24], 0.15)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...MUTED)
  doc.text('BILL TO', 18, 52)
  doc.setFont('times', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(...INK)
  doc.text(invoice.customerName, 18, 61)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...MUTED)
  doc.text(`${invoice.region} · ${invoice.terms}`, 18, 68)

  doc.setFontSize(8)
  doc.setTextColor(...(paid ? OK : DANGER))
  doc.text(paid ? 'PAID IN FULL' : 'BALANCE DUE', 192, 52, { align: 'right' })
  doc.setFont('times', 'bold')
  doc.setFontSize(22)
  doc.setTextColor(...INK)
  doc.text(moneyExact(invoice.amount), 192, 62, { align: 'right' })

  const meta = [
    ['Issued', formatDate(invoice.issuedDate)],
    ['Due', formatDate(invoice.dueDate)],
    ['Terms', invoice.terms],
    ['Status', paid ? 'Paid' : 'Unpaid'],
  ]
  let y = 80
  for (const row of meta) {
    const label = row[0]
    const value = row[1]
    if (!label || !value) continue
    line(doc, y, [26, 26, 24], 0.12)
    y += 8
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...MUTED)
    doc.text(label, 18, y)
    doc.setFont('times', 'bold')
    doc.setFontSize(12)
    if (label === 'Status') doc.setTextColor(...(paid ? OK : DANGER))
    else doc.setTextColor(...INK)
    doc.text(value, 192, y, { align: 'right' })
    y += 4
  }

  y += 10
  doc.setFont('times', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(...INK)
  doc.text('Charges', 18, y)
  y += 3
  line(doc, y)
  y += 8

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...MUTED)
  doc.text('DESCRIPTION', 18, y)
  doc.text('QTY', 118, y)
  doc.text('RATE', 142, y)
  doc.text('AMOUNT', 192, y, { align: 'right' })
  y += 3

  for (const item of items) {
    line(doc, y, [26, 26, 24], 0.12)
    y += 8
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...INK)
    doc.text(item.description, 18, y)
    doc.setFont('times', 'bold')
    doc.setFontSize(11)
    doc.text(String(item.qty), 118, y)
    doc.text(moneyExact(item.unitPrice), 142, y)
    doc.text(moneyExact(item.amount), 192, y, { align: 'right' })
    y += 4
  }

  y += 8
  line(doc, y, [26, 26, 24], 0.2)
  y += 10
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...MUTED)
  doc.text('Amount due', 18, y)
  doc.setFont('times', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(...INK)
  doc.text(moneyExact(invoice.amount), 192, y, { align: 'right' })

  if (invoice.note) {
    y += 14
    doc.setFillColor(241, 232, 214)
    const wrapped = doc.splitTextToSize(invoice.note, 160)
    const noteH = Math.max(18, wrapped.length * 4.2 + 8)
    doc.rect(18, y - 5, 174, noteH, 'F')
    doc.setDrawColor(...BRONZE)
    doc.setLineWidth(0.8)
    doc.line(18, y - 5, 18, y - 5 + noteH)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...MUTED)
    doc.text(wrapped, 22, y)
    y += noteH + 8
  } else {
    y += 12
  }

  const approvers = invoice.approvedBy ?? []
  doc.setFont('times', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(...INK)
  doc.text('Approved by', 18, y)
  y += 3
  line(doc, y)
  y += 8

  if (approvers.length === 0) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...MUTED)
    doc.text('No countersignature is on file for this statement.', 18, y)
    y += 8
  } else {
    const colW = approvers.length > 1 ? 80 : 174
    approvers.forEach((person, i) => {
      const x = 18 + (i % 2) * 90
      const rowY = y + Math.floor(i / 2) * 18
      doc.setDrawColor(...INK)
      doc.setLineWidth(0.2)
      doc.line(x, rowY, x + colW, rowY)
      doc.setFont('times', 'bold')
      doc.setFontSize(13)
      doc.setTextColor(...INK)
      doc.text(person.name, x, rowY + 7)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(...BRONZE)
      doc.text((person.roleLabel || roleLabel(person.role)).toUpperCase(), x, rowY + 12)
    })
    y += Math.ceil(approvers.length / 2) * 18
  }

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...FAINT)
  doc.text('This is who signed the deal. Marking an invoice paid does not change this.', 18, y + 6)
  y += 14

  if (paid && invoice.paymentRecordedBy) {
    doc.setFont('times', 'bold')
    doc.setFontSize(14)
    doc.setTextColor(...INK)
    doc.text('Payment recorded by', 18, y)
    y += 3
    line(doc, y)
    y += 6
    doc.setDrawColor(...INK)
    doc.setLineWidth(0.2)
    doc.line(18, y, 192, y)
    doc.setFont('times', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(...INK)
    doc.text(invoice.paymentRecordedBy.name, 18, y + 7)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...BRONZE)
    doc.text(
      (invoice.paymentRecordedBy.roleLabel || roleLabel(invoice.paymentRecordedBy.role)).toUpperCase(),
      18,
      y + 12,
    )
    y += 18
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...FAINT)
    doc.text('This is who logged that money was received — not who approved the quotation.', 18, y)
  }

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...FAINT)
  doc.text('DealFlow360  ·  confidential  ·  not for circulation', 18, 282)

  doc.save(`${invoice.number}.pdf`)
}

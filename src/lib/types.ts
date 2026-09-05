export type Role = 'rep' | 'manager' | 'finance' | 'admin' | 'customer'

export type QuotationStatus =
  | 'draft'
  | 'returned'
  | 'pending_approval'
  | 'approved'
  | 'negotiation'
  | 'confirmed'
  | 'rejected'
  | 'customer_submitted'
  | 'customer_review'

export type LineRiskStatus = 'within' | 'near' | 'over'
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH'
export type ApprovalStatus = 'pending' | 'returned' | 'approved' | 'rejected'
export type ApprovalStage = 'submitted' | 'sales_manager' | 'finance' | 'confirmed' | 'customer_review' | 'negotiation'
export type BadgeStatus =
  | 'approved'
  | 'pending'
  | 'rejected'
  | 'draft'
  | 'negotiating'
  | 'confirmed'
  | 'low'
  | 'medium'
  | 'high'
  | 'ready'
  | 'split_pending'
  | 'backorder'
  | 'active'
  | 'paused'
  | 'cancelled'
  | 'paid'
  | 'unpaid'
  | 'sent'
  | 'under_negotiation'
  | 'returned'

export interface User {
  id: string
  email: string
  name: string
  role: Role
  customerId: string | null
}

export interface AuthResponse {
  token: string
  user: User
}

export interface Customer {
  id: string
  name: string
  tier: 'Bronze' | 'Silver' | 'Gold'
  region: string
  terms: string
}

export interface PriceListRule {
  tier: string
  currency: string
  priceRule: string
}

export interface PriceList {
  id: string
  name: string
  currency: string
  rules: PriceListRule[]
}

export interface ProductVariant {
  id: string
  attribute: string
  values: string
  extraPrice: number
}

export interface Product {
  id: string
  name: string
  category: 'Hardware' | 'Services'
  price: number
  unit: string
  taxPercent: number
  status: 'active' | 'inactive'
  description: string
  isSubscription: boolean
  cycle: 'monthly' | 'quarterly' | 'annual' | null
  quantity: number | null
  variants: ProductVariant[]
}

export interface QuotationLine {
  id: string
  productId: string
  productName: string
  category: string
  qty: number
  price: number
  discountPercent: number
  limit: number
  status: LineRiskStatus
  comment?: string
  counterDiscount?: number
}

export interface Upsell {
  productId: string
  productName: string
  price: number
  marginNote: string
}

export interface FlagReason {
  line: string
  discountGiven: number
  limitAllowed: number
  overBy: number
}

export interface QuotationListItem {
  id: string
  number: string
  customerId: string
  customerName: string
  date: string
  amount: number
  repId: string
  repName: string
  status: QuotationStatus
  riskLevel: RiskLevel
  riskScore: number
  blendedRisk: number
  customerTier: string
}

export interface QuotationDetail extends QuotationListItem {
  currency: string
  region: string
  terms: string
  priceListId: string
  lines: QuotationLine[]
  flagReasons: FlagReason[]
  upsells: Upsell[]
  portalStatus?: string
  requestedDeliveryDate?: string
  repId: string
}

export interface ActivityItem {
  id: string
  text: string
  timestamp: string
}

export interface DashboardDeal {
  id: string
  number: string
  customerName: string
  amount: number
  status: QuotationStatus
  riskScore: number
  riskLevel: RiskLevel
}

export interface DashboardSummary {
  pendingApprovals: number
  openQuotations: number
  atRiskDeals: number
  totalDealValue?: number
  avgDiscount?: number
  deals?: DashboardDeal[]
  activity: ActivityItem[]
}

export interface AuditEntry {
  user: string
  userId: string
  action: string
  date: string
  note: string
}

export interface ApprovalListItem {
  id: string
  quotationId: string
  quotationNumber: string
  customerName: string
  blendedRisk: number
  riskLevel: RiskLevel
  riskScore: number
  stage: ApprovalStage
  assignedTo: string
  status: ApprovalStatus
  daysPending: number
  amount: number
}

export interface ApprovalDetail extends ApprovalListItem {
  quotation: QuotationDetail
  customerTier: string
  flagReasons: FlagReason[]
  auditLog: AuditEntry[]
  assignedRole: string
}

export interface SubmitResult {
  quotation: QuotationDetail
  approvalRequired: boolean
  approvalId: string
  riskScore: number
  riskLevel: RiskLevel
}

export interface StockRow {
  warehouse: string
  productId: string
  productName: string
  inStock: number
  reserved: number
  available: number
}

export interface FulfillmentOrderListItem {
  id: string
  orderNumber: string
  customerName: string
  status: string
  warehouse: string
  canConsolidate?: boolean
  remainingQty?: number
}

export interface FulfillmentSplitRow {
  warehouse: string
  qtyFulfilled: number
  estShipments: number
  cost: number
  available: number
}

export interface FulfillmentLine {
  productId: string
  productName: string
  qty: number
  suggested: FulfillmentSplitRow[]
}

export interface FulfillmentOrder {
  id: string
  quotationId: string
  orderNumber: string
  customerId: string
  customerName: string
  status: string
  warehouse: string
  lines: FulfillmentLine[]
  splitAccepted?: boolean
  overridden?: boolean
  canConsolidate?: boolean
  remainingQty?: number
  consolidated?: boolean
}

export interface FulfillmentPayload {
  stock: StockRow[]
  orders: FulfillmentOrderListItem[]
}

export interface RecurringLine {
  plan: string
  cycle: string
  nextBillDate: string
  amount: number
}

export interface OneTimeLine {
  productName: string
  qty: number
  amount: number
}

export interface Subscription {
  id: string
  customerId: string
  customerName: string
  plan: string
  cycle: string
  nextBill: string
  amount: number
  status: 'active' | 'paused' | 'cancelled'
  originatingOrderId: string | null
  oneTimeLines: OneTimeLine[]
  recurringLines: RecurringLine[]
}

export interface InvoiceLine {
  number: string
  amount: number
  status: string
  dueDate: string
}

export interface InvoiceItem {
  description: string
  qty: number
  unitPrice: number
  amount: number
}

export interface InvoiceApprover {
  name: string
  role: string
  roleLabel: string
}

export interface Invoice {
  id: string
  number: string
  customerId: string
  customerName: string
  amount: number
  status: 'paid' | 'unpaid'
  dueDate: string
  issuedDate: string
  terms: string
  region: string
  step: 'confirmed' | 'shipped' | 'invoiced' | 'paid'
  note: string
  items: InvoiceItem[]
  lines: InvoiceLine[]
  approvedBy: InvoiceApprover[]
  paymentRecordedBy: InvoiceApprover | null
}

export interface DealHealthItem {
  id: string
  deal: string
  quotationId: string
  issue: string
  flagged: string
  type: 'stalled' | 'anomaly' | 'slippage'
  escalated?: boolean
  nudged?: boolean
}

export interface DealHealthPayload {
  stalled: number
  anomalies: number
  slippage: number
  items: DealHealthItem[]
  byStage: { stage: string; count: number }[]
}

export interface ReportsPayload {
  quotesCreated: number
  avgApprovalTime: string
  topUpsellProduct: string
  filters?: { period: string; team: string; status: string; product: string }
  options?: {
    periods: string[]
    teams: string[]
    statuses: string[]
    products: string[]
  }
}

export interface ProductsPayload {
  items: Product[]
  stats: { totalProducts: number; pricelists: number; variants: number }
}

export interface ProductDetailPayload {
  product: Product
  pricelists: PriceList[]
}

export interface DiscountConfig {
  tierDiscounts: { id: string; tier: string; maxDiscount: number }[]
  categoryCeilings: { id: string; category: string; maxDiscount: number }[]
  approvalChain: { id: string; range: string; routing: string; trigger: string }[]
  thresholds: { medium: number; high: number }
}

export interface PortalQuoteLine {
  id: string
  productName: string
  description: string
  qty: number
  price: number
  discountPercent: number
  comment: string
  counterDiscount: number
  amount: number
  taxPercent: number
}

export interface PortalHistoryItem {
  from: string
  action: string
  body: string
  date: string
}

export interface PortalQuote {
  id: string
  number: string
  customerName: string
  amount: number
  status: QuotationStatus
  portalStatus: 'sent' | 'under_negotiation' | 'confirmed' | 'rejected' | string
  requestedDeliveryDate: string
  currency: string
  terms: string
  date: string
  repName: string
  region: string
  history: PortalHistoryItem[]
  lines: PortalQuoteLine[]
}

export interface PortalMessage {
  id: string
  customerId: string
  quotationId: string
  from: string
  body: string
  date: string
}

export interface ListResponse<T> {
  items: T[]
}

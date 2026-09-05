import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { DiscountConfigPage } from '../features/admin/DiscountConfigPage'
import { ReportsPage } from '../features/admin/ReportsPage'
import { ApprovalDetailPage } from '../features/approvals/ApprovalDetailPage'
import { ApprovalsListPage } from '../features/approvals/ApprovalsListPage'
import { LoginPage } from '../features/auth/LoginPage'
import { DashboardPage } from '../features/dashboard/DashboardPage'
import { DealHealthPage } from '../features/deal-health/DealHealthPage'
import { FulfillmentDetailPage } from '../features/fulfillment/FulfillmentDetailPage'
import { FulfillmentListPage } from '../features/fulfillment/FulfillmentListPage'
import { InvoiceDetailPage } from '../features/invoices/InvoiceDetailPage'
import { InvoicesListPage } from '../features/invoices/InvoicesListPage'
import { PortalMessagesPage } from '../features/portal/PortalMessagesPage'
import { PortalProfilePage } from '../features/portal/PortalProfilePage'
import { PortalQuotePage } from '../features/portal/PortalQuotePage'
import { PortalQuotesListPage } from '../features/portal/PortalQuotesListPage'
import { ProductDetailPage } from '../features/products/ProductDetailPage'
import { ProductsListPage } from '../features/products/ProductsListPage'
import { QuotationDetailPage } from '../features/quotations/QuotationDetailPage'
import { QuotationsListPage } from '../features/quotations/QuotationsListPage'
import { SubscriptionDetailPage } from '../features/subscriptions/SubscriptionDetailPage'
import { SubscriptionsListPage } from '../features/subscriptions/SubscriptionsListPage'
import { InternalLayout, PortalLayout, RequireRole } from './layouts'

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/app" element={<InternalLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="quotations" element={<QuotationsListPage />} />
          <Route path="quotations/:id" element={<QuotationDetailPage />} />
          <Route
            path="approvals"
            element={
              <RequireRole roles={['manager', 'finance', 'admin']}>
                <ApprovalsListPage />
              </RequireRole>
            }
          />
          <Route
            path="approvals/:id"
            element={
              <RequireRole roles={['rep', 'manager', 'finance', 'admin']}>
                <ApprovalDetailPage />
              </RequireRole>
            }
          />
          <Route path="fulfillment" element={<FulfillmentListPage />} />
          <Route path="fulfillment/:id" element={<FulfillmentDetailPage />} />
          <Route path="subscriptions" element={<SubscriptionsListPage />} />
          <Route path="subscriptions/:id" element={<SubscriptionDetailPage />} />
          <Route path="invoices" element={<InvoicesListPage />} />
          <Route path="invoices/:id" element={<InvoiceDetailPage />} />
          <Route
            path="deal-health"
            element={
              <RequireRole roles={['manager', 'finance', 'admin']}>
                <DealHealthPage />
              </RequireRole>
            }
          />
          <Route
            path="reports"
            element={
              <RequireRole roles={['admin']}>
                <ReportsPage />
              </RequireRole>
            }
          />
          <Route
            path="products"
            element={
              <RequireRole roles={['admin']}>
                <ProductsListPage />
              </RequireRole>
            }
          />
          <Route
            path="products/:id"
            element={
              <RequireRole roles={['admin']}>
                <ProductDetailPage />
              </RequireRole>
            }
          />
          <Route
            path="admin/discount-config"
            element={
              <RequireRole roles={['admin', 'finance']}>
                <DiscountConfigPage />
              </RequireRole>
            }
          />
        </Route>
        <Route path="/portal" element={<PortalLayout />}>
          <Route index element={<Navigate to="quotes" replace />} />
          <Route path="quotes" element={<PortalQuotesListPage />} />
          <Route path="quote/:id" element={<PortalQuotePage />} />
          <Route path="messages" element={<PortalMessagesPage />} />
          <Route path="profile" element={<PortalProfilePage />} />
        </Route>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

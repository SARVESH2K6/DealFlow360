import { useEffect, useRef } from 'react'
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
  type UseQueryResult,
} from '@tanstack/react-query'
import { api } from './api'
import { socket } from './socket'
import type {
  ApprovalDetail,
  ApprovalListItem,
  Customer,
  DashboardSummary,
  DiscountConfig,
  FulfillmentOrder,
  FulfillmentPayload,
  Invoice,
  ListResponse,
  PortalMessage,
  PortalQuote,
  PriceList,
  Product,
  ProductDetailPayload,
  ProductsPayload,
  QuotationDetail,
  QuotationListItem,
  ReportsPayload,
  SubmitResult,
  Subscription,
  User,
} from './types'

interface OrderUpdated {
  quotationId: string
  quotation?: QuotationDetail | null
  approval?: ApprovalDetail | null
}

export function useOrderSync(room: string | undefined, queryKey: QueryKey): void {
  const queryClient = useQueryClient()
  const keyRef = useRef(queryKey)
  keyRef.current = queryKey

  useEffect(() => {
    if (!room) return
    let pollId: ReturnType<typeof setInterval> | undefined

    const startPoll = () => {
      if (pollId) return
      pollId = setInterval(() => {
        void queryClient.invalidateQueries({ queryKey: keyRef.current })
      }, 3000)
    }
    const stopPoll = () => {
      if (pollId) {
        clearInterval(pollId)
        pollId = undefined
      }
    }

    socket.emit('join', room)

    const onUpdate = (updated: OrderUpdated) => {
      if (updated && typeof updated === 'object' && 'quotationId' in updated) {
        if (updated.quotation) {
          queryClient.setQueryData(['quotations', updated.quotationId], updated.quotation)
          void queryClient.invalidateQueries({ queryKey: ['portal-quote', updated.quotationId] })
        }
        if (updated.approval) {
          queryClient.setQueryData(['approvals', updated.approval.id], updated.approval)
          void queryClient.invalidateQueries({ queryKey: ['approvals'] })
        }
        void queryClient.invalidateQueries({ queryKey: keyRef.current })
        return
      }
    }
    const onWorkspace = () => {
      void queryClient.invalidateQueries({ queryKey: keyRef.current })
    }

    socket.on('order:updated', onUpdate)
    socket.on('workspace:updated', onWorkspace)
    socket.on('disconnect', startPoll)
    socket.on('connect', stopPoll)

    const timeout = window.setTimeout(() => {
      if (!socket.connected) startPoll()
    }, 2000)

    return () => {
      window.clearTimeout(timeout)
      stopPoll()
      socket.emit('leave', room)
      socket.off('order:updated', onUpdate)
      socket.off('workspace:updated', onWorkspace)
      socket.off('disconnect', startPoll)
      socket.off('connect', stopPoll)
    }
  }, [room, queryClient])
}

export function useLiveQuery<T>(
  queryKey: QueryKey,
  queryFn: () => Promise<T>,
  room: string | undefined,
  enabled = true,
): UseQueryResult<T> {
  useOrderSync(room, queryKey)
  return useQuery({
    queryKey,
    queryFn,
    enabled,
  })
}

export function useDashboard() {
  return useLiveQuery<DashboardSummary>(
    ['dashboard'],
    () => api<DashboardSummary>('/api/dashboard/summary'),
    'workspace',
  )
}

export function useQuotations() {
  return useLiveQuery<ListResponse<QuotationListItem>>(
    ['quotations'],
    () => api<ListResponse<QuotationListItem>>('/api/quotations'),
    'workspace',
  )
}

export function useQuotationDetail(id: string | undefined) {
  return useLiveQuery<QuotationDetail>(
    ['quotations', id],
    () => api<QuotationDetail>(`/api/quotations/${id}`),
    id ? `order:${id}` : undefined,
    Boolean(id),
  )
}

export function useCustomers() {
  return useQuery({
    queryKey: ['customers'],
    queryFn: () => api<ListResponse<Customer>>('/api/customers'),
  })
}

export function usePricelists() {
  return useQuery({
    queryKey: ['pricelists'],
    queryFn: () => api<ListResponse<PriceList>>('/api/pricelists'),
  })
}

export function useProductsList() {
  return useQuery({
    queryKey: ['products'],
    queryFn: () => api<ProductsPayload>('/api/products'),
  })
}

export function useCreateQuotation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { customerId?: string; priceListId?: string }) =>
      api<QuotationDetail>('/api/quotations', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['quotations'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function usePatchQuotation(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Record<string, string>) =>
      api<QuotationDetail>(`/api/quotations/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: (data) => qc.setQueryData(['quotations', id], data),
  })
}

export function useAddLine(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { productId: string; qty?: number }) =>
      api<QuotationDetail>(`/api/quotations/${id}/lines`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: (data) => qc.setQueryData(['quotations', id], data),
  })
}

export function usePatchLine(quotationId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: { lineId: string; discountPercent?: number; qty?: number }) =>
      api<QuotationDetail>(`/api/quotations/${quotationId}/lines/${args.lineId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          discountPercent: args.discountPercent,
          qty: args.qty,
        }),
      }),
    onSuccess: (data) => qc.setQueryData(['quotations', quotationId], data),
  })
}

export function useSubmitQuotation(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      api<SubmitResult>(`/api/quotations/${id}/submit`, { method: 'POST', body: JSON.stringify({}) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['quotations'] })
      void qc.invalidateQueries({ queryKey: ['approvals'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useApprovals() {
  return useLiveQuery<ListResponse<ApprovalListItem>>(
    ['approvals'],
    () => api<ListResponse<ApprovalListItem>>('/api/approvals'),
    'workspace',
  )
}

export function useApprovalDetail(id: string | undefined) {
  const query = useQuery({
    queryKey: ['approvals', id],
    queryFn: () => api<ApprovalDetail>(`/api/approvals/${id}`),
    enabled: Boolean(id),
  })
  useOrderSync(
    query.data?.quotationId ? `order:${query.data.quotationId}` : undefined,
    ['approvals', id],
  )
  return query
}

export function useApprovalAction(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: { action: 'approve' | 'return' | 'reject'; note?: string }) =>
      api<ApprovalDetail>(`/api/approvals/${id}/${args.action}`, {
        method: 'POST',
        body: JSON.stringify({ note: args.note }),
      }),
    onSuccess: (data) => {
      qc.setQueryData(['approvals', id], data)
      void qc.invalidateQueries({ queryKey: ['approvals'] })
      void qc.invalidateQueries({ queryKey: ['quotations'] })
    },
  })
}

export function useFulfillment() {
  return useQuery({
    queryKey: ['fulfillment'],
    queryFn: () => api<FulfillmentPayload>('/api/fulfillment'),
  })
}

export function useFulfillmentDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['fulfillment', id],
    queryFn: () => api<FulfillmentOrder>(`/api/fulfillment/${id}`),
    enabled: Boolean(id),
  })
}

export function useFulfillmentAction(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: { action: 'accept-split' | 'override' | 'consolidate'; body?: unknown }) =>
      api<FulfillmentOrder>(`/api/fulfillment/${id}/${args.action}`, {
        method: 'POST',
        body: JSON.stringify(args.body ?? {}),
      }),
    onSuccess: (data) => {
      qc.setQueryData(['fulfillment', id], data)
      void qc.invalidateQueries({ queryKey: ['fulfillment'] })
    },
  })
}

export function useConsolidateFulfillment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (orderId: string) =>
      api<FulfillmentOrder>(`/api/fulfillment/${orderId}/consolidate`, {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['fulfillment'] }),
  })
}

export function useSubscriptions() {
  return useQuery({
    queryKey: ['subscriptions'],
    queryFn: () => api<ListResponse<Subscription>>('/api/subscriptions'),
  })
}

export function useSubscriptionDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['subscriptions', id],
    queryFn: () => api<Subscription>(`/api/subscriptions/${id}`),
    enabled: Boolean(id),
  })
}

export function useSubscriptionAction(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: { action: 'cancel' | 'modify'; body?: Record<string, unknown> }) =>
      api<Subscription>(`/api/subscriptions/${id}/${args.action}`, {
        method: 'POST',
        body: JSON.stringify(args.body ?? {}),
      }),
    onSuccess: (data) => {
      qc.setQueryData(['subscriptions', id], data)
      void qc.invalidateQueries({ queryKey: ['subscriptions'] })
    },
  })
}

export function useInvoices() {
  return useQuery({
    queryKey: ['invoices'],
    queryFn: () => api<ListResponse<Invoice>>('/api/invoices'),
  })
}

export function useInvoiceDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['invoices', id],
    queryFn: () => api<Invoice>(`/api/invoices/${id}`),
    enabled: Boolean(id),
  })
}

export function useSetInvoiceStatus(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (status: 'paid' | 'unpaid') =>
      api<Invoice>(`/api/invoices/${id}/status`, {
        method: 'POST',
        body: JSON.stringify({ status }),
      }),
    onSuccess: (data) => {
      qc.setQueryData(['invoices', id], data)
      void qc.invalidateQueries({ queryKey: ['invoices'] })
    },
  })
}


export function useReports(filters: { period: string; team: string; status: string; product: string }) {
  const params = new URLSearchParams(filters)
  return useQuery({
    queryKey: ['reports', filters],
    queryFn: () => api<ReportsPayload>(`/api/reports?${params.toString()}`),
  })
}

export function useCreateSubscription() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Partial<Subscription> & { customerId?: string }) =>
      api<Subscription>('/api/subscriptions', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['subscriptions'] }),
  })
}

export function useProductDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['products', id],
    queryFn: () => api<ProductDetailPayload>(`/api/products/${id}`),
    enabled: Boolean(id),
  })
}

export function useCreateProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Partial<Product>) =>
      api<ProductDetailPayload>('/api/products', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['products'] }),
  })
}

export function usePatchProduct(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Partial<Product> & { pricelists?: PriceList[] }) =>
      api<ProductDetailPayload>(`/api/products/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSuccess: (data) => qc.setQueryData(['products', id], data),
  })
}

export function useDiscountConfig() {
  return useQuery({
    queryKey: ['discount-config'],
    queryFn: () => api<DiscountConfig>('/api/discount-config'),
  })
}

export function useSaveDiscountConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: DiscountConfig) =>
      api<DiscountConfig>('/api/discount-config', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: (data) => qc.setQueryData(['discount-config'], data),
  })
}

export function usePortalQuotes() {
  return useQuery({
    queryKey: ['portal-quotes'],
    queryFn: () => api<ListResponse<QuotationListItem>>('/api/portal/quotes'),
  })
}

export function useCreatePortalQuote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { lines: { productId: string; productName: string; qty: number; price: number; category: string }[] }) =>
      api<PortalQuote>('/api/portal/quotes', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['portal-quotes'] })
    },
  })
}

export function usePortalQuote(id: string | undefined) {
  return useLiveQuery<PortalQuote>(
    ['portal-quote', id],
    () => api<PortalQuote>(`/api/portal/quote/${id}`),
    id ? `order:${id}` : undefined,
    Boolean(id),
  )
}

export function usePortalInvoice(id: string | undefined) {
  return useQuery({
    queryKey: ['portal-quote-invoice', id],
    queryFn: () => api<Invoice>(`/api/portal/quote/${id}/invoice`),
    enabled: Boolean(id),
    retry: false,
  })
}

export function usePortalNegotiate(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: unknown) =>
      api<{ ok: boolean }>(`/api/portal/quote/${id}/negotiate`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['portal-quote', id] })
      void qc.invalidateQueries({ queryKey: ['portal-messages'] })
      void qc.invalidateQueries({ queryKey: ['portal-quotes'] })
    },
  })
}

export function usePortalConfirm(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      api<{ ok: boolean; reenteredApproval: boolean }>(`/api/portal/quote/${id}/confirm`, {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['portal-quote', id] })
      void qc.invalidateQueries({ queryKey: ['portal-quotes'] })
    },
  })
}

export function usePortalMessages() {
  return useQuery({
    queryKey: ['portal-messages'],
    queryFn: () => api<ListResponse<PortalMessage>>('/api/portal/messages'),
  })
}

export function usePortalProfile() {
  return useQuery({
    queryKey: ['portal-profile'],
    queryFn: () => api<{ user: User; customer: Customer | undefined }>('/api/portal/profile'),
  })
}

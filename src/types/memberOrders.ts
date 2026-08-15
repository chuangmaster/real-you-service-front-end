// 會員中心（/member）共用的資料型別，對應後端 V3.Public.Api 的
// MemberProfileResponse／CustomerOrderListItemResult／
// CustomerOrderListItemResultPagedResult／CustomerServiceOrderDetailResult／
// CustomerSalesOrderDetailResult（見
// docs/superpowers/specs/2026-08-15-liff-member-center-design.md）。
import type { DeliveryMethod, DeliveryInfo } from './orderDelivery'

export interface MemberProfile {
  customerId: string
  name: string | null
  phoneNumber: string | null
  email: string | null
  residentialAddress: string | null
}

export type MemberOrderKind = 'Service' | 'Sales'

export interface OrderListItem {
  orderId: string
  orderKind: MemberOrderKind
  orderKindDisplay: string | null
  orderNumber: string | null
  status: string | null
  orderDate: string
  totalAmount: number
}

export interface OrderListPage {
  items: OrderListItem[]
  pageNumber: number
  pageSize: number
  totalCount: number
  totalPages: number
}

export interface MemberOrderItem {
  inventoryItemId: string | null
  brand: string | null
  style: string | null
  imageUrl: string | null
  amount: number | null
}

export interface ServiceOrderDetail {
  orderId: string
  orderNumber: string | null
  orderKindDisplay: string | null
  status: string | null
  orderDate: string
  totalAmount: number
  consignmentStartDate: string | null
  consignmentEndDate: string | null
  renewalOption: string | null
  items: MemberOrderItem[]
}

export interface PaymentRecord {
  paymentDate: string
  paymentAmount: number
  paymentMethod: string | null
  bankAccountLastFive: string | null
}

export interface SalesOrderDetail {
  orderId: string
  orderNumber: string | null
  orderDate: string
  subtotalAmount: number
  shippingFee: number
  totalAmount: number
  orderStatus: string | null
  paymentStatus: string | null
  shippingStatus: string | null
  deliveryMethod: DeliveryMethod | null
  deliveryInfo: string | DeliveryInfo | null
  version: number
  items: MemberOrderItem[]
  paymentRecords: PaymentRecord[]
}

// 銷售訂單收件資訊相關型別，供 OrderView.vue 與 OrderRecipientSection.vue 共用。
// 三種 deliveryInfo 形狀對應後端 Core/Models/Dtos/CustomerDeliveryInfoDtos.cs。
// 命名提醒：PICKUP = 門市自取，STORE_PICKUP = 超商取貨，容易搞混。
// 見 docs/superpowers/specs/2026-08-06-order-recipient-delivery-design.md
export type DeliveryMethod = 'HOME_DELIVERY' | 'STORE_PICKUP' | 'PICKUP'

export interface HomeDeliveryInfo {
  recipientName: string
  recipientPhone: string
  recipientAddress: string
}

export interface StorePickupInfo {
  storeInfo: string
  recipientName: string
  recipientPhone: string
}

export interface PickupInfo {
  location: string
  pickupTime?: string | null
}

export type DeliveryInfo = HomeDeliveryInfo | StorePickupInfo | PickupInfo

export interface SalesOrderDeliveryDetail {
  orderStatus: string
  shippingStatus: string
  deliveryMethod: DeliveryMethod | null
  deliveryInfo: DeliveryInfo | null
  version: number
}

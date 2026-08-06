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

// 後端 GET /api/public/orders/sales/{id} 與 PATCH .../delivery 回應的
// data.deliveryInfo 實際上是一段 JSON 字串（資料庫存的是 JSON text，API
// 沒有在這層反序列化），不是巢狀物件——直接當物件讀取欄位（例如
// d.recipientName）會全部是 undefined，畫面看起來像欄位空白。
// 呼叫端一律要透過這個函式把 GET/PATCH 回應的 data 轉成正確型別，不要直接
// `as SalesOrderDeliveryDetail` 轉型了事。
export function parseSalesOrderDeliveryDetail(raw: {
  orderStatus: string
  shippingStatus: string
  deliveryMethod: DeliveryMethod | null
  deliveryInfo: string | DeliveryInfo | null
  version: number
}): SalesOrderDeliveryDetail {
  let deliveryInfo: DeliveryInfo | null = null

  if (typeof raw.deliveryInfo === 'string') {
    try {
      deliveryInfo = JSON.parse(raw.deliveryInfo) as DeliveryInfo
    } catch (err) {
      console.error('Failed to parse deliveryInfo JSON string:', err)
      deliveryInfo = null
    }
  } else {
    deliveryInfo = raw.deliveryInfo
  }

  return {
    orderStatus: raw.orderStatus,
    shippingStatus: raw.shippingStatus,
    deliveryMethod: raw.deliveryMethod,
    deliveryInfo,
    version: raw.version
  }
}

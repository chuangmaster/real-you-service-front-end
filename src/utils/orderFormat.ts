// 金額／日期格式化共用工具，供 /member 系列頁面重用。行為與
// src/views/OrderView.vue 內既有的同名邏輯保持一致（該檔案本身不從這裡
// 匯入，避免非必要地改動已上線驗證過的檔案）。
export function formatOrderCurrency(amount: number, locale: string): string {
  return new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'zh-TW', {
    style: 'currency',
    currency: 'TWD',
    maximumFractionDigits: 0
  }).format(amount)
}

export function formatOrderDate(dateStr: string | null, locale: string): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString(locale === 'en' ? 'en-US' : 'zh-TW')
}

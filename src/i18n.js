import { createI18n } from 'vue-i18n'

const messages = {
  en: {
    nav: {
      searchReport: 'Search Report',
    },
    home: {
      subtitle: 'Luxury Authentication Report Lookup',
      title: 'REAL YOU CERTIFICATE',
      description: 'Enter the 36-character product identification ID to view the certificate of authenticity, specifications, and inspection gallery.',
      idLabel: 'Product ID (UUID)',
      idPlaceholder: 'e.g. 875efd5f-21f9-4940-a26b-b463396e56d2',
      verifyBtn: 'SEARCH',
      errors: {
        required: 'Please enter a product identification code.',
        invalid: 'Invalid ID format. Please use a valid 36-character Product ID.'
      }
    },
    detail: {
      loading: 'RETRIEVING SECURE CERTIFICATE...',
      errorTitle: 'Verification Query Failed',
      error404: 'The requested product verification report was not found. Please verify the ID and try again.',
      errorServer: 'Unable to establish secure connection to the authentication server. Please try again later.',
      returnBtn: 'RETURN TO SEARCH',
      productNumber: 'REAL YOU PRODUCT NUMBER',
      authenticBadge: 'AUTHENTIC',
      specifications: 'Product Specifications',
      brand: 'Brand',
      style: 'Style',
      serialId: 'Serial ID',
      accessories: 'Accompanying Accessories',
      galleryHeading: 'Product Photos',
      tabProduct: 'Product Photos',
      tabAppraisal: 'Appraisal Detail',
      productImageAlt: 'Studio photo {n}',
      appraisalImageAlt: 'Condition record photo {n}',
      ctaTitle: 'Get Your Certificate of Authentication',
      ctaDesc: 'Download the full certificate PDF to verify the product serial number and appraisal results anytime.',
      downloadPdf: 'DOWNLOAD CERTIFICATE',
      generatingPdf: 'GENERATING PDF...',
      certificateCardTitle: 'Certificate of Authentication',
      downloadCard: 'DOWNLOAD CARD',
      accList: {
        box: 'Box',
        dustBag: 'Dust Bag',
        purchaseProof: 'Purchase Proof',
        shoppingBag: 'Shopping Bag',
        shoulderStrap: 'Shoulder Strap',
        felt: 'Felt',
        pillow: 'Pillow',
        card: 'Card',
        lockKey: 'Lock/Key',
        ribbon: 'Ribbon',
        brandCard: 'Brand Card',
        certificate: 'Certificate',
        raincoat: 'Raincoat'
      }
    },
    footer: {
      privacy: 'Privacy Policy',
      terms: 'Terms of Service',
      appraisal: 'Authentication Service',
      copyright: '© 2026 REAL YOU. ALL RIGHTS RESERVED.'
    }
  },
  'zh-TW': {
    nav: {
      searchReport: '報告檢索',
    },
    home: {
      subtitle: '奢侈品鑑定報告查詢',
      title: 'REAL YOU 鑑定證書',
      description: '請輸入 36 碼商品識別 ID，即可查看商品真品證明書、詳細規格及細節檢驗圖庫。',
      idLabel: '商品 ID (UUID)',
      idPlaceholder: '例如：875efd5f-21f9-4940-a26b-b463396e56d2',
      verifyBtn: '搜尋',
      errors: {
        required: '請輸入商品識別代碼。',
        invalid: '無效的 ID 格式。請使用有效的 36 碼商品 ID。'
      }
    },
    detail: {
      loading: '正在安全擷取證書資料...',
      errorTitle: '驗證查詢失敗',
      error404: '找不到所請求的商品驗證報告。請檢查 ID 後再試一次。',
      errorServer: '無法與鑑定伺服器建立安全連接。請稍後再試。',
      returnBtn: '返回查詢',
      productNumber: 'REAL YOU 商品編號',
      authenticBadge: '鑑定為真',
      specifications: '商品詳細規格',
      brand: '品牌',
      style: '款式',
      serialId: '序號',
      accessories: '隨附配件',
      galleryHeading: '商品照片',
      tabProduct: '商品圖',
      tabAppraisal: '鑑定細節',
      productImageAlt: '商品實品照 {n}',
      appraisalImageAlt: '商品現況紀錄照 {n}',
      ctaTitle: '取得您的鑑定證書',
      ctaDesc: '下載完整鑑定證書 PDF，隨時核對商品序號與鑑定結果。',
      downloadPdf: '下載保證書',
      generatingPdf: '產生 PDF 中...',
      certificateCardTitle: '鑑定結果證書',
      downloadCard: '下載保證書小卡',
      accList: {
        box: '包裝盒',
        dustBag: '防塵袋',
        purchaseProof: '購買證明',
        shoppingBag: '紙袋',
        shoulderStrap: '背帶',
        felt: '保護氈',
        pillow: '防潮枕',
        card: '保證卡',
        lockKey: '鎖頭/鑰匙',
        ribbon: '緞帶',
        brandCard: '說明書',
        certificate: '鑑定證書',
        raincoat: '雨衣'
      }
    },
    footer: {
      privacy: '隱私權政策',
      terms: '服務條款',
      appraisal: '精品鑑定',
      copyright: '© 2026 REAL YOU。版權所有。'
    }
  }
}

const i18n = createI18n({
  legacy: false,
  locale: 'zh-TW', // Default to Traditional Chinese
  fallbackLocale: 'en',
  messages
})

export default i18n

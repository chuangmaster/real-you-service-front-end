import { createI18n } from 'vue-i18n'

const messages = {
  en: {
    nav: {
      searchReport: 'Search Report',
    },
    home: {
      subtitle: 'Luxury Authentication Report Lookup',
      title: 'VERITAS CERTIFICATE',
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
      identifiedAsset: 'IDENTIFIED ASSET',
      specifications: 'Product Specifications',
      brand: 'Brand',
      style: 'Style',
      serialId: 'Serial ID',
      securityCode: 'Security Code',
      accessories: 'Accompanying Accessories',
      gallerySub: 'Product Detail Photos',
      galleryTitle: 'Product Inspection Gallery',
      secureTitle: 'Secure your digital asset',
      downloadPdf: 'DOWNLOAD CERTIFICATE PDF',
      addToVault: 'ADD TO DIGITAL VAULT',
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
      support: 'Support',
      copyright: '© 2026 VERITAS LUXURY AUTHENTICATION. ALL RIGHTS RESERVED.'
    }
  },
  'zh-TW': {
    nav: {
      searchReport: '報告檢索',
    },
    home: {
      subtitle: '奢侈品鑑定報告查詢',
      title: 'VERITAS 鑑定證書',
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
      identifiedAsset: '已識別資產',
      specifications: '商品詳細規格',
      brand: '品牌',
      style: '款式',
      serialId: '序號',
      securityCode: '防偽安全碼',
      accessories: '隨附配件',
      gallerySub: '商品細節圖',
      galleryTitle: '商品細節圖庫',
      secureTitle: '保障您的數位資產',
      downloadPdf: '下載證書 PDF',
      addToVault: '新增至數位保險箱',
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
      support: '客戶支援',
      copyright: '© 2026 VERITAS 奢華鑑定。版權所有。'
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

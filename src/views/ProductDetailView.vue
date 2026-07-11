<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import axios from 'axios'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import QRCode from 'qrcode'

const route = useRoute()
const { t, locale } = useI18n()

const toggleLocale = () => {
  locale.value = locale.value === 'en' ? 'zh-TW' : 'en'
}

const loading = ref(true)
const error = ref('')
const item = ref(null)

// Lightbox state
const lightboxOpen = ref(false)
const lightboxImageUrl = ref('')
const zoomScale = ref(1)
const panX = ref(0)
const panY = ref(0)
const isPanning = ref(false)
let panStart = { x: 0, y: 0, panX: 0, panY: 0 }

const ZOOM_MIN = 1
const ZOOM_MAX = 4
const ZOOM_STEP = 0.5

// Certificate card modal state
const certificateModalOpen = ref(false)
const cardRef = ref(null)
const qrCodeDataUrl = ref('')
const cardDownloading = ref(false)

const fetchProductDetails = async (id) => {
  loading.value = true
  error.value = ''
  try {
    const response = await axios.get(`/api/public/inventory/${id}`)
    
    // Check if the response follows the standard API wrapper model
    if (response.data && response.data.success) {
      item.value = response.data.data
    } else if (response.data) {
      // Direct DTO response fallback
      item.value = response.data
    } else {
      throw new Error('Invalid API response format')
    }
  } catch (err) {
    console.error('Error fetching product details:', err)
    if (err.response && err.response.status === 404) {
      error.value = t('detail.error404')
    } else {
      error.value = t('detail.errorServer')
    }
  } finally {
    loading.value = false
  }
}

// Compute the cover image
const coverImage = computed(() => {
  if (!item.value || !item.value.images || item.value.images.length === 0) {
    return 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?q=80&w=1200&auto=format&fit=crop' // Luxury placeholder
  }
  const cover = item.value.images.find(img => img.isCover)
  return cover ? cover.imageUrl : item.value.images[0].imageUrl
})

// Sort images by upload order
const sortedImages = computed(() => {
  if (!item.value || !item.value.images) return []
  return [...item.value.images].sort((a, b) => (a.uploadOrder || 0) - (b.uploadOrder || 0))
})

// Product images: everything that isn't explicitly tagged as an appraisal photo,
// so untagged/legacy images never silently disappear from the page
const productImages = computed(() =>
  sortedImages.value.filter(img => img.imageType !== 'APPRAISAL')
)

// Appraisal images: explicitly tagged by the backend imageType field
const appraisalImages = computed(() =>
  sortedImages.value.filter(img => img.imageType === 'APPRAISAL')
)

const activeGalleryTab = ref('product')

const galleryTabs = computed(() => [
  {
    key: 'product',
    labelKey: 'detail.tabProduct',
    altKey: 'detail.productImageAlt',
    images: productImages.value
  },
  {
    key: 'appraisal',
    labelKey: 'detail.tabAppraisal',
    altKey: 'detail.appraisalImageAlt',
    images: appraisalImages.value
  }
])

const activeGallery = computed(() => galleryTabs.value.find(g => g.key === activeGalleryTab.value))

// Accessories list (mock metadata since not provided by standard public API)
const accessories = computed(() => [
  { name: t('detail.accList.box'), icon: 'inventory_2', present: true },
  { name: t('detail.accList.dustBag'), icon: 'shopping_bag', present: true },
  { name: t('detail.accList.purchaseProof'), icon: 'receipt_long', present: true },
  { name: t('detail.accList.shoppingBag'), icon: 'shopping_cart', present: true },
  { name: t('detail.accList.shoulderStrap'), icon: 'link', present: false },
  { name: t('detail.accList.felt'), icon: 'texture', present: false },
  { name: t('detail.accList.pillow'), icon: 'chair', present: false },
  { name: t('detail.accList.card'), icon: 'credit_card', present: true },
  { name: t('detail.accList.lockKey'), icon: 'lock', present: false },
  { name: t('detail.accList.ribbon'), icon: 'bookmark', present: false },
  { name: t('detail.accList.brandCard'), icon: 'badge', present: true },
  { name: t('detail.accList.certificate'), icon: 'verified_user', present: true },
  { name: t('detail.accList.raincoat'), icon: 'umbrella', present: false }
])

const openLightbox = (url) => {
  lightboxImageUrl.value = url
  lightboxOpen.value = true
  resetZoom()
}

const closeLightbox = () => {
  lightboxOpen.value = false
  lightboxImageUrl.value = ''
  resetZoom()
}

const resetZoom = () => {
  zoomScale.value = 1
  panX.value = 0
  panY.value = 0
}

const zoomIn = () => {
  zoomScale.value = Math.min(ZOOM_MAX, zoomScale.value + ZOOM_STEP)
}

const zoomOut = () => {
  zoomScale.value = Math.max(ZOOM_MIN, zoomScale.value - ZOOM_STEP)
  if (zoomScale.value === ZOOM_MIN) {
    panX.value = 0
    panY.value = 0
  }
}

const handleWheelZoom = (e) => {
  e.preventDefault()
  const next = zoomScale.value + (e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP)
  zoomScale.value = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next))
  if (zoomScale.value === ZOOM_MIN) {
    panX.value = 0
    panY.value = 0
  }
}

const handleImageDoubleClick = () => {
  if (zoomScale.value > ZOOM_MIN) {
    resetZoom()
  } else {
    zoomScale.value = 2.5
  }
}

const startPan = (e) => {
  if (zoomScale.value <= ZOOM_MIN) return
  isPanning.value = true
  panStart = { x: e.clientX, y: e.clientY, panX: panX.value, panY: panY.value }
}

const movePan = (e) => {
  if (!isPanning.value) return
  panX.value = panStart.panX + (e.clientX - panStart.x)
  panY.value = panStart.panY + (e.clientY - panStart.y)
}

const endPan = () => {
  isPanning.value = false
}

const openCertificateModal = async () => {
  try {
    const shareUrl = `${window.location.origin}${route.path}/share`
    qrCodeDataUrl.value = await QRCode.toDataURL(shareUrl, { margin: 1, width: 240 })
  } catch (err) {
    console.error('Failed to generate QR code:', err)
    qrCodeDataUrl.value = ''
  }
  certificateModalOpen.value = true
}

const closeCertificateModal = () => {
  certificateModalOpen.value = false
}

const handleDownloadCard = async () => {
  if (!cardRef.value || cardDownloading.value) return
  cardDownloading.value = true

  try {
    await document.fonts.ready

    const canvas = await html2canvas(cardRef.value, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff'
    })

    const imgData = canvas.toDataURL('image/jpeg', 0.92)
    const pdf = new jsPDF({
      orientation: canvas.width >= canvas.height ? 'l' : 'p',
      unit: 'px',
      format: [canvas.width, canvas.height]
    })
    pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height)
    pdf.save(`RealYou_Certificate_Card_${item.value?.inventoryNumber || item.value?.id}.pdf`)
  } catch (err) {
    console.error('Failed to generate certificate card PDF:', err)
  } finally {
    cardDownloading.value = false
  }
}

// Initial fetch
onMounted(() => {
  fetchProductDetails(route.params.id)
})

// Refetch on ID change
watch(() => route.params.id, (newId) => {
  if (newId) {
    fetchProductDetails(newId)
  }
})
</script>

<template>
  <div class="py-10">
    <!-- 1. LOADING STATE -->
    <div v-if="loading" class="min-h-[60vh] flex flex-col justify-center items-center px-margin-mobile">
      <div class="w-12 h-12 border-2 border-primary-container border-t-primary rounded-full animate-spin mb-6"></div>
      <p class="font-data-mono text-label-caps text-secondary tracking-widest uppercase">
        {{ $t('detail.loading') }}
      </p>
    </div>

    <!-- 2. ERROR STATE -->
    <div v-else-if="error" class="min-h-[60vh] flex flex-col justify-center items-center text-center px-margin-mobile max-w-lg mx-auto">
      <span class="material-symbols-outlined text-primary text-[48px] mb-6">gpp_maybe</span>
      <h2 class="font-headline-sm text-on-surface mb-4">{{ $t('detail.errorTitle') }}</h2>
      <p class="font-body-md text-secondary mb-8">{{ error }}</p>
      <router-link to="/" class="bg-primary text-white px-10 py-4 font-label-caps text-label-caps tracking-widest hover:bg-primary-container transition-colors duration-300">
        {{ $t('detail.returnBtn') }}
      </router-link>
    </div>

    <!-- 3. SUCCESS / PRODUCT DETAIL STATE -->
    <div v-else-if="item">
      <div>
        <!-- Hero Section: Authentication Status -->
        <section class="py-16 md:py-24 flex flex-col items-center text-center px-margin-mobile">
          <div class="w-[76px] h-[76px] rounded-2xl overflow-hidden shadow-lg mb-8">
            <img src="/favicon.png" alt="REAL YOU" class="w-full h-full object-cover" />
          </div>

          <div class="flex flex-col items-center gap-2">
            <p class="font-data-mono text-data-mono text-secondary">
              {{ $t('detail.productNumber') }}
            </p>
            <p class="font-headline-sm text-headline-sm tracking-[0.1em] text-on-surface">
              <span class="font-semibold text-lg uppercase font-mono">{{ item.inventoryNumber || 'V-UNKNOWN' }}</span>
            </p>
            <div class="h-[1px] w-24 bg-primary-container mt-4"></div>
            <div class="inline-flex items-center gap-2 px-5 py-2.5 mt-6 rounded-full bg-authentic-emerald/10 border border-authentic-emerald/20">
              <span class="material-symbols-outlined text-authentic-emerald text-[20px]">check_circle</span>
              <span class="font-label-caps text-sm text-authentic-emerald uppercase whitespace-nowrap">{{ $t('detail.authenticBadge') }}</span>
            </div>
          </div>
        </section>

        <!-- Cover Image & Specifications -->
        <section class="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop grid grid-cols-1 lg:grid-cols-2 gap-20 mb-32">
          <!-- Cover Image -->
          <div class="relative overflow-hidden aspect-[4/5] bg-surface-container border border-outline-variant/20 shadow-sm group">
            <img
              :alt="`${item.brandName || 'Brand'} - ${item.styleName || 'Style'}`"
              class="w-full h-full object-contain transition-transform duration-[2000ms] group-hover:scale-105"
              :src="coverImage"
            />
          </div>

          <!-- Details -->
          <div>
            <h2 class="font-headline-sm text-headline-sm mb-12 border-b border-antique-gold/30 pb-4">
              {{ $t('detail.specifications') }}
            </h2>
            <div class="space-y-0">
              <div class="flex justify-between py-6 border-b border-outline-variant/20 items-center">
                <span class="font-label-caps text-label-caps text-secondary uppercase tracking-wider">{{ $t('detail.brand') }}</span>
                <span class="font-title-lg text-title-lg text-on-surface">{{ item.brandName || 'N/A' }}</span>
              </div>

              <div class="flex justify-between py-6 border-b border-outline-variant/20 items-center">
                <span class="font-label-caps text-label-caps text-secondary uppercase tracking-wider">{{ $t('detail.style') }}</span>
                <span class="font-title-lg text-title-lg text-on-surface">{{ item.styleName || 'N/A' }}</span>
              </div>

              <div class="flex justify-between py-6 border-b border-outline-variant/20 items-center">
                <span class="font-label-caps text-label-caps text-secondary uppercase tracking-wider">{{ $t('detail.serialId') }}</span>
                <span class="font-data-mono text-title-lg text-on-surface font-mono">{{ item.serialId || 'N/A' }}</span>
              </div>
            </div>
          </div>
        </section>

        <!-- Accessories -->
        <section class="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop mb-32">
          <h2 class="font-headline-sm text-headline-sm mb-12 border-b border-antique-gold/30 pb-4">
            {{ $t('detail.accessories') }}
          </h2>
          <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 gap-4">
            <div
              v-for="acc in accessories"
              :key="acc.name"
              class="bg-surface-container-low p-4 flex flex-col items-center gap-2 text-center border border-transparent transition-all duration-300 hover:bg-surface-container-high"
              :class="{'opacity-30': !acc.present}"
            >
              <span class="material-symbols-outlined text-primary text-[24px]">
                {{ acc.icon }}
              </span>
              <span class="font-label-caps text-[10px] text-on-surface uppercase tracking-tight block">
                {{ acc.name }}
              </span>
            </div>
          </div>
        </section>

        <!-- Product / Appraisal Image Gallery -->
        <section class="py-24 bg-surface-container-lowest border-y border-outline-variant/20">
          <div class="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop">
            <div class="mb-8 pb-6 border-b border-outline-variant/30">
              <h2 class="font-headline-md text-on-surface">{{ $t('detail.galleryHeading') }}</h2>
            </div>

            <!-- Tabs -->
            <div class="flex items-center gap-8 mb-6">
              <button
                v-for="tab in galleryTabs"
                :key="tab.key"
                @click="activeGalleryTab = tab.key"
                class="pb-3 font-label-caps text-xs tracking-widest uppercase border-b-2 transition-colors duration-300"
                :class="tab.key === activeGalleryTab
                  ? 'text-primary border-primary'
                  : 'text-secondary border-transparent hover:text-on-surface'"
              >
                {{ $t(tab.labelKey) }}
              </button>
            </div>

            <!-- Gallery Grid -->
            <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
              <!-- Active Images from API -->
              <div
                v-for="(img, index) in activeGallery.images"
                :key="img.id"
                @click="openLightbox(img.imageUrl)"
                class="aspect-square bg-surface-container overflow-hidden group relative cursor-pointer border border-outline-variant/20 shadow-sm"
              >
                <img
                  :alt="$t(activeGallery.altKey, { n: index + 1 })"
                  class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  :src="img.imageUrl"
                />
                <div class="absolute inset-0 bg-charcoal/0 group-hover:bg-charcoal/20 transition-colors duration-300 flex items-center justify-center">
                  <span class="material-symbols-outlined text-white opacity-0 group-hover:opacity-100 scale-50 group-hover:scale-100 transition-all text-[28px]">
                    zoom_in
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <!-- Secure Asset Actions -->
      <section class="bg-surface py-24 flex justify-center px-margin-mobile">
        <div class="bg-white border border-outline-variant/30 max-w-[320px] w-full px-8 pt-8 pb-7 text-center shadow-[0_18px_40px_-28px_rgba(26,26,26,0.35)]">
          <div class="w-10 h-10 rounded-full bg-authentic-emerald/10 border border-authentic-emerald/30 flex items-center justify-center mx-auto mb-4">
            <span class="material-symbols-outlined text-authentic-emerald text-[20px]">check_circle</span>
          </div>
          <h2 class="font-headline-sm text-lg text-on-surface mb-2">{{ $t('detail.ctaTitle') }}</h2>
          <p class="font-body-md text-sm text-secondary mb-5">{{ $t('detail.ctaDesc') }}</p>
          <div class="h-[1px] w-10 bg-antique-gold mx-auto mb-5"></div>
          <button
            class="w-full bg-primary text-white px-8 py-4 font-label-caps text-label-caps hover:bg-primary-container transition-colors duration-300 tracking-widest"
            @click="openCertificateModal"
          >
            {{ $t('detail.downloadPdf') }}
          </button>
        </div>
      </section>
    </div>

    <!-- Certificate Card Modal -->
    <div
      v-if="certificateModalOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/90 backdrop-blur-sm p-4"
      @click="closeCertificateModal"
    >
      <div class="relative max-w-sm w-full" @click.stop>
        <button
          @click="toggleLocale"
          class="absolute -top-3 -left-3 z-10 text-white bg-charcoal hover:bg-charcoal/80 px-3 py-2 border border-white/20 transition-all rounded-full font-label-caps text-xs tracking-wider flex items-center justify-center"
        >
          {{ locale === 'en' ? '繁中' : 'EN' }}
        </button>
        <button
          @click="closeCertificateModal"
          class="absolute -top-3 -right-3 z-10 text-white bg-charcoal hover:bg-charcoal/80 p-2 border border-white/20 transition-all rounded-full flex items-center justify-center"
        >
          <span class="material-symbols-outlined text-[18px]">close</span>
        </button>

        <div ref="cardRef" class="bg-white overflow-hidden shadow-2xl">
          <!-- Dark hero section -->
          <div class="bg-charcoal px-8 pt-8 pb-10 text-center">
            <p class="font-label-caps text-xs text-white tracking-[0.3em] uppercase mb-6">REAL YOU</p>
            <h3 class="font-headline-sm text-headline-sm text-white mb-3">{{ $t('detail.certificateCardTitle') }}</h3>
            <p class="font-data-mono text-xs text-white/50 tracking-widest mb-6">#{{ item.inventoryNumber || 'V-UNKNOWN' }}</p>

            <div class="relative overflow-hidden bg-surface-container border border-white/10">
              <img
                :src="coverImage"
                :alt="`${item.brandName || 'Brand'} - ${item.styleName || 'Style'}`"
                class="w-full h-auto max-h-80 object-contain mx-auto"
              />
              <div class="absolute top-3 right-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white shadow-md">
                <span class="material-symbols-outlined text-authentic-emerald text-[16px]">check_circle</span>
                <span class="font-label-caps text-xs text-authentic-emerald uppercase whitespace-nowrap">{{ $t('detail.authenticBadge') }}</span>
              </div>
            </div>
          </div>

          <!-- Details section -->
          <div class="px-8 py-8">
            <div class="grid grid-cols-2 gap-4 mb-8">
              <div>
                <p class="font-label-caps text-[10px] text-secondary uppercase tracking-wider mb-1">{{ $t('detail.brand') }}</p>
                <p class="font-title-lg text-title-lg text-on-surface">{{ item.brandName || 'N/A' }}</p>
              </div>
              <div>
                <p class="font-label-caps text-[10px] text-secondary uppercase tracking-wider mb-1">{{ $t('detail.style') }}</p>
                <p class="font-title-lg text-title-lg text-on-surface">{{ item.styleName || 'N/A' }}</p>
              </div>
              <div class="col-span-2">
                <p class="font-label-caps text-[10px] text-secondary uppercase tracking-wider mb-1">{{ $t('detail.serialId') }}</p>
                <p class="font-data-mono text-title-lg text-on-surface font-mono">{{ item.serialId || 'N/A' }}</p>
              </div>
            </div>

            <div class="flex justify-center mb-6">
              <img v-if="qrCodeDataUrl" :src="qrCodeDataUrl" alt="QR Code" class="w-28 h-28" />
            </div>

            <p class="font-data-mono text-[10px] text-secondary text-center">{{ $t('footer.copyright') }}</p>
          </div>
        </div>

        <button
          class="w-full mt-4 bg-primary text-white px-8 py-4 font-label-caps text-label-caps hover:bg-primary-container transition-colors duration-300 tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="cardDownloading"
          @click="handleDownloadCard"
        >
          {{ cardDownloading ? $t('detail.generatingPdf') : $t('detail.downloadCard') }}
        </button>
      </div>
    </div>

    <!-- Image Lightbox Modal -->
    <div
      v-if="lightboxOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/95 backdrop-blur-sm p-4"
      @click="closeLightbox"
    >
      <div class="relative max-w-4xl w-full max-h-[85vh] flex items-center justify-center">
        <div class="absolute top-4 right-4 z-10 flex items-center gap-2">
          <button
            @click.stop="zoomOut"
            class="text-white bg-charcoal/50 hover:bg-charcoal p-2 border border-white/20 transition-all rounded-full flex items-center justify-center"
          >
            <span class="material-symbols-outlined">zoom_out</span>
          </button>
          <button
            @click.stop="zoomIn"
            class="text-white bg-charcoal/50 hover:bg-charcoal p-2 border border-white/20 transition-all rounded-full flex items-center justify-center"
          >
            <span class="material-symbols-outlined">zoom_in</span>
          </button>
          <button
            @click.stop="closeLightbox"
            class="text-white bg-charcoal/50 hover:bg-charcoal p-2 border border-white/20 transition-all rounded-full flex items-center justify-center"
          >
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>
        <div
          class="w-full h-full flex items-center justify-center overflow-hidden"
          @click.stop
          @wheel="handleWheelZoom"
          @mousedown="startPan"
          @mousemove="movePan"
          @mouseup="endPan"
          @mouseleave="endPan"
        >
          <img
            :src="lightboxImageUrl"
            alt="Enlarged inspection view"
            class="max-w-full max-h-[80vh] object-contain border border-white/10 select-none"
            :class="zoomScale > ZOOM_MIN ? (isPanning ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-zoom-in'"
            :style="{ transform: `translate(${panX}px, ${panY}px) scale(${zoomScale})`, transition: isPanning ? 'none' : 'transform 0.15s ease-out' }"
            draggable="false"
            @dblclick="handleImageDoubleClick"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Custom animations */
@keyframes pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: .85;
    transform: scale(0.96);
  }
}
.animate-pulse {
  animation: pulse 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
</style>

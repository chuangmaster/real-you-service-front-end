<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import axios from 'axios'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()

const loading = ref(true)
const error = ref('')
const item = ref(null)

// Lightbox state
const lightboxOpen = ref(false)
const lightboxImageUrl = ref('')

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
    console.error('Error fetching inventory item:', err)
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

// Gallery slots count - keep at least 10 slots to match the design of sample.html
const galleryPlaceholdersCount = computed(() => {
  const currentImagesCount = sortedImages.value.length
  return Math.max(0, 10 - currentImagesCount)
})

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
}

const closeLightbox = () => {
  lightboxOpen.value = false
  lightboxImageUrl.value = ''
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
      <!-- Hero Section: Authentication Status -->
      <section class="py-16 md:py-24 flex flex-col items-center text-center px-margin-mobile">
        <div class="mb-4">
          <div class="relative group mb-12">
            <div class="absolute -inset-1 bg-gradient-to-r from-primary-container/20 to-primary/20 rounded-full blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
            <div class="relative bg-surface-container-low border border-outline-variant/30 rounded-full p-4 flex items-center justify-center">
              <span class="material-symbols-outlined text-primary text-[40px] animate-pulse">verified</span>
            </div>
          </div>
        </div>

        <div class="flex flex-col items-center gap-2">
          <p class="font-data-mono text-data-mono text-secondary">
            {{ $t('detail.productNumber') }}
          </p>
          <p class="font-headline-sm text-headline-sm tracking-[0.1em] text-on-surface">
            <span class="font-semibold text-lg uppercase font-mono">{{ item.inventoryNumber || 'V-UNKNOWN' }}</span>
          </p>
          <div class="h-[1px] w-24 bg-primary-container mt-4"></div>
        </div>
      </section>

      <!-- Main Cover Display -->
      <section class="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop mb-24">
        <div class="relative overflow-hidden aspect-[4/5] md:aspect-[21/9] bg-surface-container border border-outline-variant/20 shadow-sm group">
          <img
            :alt="`${item.brandName || 'Brand'} - ${item.styleName || 'Style'}`"
            class="w-full h-full object-cover transition-transform duration-[2000ms] group-hover:scale-105"
            :src="coverImage"
          />
          <div class="absolute bottom-8 left-8 bg-charcoal/40 backdrop-blur-md px-6 py-3 border border-white/20">
            <span class="font-label-caps text-label-caps text-white">{{ $t('detail.identifiedAsset') }}</span>
          </div>
        </div>
      </section>

      <!-- Product Information & Accessories -->
      <section class="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop grid grid-cols-1 lg:grid-cols-2 gap-20 mb-32">
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

            <div class="flex justify-between py-6 border-b border-outline-variant/20 items-center">
              <span class="font-label-caps text-label-caps text-secondary uppercase tracking-wider">{{ $t('detail.securityCode') }}</span>
              <span class="font-data-mono text-title-lg text-secondary font-mono text-sm uppercase">{{ item.id }}</span>
            </div>
          </div>
        </div>

        <!-- Accessories -->
        <div>
          <h2 class="font-headline-sm text-headline-sm mb-12 border-b border-antique-gold/30 pb-4">
            {{ $t('detail.accessories') }}
          </h2>
          <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-3 gap-4">
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
        </div>
      </section>

      <!-- Inspection Gallery Section -->
      <section class="py-24 bg-surface-container-lowest border-y border-outline-variant/20">
        <div class="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop">
          <div class="flex flex-col md:flex-row md:items-end justify-between mb-12 border-b border-outline-variant/30 pb-6">
            <div>
              <span class="font-label-caps text-primary tracking-widest uppercase text-xs">{{ $t('detail.gallerySub') }}</span>
              <h2 class="font-headline-md text-on-surface mt-2">{{ $t('detail.galleryTitle') }}</h2>
            </div>
          </div>

          <!-- Gallery Grid -->
          <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            <!-- Active Images from API -->
            <div
              v-for="(img, index) in sortedImages"
              :key="img.id"
              @click="openLightbox(img.imageUrl)"
              class="aspect-square bg-surface-container overflow-hidden group relative cursor-pointer border border-outline-variant/20 shadow-sm"
            >
              <img
                :alt="`Inspection item detail ${index + 1}`"
                class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                :src="img.imageUrl"
              />
              <div class="absolute inset-0 bg-charcoal/0 group-hover:bg-charcoal/20 transition-colors duration-300 flex items-center justify-center">
                <span class="material-symbols-outlined text-white opacity-0 group-hover:opacity-100 scale-50 group-hover:scale-100 transition-all text-[28px]">
                  zoom_in
                </span>
              </div>
            </div>

            <!-- Placeholder Slots to maintain the catalog aesthetic -->
            <div
              v-for="n in galleryPlaceholdersCount"
              :key="`placeholder-${n}`"
              class="aspect-square bg-surface-container-low border border-outline-variant/10 flex items-center justify-center shadow-inner"
            >
              <span class="material-symbols-outlined text-outline-variant/30 text-[32px]">image</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Secure Asset Actions -->
      <section class="bg-charcoal py-24 text-center">
        <div class="max-w-container-max mx-auto px-margin-mobile">
          <h2 class="font-display-lg text-display-lg-mobile md:text-display-lg text-white mb-12 font-serif">
            {{ $t('detail.secureTitle') }}
          </h2>
          <div class="flex flex-col md:flex-row gap-6 justify-center">
            <button class="bg-primary text-white px-12 py-4 font-label-caps text-label-caps hover:bg-primary-container transition-colors duration-300 tracking-widest">
              {{ $t('detail.downloadPdf') }}
            </button>
            <button class="border border-white/30 text-white px-12 py-4 font-label-caps text-label-caps hover:bg-white/10 transition-colors duration-300 tracking-widest">
              {{ $t('detail.addToVault') }}
            </button>
          </div>
        </div>
      </section>
    </div>

    <!-- Image Lightbox Modal -->
    <div
      v-if="lightboxOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/95 backdrop-blur-sm p-4 cursor-pointer"
      @click="closeLightbox"
    >
      <div class="relative max-w-4xl w-full max-h-[85vh] flex items-center justify-center">
        <button
          @click.stop="closeLightbox"
          class="absolute top-4 right-4 text-white bg-charcoal/50 hover:bg-charcoal p-2 border border-white/20 transition-all rounded-full flex items-center justify-center"
        >
          <span class="material-symbols-outlined">close</span>
        </button>
        <img
          :src="lightboxImageUrl"
          alt="Enlarged inspection view"
          class="max-w-full max-h-[80vh] object-contain border border-white/10"
          @click.stop
        />
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

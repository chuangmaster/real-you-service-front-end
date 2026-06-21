<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

const router = useRouter()
const { t } = useI18n()
const searchId = ref('')
const error = ref('')

const handleSearch = () => {
  error.value = ''
  const cleanId = searchId.value.trim()
  
  if (!cleanId) {
    error.value = t('home.errors.required')
    return
  }
  
  // Basic UUID format check
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(cleanId)) {
    error.value = t('home.errors.invalid')
    return
  }
  
  router.push({ name: 'inventory-detail', params: { id: cleanId } })
}
</script>

<template>
  <div class="relative min-h-[80vh] flex flex-col justify-center items-center px-margin-mobile py-16">
    <!-- Background glow elements -->
    <div class="absolute inset-0 overflow-hidden pointer-events-none">
      <div class="absolute top-[20%] left-[10%] w-[300px] h-[300px] bg-primary-container/10 rounded-full blur-[80px]"></div>
      <div class="absolute bottom-[20%] right-[10%] w-[400px] h-[400px] bg-primary/5 rounded-full blur-[100px]"></div>
    </div>

    <!-- Main Container -->
    <div class="w-full max-w-xl text-center z-10">
      <!-- Title / Brand Header -->
      <span class="font-data-mono text-label-caps text-primary tracking-[0.2em] uppercase mb-4 block">
        {{ $t('home.subtitle') }}
      </span>
      <h1 class="font-headline-md text-4xl md:text-5xl text-on-surface mb-8 font-serif">
        {{ $t('home.title') }}
      </h1>
      <p class="font-body-md text-secondary max-w-md mx-auto mb-12">
        {{ $t('home.description') }}
      </p>

      <!-- Search Card -->
      <div class="bg-surface-container-low border border-outline-variant/30 p-8 md:p-10 mb-12 luxury-blur">
        <form @submit.prevent="handleSearch" class="space-y-6">
          <div class="text-left">
            <label for="productId" class="font-label-caps text-[10px] text-secondary tracking-widest uppercase block mb-3">
              {{ $t('home.idLabel') }}
            </label>
            <div class="relative">
              <input
                id="productId"
                v-model="searchId"
                type="text"
                :placeholder="$t('home.idPlaceholder')"
                class="w-full bg-white border border-outline-variant/50 px-4 py-4 pr-12 focus:border-primary focus:ring-0 focus:outline-none transition-colors font-mono text-sm tracking-wide"
                :class="{'border-error': error}"
              />
              <button
                type="submit"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-primary hover:text-primary-container transition-colors flex items-center justify-center"
              >
                <span class="material-symbols-outlined text-[28px]">search</span>
              </button>
            </div>
            <p v-if="error" class="text-error text-xs mt-2 font-medium flex items-center gap-1">
              <span class="material-symbols-outlined text-sm">error</span>
              {{ error }}
            </p>
          </div>

          <button
            type="submit"
            class="w-full bg-primary text-white py-4 font-label-caps text-label-caps tracking-widest hover:bg-primary-container transition-colors duration-300 shadow-sm"
          >
            {{ $t('home.verifyBtn') }}
          </button>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Custom styled element */
</style>

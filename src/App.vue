<script setup>
import { RouterView } from 'vue-router'
import { useI18n } from 'vue-i18n'

const { locale } = useI18n()

const toggleLocale = () => {
  locale.value = locale.value === 'en' ? 'zh-TW' : 'en'
}
</script>

<template>
  <div class="min-h-screen flex flex-col bg-background text-on-background font-body-md overflow-x-hidden">
    <!-- Navbar -->
    <nav class="fixed top-0 w-full z-50 bg-surface/80 backdrop-blur-md border-b border-outline-variant/30">
      <div class="max-w-container-max mx-auto px-margin-mobile h-16 flex items-center justify-between">
        <router-link to="/" class="font-display-lg text-xl tracking-widest text-primary uppercase hover:opacity-80 transition-opacity">
          REAL YOU
        </router-link>
        <div class="flex items-center gap-6">
          <router-link to="/" class="font-label-caps text-xs tracking-wider text-secondary hover:text-primary transition-colors">
            {{ $t('nav.searchReport') }}
          </router-link>
          <button @click="toggleLocale" class="font-label-caps text-xs tracking-wider text-secondary hover:text-primary transition-colors border border-outline-variant/30 px-2 py-1 rounded hover:border-primary">
            {{ locale === 'en' ? '繁中' : 'EN' }}
          </button>
          <button class="material-symbols-outlined text-secondary hover:text-primary transition-colors">menu</button>
        </div>
      </div>
    </nav>

    <!-- Main Content -->
    <main class="flex-grow pt-16">
      <RouterView />
    </main>

    <!-- Footer -->
    <footer class="bg-charcoal text-white/60 py-12 border-t border-white/5 mt-auto">
      <div class="max-w-container-max mx-auto px-margin-mobile flex flex-col md:flex-row justify-between items-center gap-8">
        <span class="font-display-lg text-lg tracking-widest text-primary-container">VERITAS</span>
        <div class="flex gap-8 font-label-caps text-[10px] tracking-widest uppercase">
          <a class="hover:text-primary-container transition-colors" href="#">{{ $t('footer.privacy') }}</a>
          <a class="hover:text-primary-container transition-colors" href="#">{{ $t('footer.terms') }}</a>
          <a class="hover:text-primary-container transition-colors" href="#">{{ $t('footer.support') }}</a>
        </div>
        <p class="font-data-mono text-[10px]">
          {{ $t('footer.copyright') }}
        </p>
      </div>
    </footer>
  </div>
</template>

<style scoped>
/* Scoped styles if any */
</style>

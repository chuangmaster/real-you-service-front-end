<template>
  <div class="relative min-h-[80vh] flex items-center px-margin-mobile py-16 overflow-hidden">
    <!-- Background glow elements -->
    <div class="absolute inset-0 overflow-hidden pointer-events-none">
      <div class="absolute top-[20%] left-[10%] w-[300px] h-[300px] bg-primary-container/10 rounded-full blur-[80px]"></div>
      <div class="absolute bottom-[20%] right-[10%] w-[400px] h-[400px] bg-primary/5 rounded-full blur-[100px]"></div>
    </div>

    <div class="relative z-10 w-full max-w-container-max mx-auto text-center">
      <span class="font-data-mono text-label-caps text-primary tracking-[0.2em] uppercase mb-4 block">
        {{ $t('home.tagline') }}
      </span>
      <h1 class="font-headline-md text-4xl md:text-5xl text-on-surface mb-6 font-serif">
        {{ $t('home.heroTitle') }}
      </h1>
      <p class="font-body-md text-secondary max-w-md mx-auto mb-10">
        {{ $t('home.heroDescription') }}
      </p>

      <div class="flex flex-col sm:flex-row gap-4 justify-center">
        <router-link
          :to="{ name: 'identification-report' }"
          class="bg-primary text-white px-8 py-4 font-label-caps text-label-caps tracking-widest hover:bg-primary-container transition-colors duration-300 shadow-sm text-center"
        >
          {{ $t('home.ctaSearch') }}
        </router-link>
        <router-link
          :to="{ name: 'member-profile' }"
          class="border border-outline-variant/50 text-on-surface px-8 py-4 font-label-caps text-label-caps tracking-widest hover:border-primary hover:text-primary transition-colors duration-300 text-center"
        >
          {{ $t('home.ctaMember') }}
        </router-link>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Custom styled element */
</style>

<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'

interface CarouselImage {
  id: string | number
  imageUrl: string
  alt: string
}

const props = defineProps<{
  images: CarouselImage[]
}>()

const emit = defineEmits<{
  select: [url: string]
}>()

const trackRef = ref<HTMLElement | null>(null)
const activeIndex = ref(0)
const hasOverflow = ref(false)

let resizeObserver: ResizeObserver | null = null

const updateOverflow = () => {
  const el = trackRef.value
  if (!el) return
  hasOverflow.value = el.scrollWidth - el.clientWidth > 1
}

// One "step" is a single slide's rendered width (which differs by
// breakpoint, e.g. 2-up on mobile vs 4-up on desktop) plus the track gap,
// measured live from the DOM rather than guessed from a media query.
const stepWidth = () => {
  const el = trackRef.value
  const slide = el?.firstElementChild as HTMLElement | undefined
  if (!el || !slide) return 0
  const gap = parseFloat(getComputedStyle(el).columnGap || '0')
  return slide.getBoundingClientRect().width + gap
}

const scrollToIndex = (index: number) => {
  const el = trackRef.value
  if (!el) return
  const clamped = Math.max(0, Math.min(index, props.images.length - 1))
  el.scrollTo({ left: clamped * stepWidth(), behavior: 'smooth' })
}

const prev = () => scrollToIndex(activeIndex.value - 1)
const next = () => scrollToIndex(activeIndex.value + 1)
const goTo = (index: number) => scrollToIndex(index)

const handleScroll = () => {
  const el = trackRef.value
  if (!el) return
  const step = stepWidth()
  activeIndex.value = step > 0 ? Math.round(el.scrollLeft / step) : 0
}

const handleSelect = (url: string) => {
  emit('select', url)
}

onMounted(() => {
  updateOverflow()
  resizeObserver = new ResizeObserver(() => updateOverflow())
  if (trackRef.value) resizeObserver.observe(trackRef.value)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
})

watch(() => props.images, async () => {
  activeIndex.value = 0
  await nextTick()
  trackRef.value?.scrollTo({ left: 0 })
  updateOverflow()
})
</script>

<template>
  <div class="relative">
    <div
      ref="trackRef"
      class="flex gap-2 overflow-x-auto snap-x snap-mandatory scroll-smooth hide-scrollbar"
      @scroll="handleScroll"
    >
      <div
        v-for="img in images"
        :key="img.id"
        class="w-1/2 md:w-1/4 flex-shrink-0 snap-start aspect-square bg-surface-container overflow-hidden cursor-zoom-in border border-outline-variant/20 shadow-sm"
        @click="handleSelect(img.imageUrl)"
      >
        <img :src="img.imageUrl" :alt="img.alt" class="w-full h-full object-cover" />
      </div>
    </div>

    <template v-if="hasOverflow">
      <button
        type="button"
        :disabled="activeIndex === 0"
        @click="prev"
        class="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 text-white bg-charcoal/70 hover:bg-charcoal disabled:opacity-30 disabled:cursor-not-allowed p-1.5 border border-white/20 transition-all rounded-full flex items-center justify-center"
      >
        <span class="material-symbols-outlined text-[18px]">chevron_left</span>
      </button>
      <button
        type="button"
        :disabled="activeIndex >= images.length - 1"
        @click="next"
        class="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 text-white bg-charcoal/70 hover:bg-charcoal disabled:opacity-30 disabled:cursor-not-allowed p-1.5 border border-white/20 transition-all rounded-full flex items-center justify-center"
      >
        <span class="material-symbols-outlined text-[18px]">chevron_right</span>
      </button>

      <div class="mt-3 flex items-center justify-center gap-1.5">
        <button
          v-for="(img, index) in images"
          :key="img.id"
          type="button"
          @click="goTo(index)"
          class="h-1.5 rounded-full transition-all duration-300"
          :class="index === activeIndex ? 'w-5 bg-on-surface' : 'w-1.5 bg-outline-variant hover:bg-secondary'"
        />
      </div>
    </template>
  </div>
</template>

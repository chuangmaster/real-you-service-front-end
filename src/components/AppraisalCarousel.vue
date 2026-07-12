<script setup lang="ts">
import { ref, computed, watch } from 'vue'

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

const activeIndex = ref(0)

watch(() => props.images, () => {
  activeIndex.value = 0
})

const showControls = computed(() => props.images.length > 1)

const goTo = (index: number) => {
  activeIndex.value = index
}

const prev = () => {
  activeIndex.value = (activeIndex.value - 1 + props.images.length) % props.images.length
}

const next = () => {
  activeIndex.value = (activeIndex.value + 1) % props.images.length
}

const handleSelect = () => {
  const active = props.images[activeIndex.value]
  if (active) emit('select', active.imageUrl)
}
</script>

<template>
  <div class="relative overflow-hidden aspect-[4/3] bg-surface-container border border-outline-variant/20 shadow-sm">
    <div
      class="flex h-full transition-transform duration-500 ease-out"
      :style="{ transform: `translateX(-${activeIndex * 100}%)` }"
    >
      <div
        v-for="img in images"
        :key="img.id"
        class="w-full h-full flex-shrink-0 cursor-zoom-in"
        @click="handleSelect"
      >
        <img :src="img.imageUrl" :alt="img.alt" class="w-full h-full object-cover" />
      </div>
    </div>

    <template v-if="showControls">
      <button
        type="button"
        @click.stop="prev"
        class="absolute left-2 top-1/2 -translate-y-1/2 text-white bg-charcoal/50 hover:bg-charcoal p-1.5 border border-white/20 transition-all rounded-full flex items-center justify-center"
      >
        <span class="material-symbols-outlined text-[18px]">chevron_left</span>
      </button>
      <button
        type="button"
        @click.stop="next"
        class="absolute right-2 top-1/2 -translate-y-1/2 text-white bg-charcoal/50 hover:bg-charcoal p-1.5 border border-white/20 transition-all rounded-full flex items-center justify-center"
      >
        <span class="material-symbols-outlined text-[18px]">chevron_right</span>
      </button>

      <div class="absolute bottom-3 inset-x-0 flex items-center justify-center gap-1.5">
        <button
          v-for="(img, index) in images"
          :key="img.id"
          type="button"
          @click.stop="goTo(index)"
          class="h-1.5 rounded-full transition-all duration-300"
          :class="index === activeIndex ? 'w-5 bg-white' : 'w-1.5 bg-white/50 hover:bg-white/75'"
        />
      </div>
    </template>
  </div>
</template>

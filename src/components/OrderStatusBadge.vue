<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  status: string
}>()

const { t } = useI18n()

// Tailwind's class scanner needs full literal class strings — building
// these with string interpolation (e.g. `bg-${color}/10`) would silently
// drop them from the production build.
const STATUS_STYLES: Record<string, { labelKey: string; colorClass: string }> = {
  PLACED: {
    labelKey: 'order.status.placed',
    colorClass: 'text-primary bg-primary/10 border-primary/20'
  },
  COMPLETED: {
    labelKey: 'order.status.completed',
    colorClass: 'text-authentic-emerald bg-authentic-emerald/10 border-authentic-emerald/20'
  },
  CANCELLED: {
    labelKey: 'order.status.cancelled',
    colorClass: 'text-error bg-error/10 border-error/20'
  }
}

const FALLBACK_COLOR_CLASS = 'text-secondary bg-secondary/10 border-secondary/20'

const style = computed(() => STATUS_STYLES[props.status])

const label = computed(() => (style.value ? t(style.value.labelKey) : props.status))
const colorClass = computed(() => style.value?.colorClass ?? FALLBACK_COLOR_CLASS)
</script>

<template>
  <span
    class="inline-flex items-center px-3 py-1 rounded-full border font-label-caps text-sm uppercase whitespace-nowrap"
    :class="colorClass"
  >
    {{ label }}
  </span>
</template>

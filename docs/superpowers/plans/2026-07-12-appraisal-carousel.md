# Appraisal Images Carousel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the "鑑定明細" (appraisal) images out of the Accessories section's static thumbnail grid, drop their standalone heading, and present them as a titleless carousel directly beneath the cover image on `ProductDetailView.vue`.

**Architecture:** A new dependency-free presentational component, `AppraisalCarousel.vue`, renders a single active image with prev/next arrows and dot indicators, sliding via CSS `transform: translateX(...)`. `ProductDetailView.vue` wraps the cover image and this new carousel in a shared column div (so they stack together inside the existing 2-column grid), removes the old appraisal heading + grid from the Accessories section, and wires the carousel's `select` event to the page's existing `openLightbox` function so zoom/pan behavior is unchanged.

**Tech Stack:** Vue 3 `<script setup lang="ts">`, Tailwind CSS (project's semantic design tokens), vue-i18n. No new npm dependencies.

## Global Constraints

- No new npm dependencies (spec: "不引入新依賴" — build the carousel by hand, matching the existing hand-rolled lightbox/modal pattern already in `ProductDetailView.vue`).
- Only `appraisalImages` (images with `imageType === 'APPRAISAL'`) are affected. `productImages` (the separate "商品照片" gallery) and the Accessories grid content are untouched.
- No autoplay, no touch/swipe gestures (explicitly out of scope per spec).
- Carousel aspect ratio: `aspect-[4/3]` (shorter than the cover image's `aspect-[4/5]`).
- Navigation: left/right arrow buttons + dot indicators; arrows and dots only render when there is more than one image.
- Clicking the visible carousel image opens the existing Lightbox (reuse `openLightbox`, do not build a second lightbox).
- All UI copy stays in `src/i18n.ts` for both `en` and `zh-TW` — this plan introduces no new copy, it reuses the existing `detail.appraisalImageAlt` key.
- This repo has no test runner and no lint script (`npm run type-check` runs `vue-tsc --noEmit`, `npm run build` runs a production Vite build — these are the available objective checks). Verification steps in this plan use those two commands plus manual browser checks via `npm run dev`.

---

### Task 1: `AppraisalCarousel.vue` component

**Files:**
- Create: `src/components/AppraisalCarousel.vue`

**Interfaces:**
- Produces: a component with
  - Props: `images: { id: string | number; imageUrl: string; alt: string }[]`
  - Emits: `select: [url: string]` — fired when the visible slide's image is clicked, payload is that slide's `imageUrl`
  - Root element is a single wrapping `<div>` so a `class` attribute passed by the parent falls through onto it (Vue's default attribute fallthrough for single-root components).

- [ ] **Step 1: Create the component directory if needed**

Run: `mkdir -p src/components`

- [ ] **Step 2: Write `src/components/AppraisalCarousel.vue`**

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'

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
```

- [ ] **Step 3: Type-check**

Run: `npm run type-check`
Expected: no errors reported for `src/components/AppraisalCarousel.vue` (pre-existing errors elsewhere in the repo, if any, are not this task's concern — only confirm no *new* errors point at this file).

- [ ] **Step 4: Commit**

```bash
git add src/components/AppraisalCarousel.vue
git commit -m "feat: add AppraisalCarousel component"
```

---

### Task 2: Wire the carousel into `ProductDetailView.vue`

**Files:**
- Modify: `src/views/ProductDetailView.vue`

**Interfaces:**
- Consumes: `AppraisalCarousel` from Task 1 — props `images: { id, imageUrl, alt }[]`, emits `select: [url: string]`.
- Consumes existing `openLightbox(url: string)` (already defined in this file) as the `@select` handler — no changes to `openLightbox` itself.
- Consumes existing `appraisalImages` computed (already defined in this file, sorted, filtered to `imageType === 'APPRAISAL'`).

- [ ] **Step 1: Import the component and `t`-mapped image list**

In the `<script setup>` block, add the import near the other imports (after the `QRCode` import):

```ts
import AppraisalCarousel from '../components/AppraisalCarousel.vue'
```

Add a new computed directly after the existing `appraisalImages` computed (which filters `sortedImages` by `imageType === 'APPRAISAL'`):

```ts
// Appraisal images mapped for the carousel, with i18n alt text baked in so
// the carousel component itself stays presentational/i18n-agnostic
const appraisalCarouselImages = computed(() =>
  appraisalImages.value.map((img, index) => ({
    id: img.id,
    imageUrl: img.imageUrl,
    alt: t('detail.appraisalImageAlt', { n: index + 1 })
  }))
)
```

- [ ] **Step 2: Wrap the cover image and add the carousel below it**

Find this block (the "Cover Image & Specifications" section):

```html
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
```

Replace it with:

```html
        <!-- Cover Image & Specifications -->
        <section class="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop grid grid-cols-1 lg:grid-cols-2 gap-20 mb-32">
          <!-- Cover Image Column -->
          <div>
            <div class="relative overflow-hidden aspect-[4/5] bg-surface-container border border-outline-variant/20 shadow-sm group">
              <img
                :alt="`${item.brandName || 'Brand'} - ${item.styleName || 'Style'}`"
                class="w-full h-full object-contain transition-transform duration-[2000ms] group-hover:scale-105"
                :src="coverImage"
              />
            </div>

            <AppraisalCarousel
              v-if="appraisalCarouselImages.length > 0"
              :images="appraisalCarouselImages"
              class="mt-6"
              @select="openLightbox"
            />
          </div>

          <!-- Details -->
```

This introduces a wrapping `<div>` around the cover image + new carousel so they stack as column 1 of the grid; the following `<!-- Details -->` div (unchanged, not shown here) remains column 2.

- [ ] **Step 3: Remove the appraisal heading + grid from the Accessories section**

Find this block:

```html
        <!-- Accessories -->
        <section class="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop mb-32">
          <!-- Appraisal Detail Images -->
          <h2 class="font-headline-sm text-[16px] mb-8 pb-4 border-b border-antique-gold/30">
            {{ $t('detail.tabAppraisal') }}
          </h2>
          <div class="grid grid-cols-5 md:grid-cols-8 lg:grid-cols-10 gap-2">
            <div
              v-for="(img, index) in appraisalImages"
              :key="img.id"
              @click="openLightbox(img.imageUrl)"
              class="aspect-square bg-surface-container overflow-hidden group relative cursor-pointer border border-outline-variant/20 shadow-sm"
            >
              <img
                :alt="$t('detail.appraisalImageAlt', { n: index + 1 })"
                class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                :src="img.imageUrl"
              />
              <div class="absolute inset-0 bg-charcoal/0 group-hover:bg-charcoal/20 transition-colors duration-300 flex items-center justify-center">
                <span class="material-symbols-outlined text-white opacity-0 group-hover:opacity-100 scale-50 group-hover:scale-100 transition-all text-[20px]">
                  zoom_in
                </span>
              </div>
            </div>
          </div>

          <div class="mt-16">
            <h2 class="font-headline-sm text-[16px] mb-12 border-b border-antique-gold/30 pb-4">
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
          </div>
        </section>
```

Replace it with:

```html
        <!-- Accessories -->
        <section class="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop mb-32">
          <h2 class="font-headline-sm text-[16px] mb-12 border-b border-antique-gold/30 pb-4">
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
```

- [ ] **Step 4: Type-check and build**

Run: `npm run type-check`
Expected: no new errors.

Run: `npm run build`
Expected: build succeeds (exit code 0), confirming the template compiles and there are no unused/missing references (e.g. `appraisalImages` is still used by `appraisalCarouselImages`, so no unused-variable issue).

- [ ] **Step 5: Manual browser verification**

Run: `npm run dev`

Navigate to a product detail page that has at least two appraisal images (`/product/{id}` for an inventory ID whose backend record includes `images[]` entries with `imageType: "APPRAISAL"` — check with whoever owns backend test data if you don't have one handy; the backend must be reachable, default `http://localhost:5176`).

Confirm:
- No "鑑定明細" / "Appraisal Detail" heading appears anywhere on the page.
- Directly below the cover image (same column, above/left of the specifications block on desktop widths), a carousel shows one appraisal image at a time.
- Left/right arrow buttons step through the images; dot indicators reflect the current slide and are clickable to jump directly to a slide.
- Clicking the visible carousel image opens the existing Lightbox modal (zoom in/out and pan still work as before).
- The Accessories section below still renders normally with no leftover heading or empty space where the old grid was.
- Load a product detail page with **zero** appraisal images (or temporarily edit test data) and confirm the carousel does not render at all (no empty box, no broken arrows).
- Toggle the locale (EN / 繁中 toggle in the certificate modal, or however the page exposes it) and confirm the carousel's image alt text changes language (inspect via browser dev tools' accessibility panel or `outerHTML`, since alt text isn't visible directly).

- [ ] **Step 6: Commit**

```bash
git add src/views/ProductDetailView.vue
git commit -m "feat: move appraisal images into titleless carousel below cover image"
```

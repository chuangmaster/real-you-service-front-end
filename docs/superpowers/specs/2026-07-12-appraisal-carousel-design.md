# Appraisal Images Carousel — Design

## Problem

On the product detail page (`ProductDetailView.vue`), the "鑑定明細" (Appraisal Detail) section currently:
- Has its own heading (`$t('detail.tabAppraisal')`)
- Renders `appraisalImages` as a small static thumbnail grid inside the "Accessories" section, visually disconnected from the cover image

This is being reworked so the appraisal images read as an extension of the cover image instead of a separate labeled block.

## Scope

- Only `appraisalImages` (images with `imageType === 'APPRAISAL'`) are affected.
- The separate "商品照片" / Product Photos gallery (`productImages`) is untouched.
- The "配件" (Accessories) grid is untouched, other than losing its now-orphaned sibling block.

## Changes

### 1. Remove the appraisal section heading

The `<h2>{{ $t('detail.tabAppraisal') }}</h2>` heading and its surrounding thumbnail grid are removed from the "Accessories" section (`ProductDetailView.vue` around lines 412–437). The "Accessories" section keeps only its own heading + grid; the now-unneeded `mt-16` wrapper div around the accessories block is removed since it's no longer the second of two stacked blocks.

### 2. New carousel placement

The cover image currently sits as a direct child of a 2-column grid (`grid-cols-1 lg:grid-cols-2`), sibling to the specifications details block. A new wrapper `<div>` is introduced so column 1 contains both the cover image and the carousel stacked vertically; column 2 (specifications) is unchanged:

```
[grid: 1 col mobile / 2 col desktop]
  [wrapper div]              [details div - unchanged]
    - cover image
    - AppraisalCarousel (v-if appraisalImages.length > 0)
```

The carousel sits directly below the cover image with `mt-6` spacing.

### 3. New component: `src/components/AppraisalCarousel.vue`

A self-contained, dependency-free carousel (no new npm package — matches the existing hand-rolled lightbox/modal pattern already used in this view).

**Props:**
- `images: InventoryImage[]`

**Emits:**
- `select(url: string)` — fired when the active slide image is clicked; parent wires this to the existing `openLightbox` function so zoom/pan behavior is reused as-is.

**Behavior:**
- Single image visible at a time, sliding via `translateX(-activeIndex * 100%)` on a flex track, `transition-transform`.
- Left/right arrow buttons (previous/next), only rendered when `images.length > 1`.
- Dot indicators below the image, one per image, only rendered when `images.length > 1`; active dot visually distinct (wider/filled vs. muted).
- No autoplay.
- No touch/swipe gesture support (not required; can be added later if needed).
- Aspect ratio `aspect-[4/3]` (shorter than the cover image's `aspect-[4/5]`, keeping the stacked column from growing too tall).
- Clicking the visible image emits `select` with that image's `imageUrl`.

**Not rendered at all** (by the parent, via `v-if`) when `appraisalImages.length === 0` — preserves current behavior of appraisal images being optional.

## Out of scope

- Touch swipe gestures
- Autoplay
- Thumbnail-strip navigation (explicitly declined in favor of arrows + dots)
- Any change to `productImages` gallery or Accessories grid content
- Any change to i18n strings (no new heading text is introduced; existing `detail.appraisalImageAlt` is reused for alt text)

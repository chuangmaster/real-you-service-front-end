# Brand Homepage Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the current UUID-search homepage into a dedicated `/identification-report` page, and turn `/` into a brand hero landing page with entry points to both the search page and the member center.

**Architecture:** `HomeView.vue`'s existing search-form content moves verbatim into a new `IdentificationReportView.vue` at a new route; `HomeView.vue` itself is rewritten as a two-column (desktop) / stacked (mobile) brand hero using the existing-but-unused `src/assets/hero.png` asset. i18n keys move and are added alongside the code that uses them. Nav bar and one existing return-link get their targets updated to match.

**Tech Stack:** Vue 3 `<script setup lang="ts">`, `vue-router`, `vue-i18n` — no new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-16-brand-homepage-redesign-design.md`

## Global Constraints

- This repo has no test runner and no lint script (confirmed in `CLAUDE.md`). Verification uses `npm run type-check` (`vue-tsc --noEmit`), `npm run build`, and manual `npm run dev` browser checks.
- **Branch dependency:** this plan references the named route `member-profile`, which does not exist on `main` — it's defined by the separate, already-implemented-but-not-yet-merged `worktree-liff-member-center` branch (`docs/superpowers/plans/2026-08-15-liff-member-center.md`). **Do not start this plan from `main`.** Start the implementation worktree/branch from `worktree-liff-member-center` (locally, or `origin/worktree-liff-member-center`), so `/member` and its routes already exist when this plan's router-link references to `{ name: 'member-profile' }` are added. This branch must merge after (or together with) the member-center branch — merging this branch alone into `main` first would ship a broken "Member Center" link until the member-center branch lands too.
- `/product/:id` (the certificate page) keeps its current public, no-login access — out of scope for this plan, do not add any auth to it.
- i18n content is finalized verbatim in Task 1 — do not paraphrase or adjust wording.
- `src/assets/hero.png` already exists in the repo and is currently unused — import it directly (`import heroImage from '../assets/hero.png'`), do not add a new image file.
- Reuse existing design tokens only (colors, `font-*` classes, spacing) — no new Tailwind config entries, no new fonts.

---

### Task 1: Move `home.*` i18n content to `identificationReport.*`, add new brand `home.*` + `nav.memberCenter`

**Files:**
- Modify: `src/i18n.ts` (the `en` locale's `nav`/`home` blocks near the top, and the `zh-TW` locale's `nav`/`home` blocks)

**Interfaces:**
- Produces: i18n keys `identificationReport.{subtitle,title,description,idLabel,idPlaceholder,verifyBtn}`, `identificationReport.errors.{required,invalid}` (content identical to the old `home.*` keys they replace) — consumed by `IdentificationReportView.vue` in Task 2. New keys `home.{tagline,heroTitle,heroDescription,ctaSearch,ctaMember}` — consumed by the rewritten `HomeView.vue` in Task 3. New key `nav.memberCenter` — consumed by `App.vue` in Task 5.
- Consumes: nothing new.

- [ ] **Step 1: Replace the English `nav`/`home` blocks**

Find this in `src/i18n.ts` (start of the `en` locale):

```ts
    nav: {
      searchReport: 'Search Report',
    },
    home: {
      subtitle: 'Luxury Authentication Report Lookup',
      title: 'REAL YOU CERTIFICATE',
      description: 'Enter the 36-character product identification ID to view the certificate of authenticity, specifications, and inspection gallery.',
      idLabel: 'Product ID (UUID)',
      idPlaceholder: 'e.g. 875efd5f-21f9-4940-a26b-b463396e56d2',
      verifyBtn: 'SEARCH',
      errors: {
        required: 'Please enter a product identification code.',
        invalid: 'Invalid ID format. Please use a valid 36-character Product ID.'
      }
    },
```

Replace with:

```ts
    nav: {
      searchReport: 'Search Report',
      memberCenter: 'Member Center',
    },
    home: {
      tagline: 'TRUSTED LUXURY AUTHENTICATION',
      heroTitle: 'Authenticity You Can Trust',
      heroDescription: 'REAL YOU delivers professional luxury goods authentication, backed by years of expert inspection — giving every piece verifiable proof of authenticity.',
      ctaSearch: 'VIEW AUTHENTICATION REPORT',
      ctaMember: 'MEMBER CENTER'
    },
    identificationReport: {
      subtitle: 'Luxury Authentication Report Lookup',
      title: 'REAL YOU CERTIFICATE',
      description: 'Enter the 36-character product identification ID to view the certificate of authenticity, specifications, and inspection gallery.',
      idLabel: 'Product ID (UUID)',
      idPlaceholder: 'e.g. 875efd5f-21f9-4940-a26b-b463396e56d2',
      verifyBtn: 'SEARCH',
      errors: {
        required: 'Please enter a product identification code.',
        invalid: 'Invalid ID format. Please use a valid 36-character Product ID.'
      }
    },
```

- [ ] **Step 2: Replace the Traditional Chinese `nav`/`home` blocks**

Find this in `src/i18n.ts` (start of the `zh-TW` locale):

```ts
    nav: {
      searchReport: '報告檢索',
    },
    home: {
      subtitle: '奢侈品鑑定報告查詢',
      title: 'REAL YOU 鑑定證書',
      description: '請輸入 36 碼商品識別 ID，即可查看商品真品證明書、詳細規格及細節檢驗圖庫。',
      idLabel: '商品 ID (UUID)',
      idPlaceholder: '例如：875efd5f-21f9-4940-a26b-b463396e56d2',
      verifyBtn: '搜尋',
      errors: {
        required: '請輸入商品識別代碼。',
        invalid: '無效的 ID 格式。請使用有效的 36 碼商品 ID。'
      }
    },
```

Replace with:

```ts
    nav: {
      searchReport: '報告檢索',
      memberCenter: '會員中心',
    },
    home: {
      tagline: '精品鑑定權威',
      heroTitle: '真偽，一眼可鑑',
      heroDescription: 'REAL YOU 提供專業精品鑑定服務，結合多年鑑定團隊經驗，為您的每一件精品建立可靠的真偽證明。',
      ctaSearch: '查詢鑑定報告',
      ctaMember: '會員中心'
    },
    identificationReport: {
      subtitle: '奢侈品鑑定報告查詢',
      title: 'REAL YOU 鑑定證書',
      description: '請輸入 36 碼商品識別 ID，即可查看商品真品證明書、詳細規格及細節檢驗圖庫。',
      idLabel: '商品 ID (UUID)',
      idPlaceholder: '例如：875efd5f-21f9-4940-a26b-b463396e56d2',
      verifyBtn: '搜尋',
      errors: {
        required: '請輸入商品識別代碼。',
        invalid: '無效的 ID 格式。請使用有效的 36 碼商品 ID。'
      }
    },
```

- [ ] **Step 3: Type-check**

Run: `npm run type-check`
Expected: passes with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/i18n.ts
git commit -m "feat: move home i18n to identificationReport, add brand home copy

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Create `IdentificationReportView.vue`

**Files:**
- Create: `src/views/IdentificationReportView.vue`

**Interfaces:**
- Consumes: i18n keys `identificationReport.*` (Task 1).
- Produces: `IdentificationReportView.vue`, mounted at route name `identification-report` in Task 4.

- [ ] **Step 1: Create the component**

This is the existing `HomeView.vue`'s search-form content, moved verbatim, with i18n key prefixes changed from `home.` to `identificationReport.`. No logic changes.

```vue
<script setup lang="ts">
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
    error.value = t('identificationReport.errors.required')
    return
  }

  // Basic UUID format check
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(cleanId)) {
    error.value = t('identificationReport.errors.invalid')
    return
  }

  router.push({ name: 'product-detail', params: { id: cleanId } })
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
        {{ $t('identificationReport.subtitle') }}
      </span>
      <h1 class="font-headline-md text-4xl md:text-5xl text-on-surface mb-8 font-serif">
        {{ $t('identificationReport.title') }}
      </h1>
      <p class="font-body-md text-secondary max-w-md mx-auto mb-12">
        {{ $t('identificationReport.description') }}
      </p>

      <!-- Search Card -->
      <div class="bg-surface-container-low border border-outline-variant/30 p-8 md:p-10 mb-12 luxury-blur">
        <form @submit.prevent="handleSearch" class="space-y-6">
          <div class="text-left">
            <label for="productId" class="font-label-caps text-[10px] text-secondary tracking-widest uppercase block mb-3">
              {{ $t('identificationReport.idLabel') }}
            </label>
            <div class="relative">
              <input
                id="productId"
                v-model="searchId"
                type="text"
                :placeholder="$t('identificationReport.idPlaceholder')"
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
            {{ $t('identificationReport.verifyBtn') }}
          </button>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Custom styled element */
</style>
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: passes with no errors.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/views/IdentificationReportView.vue
git commit -m "feat: add IdentificationReportView with the existing search form

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Rewrite `HomeView.vue` as the brand hero page

**Files:**
- Modify: `src/views/HomeView.vue` (full rewrite)

**Interfaces:**
- Consumes: i18n keys `home.{tagline,heroTitle,heroDescription,ctaSearch,ctaMember}` (Task 1); named routes `identification-report` (Task 4 — not yet defined when this task runs, but route names are `string | symbol` in `RouteLocationRaw` so this still type-checks; the link simply won't resolve correctly until Task 4 lands, which is fine since Task 4 comes right after) and `member-profile` (already defined on the `worktree-liff-member-center` base branch this plan builds on — see Global Constraints); `src/assets/hero.png` (existing asset).
- Produces: `HomeView.vue`, mounted at route name `home` (unchanged) — the parent `/` route already exists in `src/router/index.ts`, this task only changes what component/content it renders.

- [ ] **Step 1: Rewrite the component**

```vue
<script setup lang="ts">
import heroImage from '../assets/hero.png'
</script>

<template>
  <div class="relative min-h-[80vh] flex items-center px-margin-mobile py-16 overflow-hidden">
    <!-- Background glow elements -->
    <div class="absolute inset-0 overflow-hidden pointer-events-none">
      <div class="absolute top-[20%] left-[10%] w-[300px] h-[300px] bg-primary-container/10 rounded-full blur-[80px]"></div>
      <div class="absolute bottom-[20%] right-[10%] w-[400px] h-[400px] bg-primary/5 rounded-full blur-[100px]"></div>
    </div>

    <div class="relative z-10 w-full max-w-container-max mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
      <!-- Hero image -->
      <div class="flex justify-center">
        <img
          :src="heroImage"
          alt="REAL YOU"
          class="w-full max-w-sm rounded-xl border border-outline-variant/30 object-cover shadow-sm"
        />
      </div>

      <!-- Text + CTAs -->
      <div class="text-center md:text-left">
        <span class="font-data-mono text-label-caps text-primary tracking-[0.2em] uppercase mb-4 block">
          {{ $t('home.tagline') }}
        </span>
        <h1 class="font-headline-md text-4xl md:text-5xl text-on-surface mb-6 font-serif">
          {{ $t('home.heroTitle') }}
        </h1>
        <p class="font-body-md text-secondary max-w-md mx-auto md:mx-0 mb-10">
          {{ $t('home.heroDescription') }}
        </p>

        <div class="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
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
  </div>
</template>

<style scoped>
/* Custom styled element */
</style>
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: passes with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/views/HomeView.vue
git commit -m "feat: rewrite HomeView as the brand hero landing page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

(No build/manual-check step here — Task 4 wires the `identification-report` route this page links to, and the full page only renders correctly end-to-end once that lands. Build/manual verification happens in Task 4.)

---

### Task 4: Wire the `/identification-report` route and update `/`'s title

**Files:**
- Modify: `src/router/index.ts`

**Interfaces:**
- Consumes: `IdentificationReportView.vue` (Task 2).
- Produces: named route `identification-report` at path `/identification-report` — consumed by `HomeView.vue` (Task 3), `App.vue` and `ProductDetailView.vue` (Task 5).

- [ ] **Step 1: Add the import**

Find this in `src/router/index.ts`:

```ts
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import ProductDetailView from '../views/ProductDetailView.vue'
```

Replace with:

```ts
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import IdentificationReportView from '../views/IdentificationReportView.vue'
import ProductDetailView from '../views/ProductDetailView.vue'
```

- [ ] **Step 2: Add the route and update `/`'s title**

Find this in `src/router/index.ts`:

```ts
const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: HomeView,
    meta: { title: 'REAL YOU | 精品鑑定查詢' }
  },
  {
    path: '/product/:id',
```

Replace with:

```ts
const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: HomeView,
    meta: { title: 'REAL YOU | 精品鑑定權威' }
  },
  {
    path: '/identification-report',
    name: 'identification-report',
    component: IdentificationReportView,
    meta: { title: 'REAL YOU | 鑑定報告查詢' }
  },
  {
    path: '/product/:id',
```

- [ ] **Step 3: Type-check**

Run: `npm run type-check`
Expected: passes with no errors.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: succeeds with no errors.

- [ ] **Step 5: Manual smoke test**

Run: `npm run dev`, then in a browser:
- Open `http://localhost:5173/` — expect the brand hero page (image, headline, two CTA buttons), not the search form.
- Click the primary CTA button — expect navigation to `/identification-report`, showing the search form (same as the old homepage).
- On `/identification-report`, enter a valid-format UUID and submit — expect navigation to `/product/:id`.
- Click the secondary CTA button on `/` — expect navigation toward `/member/profile` (it will trigger the member center's login gate; confirming the route resolves without a "no match" console error is sufficient here — full login flow verification is out of scope for this plan, already covered by the member-center plan).

- [ ] **Step 6: Commit**

```bash
git add src/router/index.ts
git commit -m "feat: add /identification-report route, update home page title

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Update nav bar and the certificate page's return link

**Files:**
- Modify: `src/App.vue`
- Modify: `src/views/ProductDetailView.vue:377-379`

**Interfaces:**
- Consumes: named route `identification-report` (Task 4), named route `member-profile` (already exists on the base branch), i18n key `nav.memberCenter` (Task 1).
- Produces: nothing new — this is the last task, both are small same-shape "point this link at the right route name" edits, batched into one task.

- [ ] **Step 1: Update the nav bar in `App.vue`**

Find this in `src/App.vue`:

```html
        <div class="flex items-center gap-6">
          <router-link to="/" class="font-label-caps text-xs tracking-wider text-secondary hover:text-primary transition-colors">
            {{ $t('nav.searchReport') }}
          </router-link>
          <button @click="toggleLocale" class="font-label-caps text-xs tracking-wider text-secondary hover:text-primary transition-colors border border-outline-variant/30 px-2 py-1 rounded hover:border-primary">
            {{ locale === 'en' ? '繁中' : 'EN' }}
          </button>
```

Replace with:

```html
        <div class="flex items-center gap-6">
          <router-link :to="{ name: 'identification-report' }" class="font-label-caps text-xs tracking-wider text-secondary hover:text-primary transition-colors">
            {{ $t('nav.searchReport') }}
          </router-link>
          <router-link :to="{ name: 'member-profile' }" class="font-label-caps text-xs tracking-wider text-secondary hover:text-primary transition-colors">
            {{ $t('nav.memberCenter') }}
          </router-link>
          <button @click="toggleLocale" class="font-label-caps text-xs tracking-wider text-secondary hover:text-primary transition-colors border border-outline-variant/30 px-2 py-1 rounded hover:border-primary">
            {{ locale === 'en' ? '繁中' : 'EN' }}
          </button>
```

Note: the top-left brand-logo `router-link to="/"` (a separate element, just above this block) stays as `to="/"` — unchanged, it should keep linking to the home route regardless of name.

- [ ] **Step 2: Update the return link in `ProductDetailView.vue`**

Find this in `src/views/ProductDetailView.vue` (around line 377):

```html
      <router-link to="/" class="bg-primary text-white px-10 py-4 font-label-caps text-label-caps tracking-widest hover:bg-primary-container transition-colors duration-300">
        {{ $t('detail.returnBtn') }}
      </router-link>
```

Replace with:

```html
      <router-link :to="{ name: 'identification-report' }" class="bg-primary text-white px-10 py-4 font-label-caps text-label-caps tracking-widest hover:bg-primary-container transition-colors duration-300">
        {{ $t('detail.returnBtn') }}
      </router-link>
```

- [ ] **Step 3: Type-check**

Run: `npm run type-check`
Expected: passes with no errors.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: succeeds with no errors.

- [ ] **Step 5: Manual smoke test**

Run: `npm run dev`, then in a browser:
- On any page with the nav bar visible (e.g. `/identification-report`), confirm "Search Report" / "報告檢索" and the new "Member Center" / "會員中心" links both appear and navigate correctly.
- Open `http://localhost:5173/product/00000000-0000-0000-0000-000000000000` (a UUID that 404s) — confirm the error state's "RETURN TO SEARCH" button navigates to `/identification-report`, not `/`.

- [ ] **Step 6: Commit**

```bash
git add src/App.vue src/views/ProductDetailView.vue
git commit -m "feat: point nav bar and certificate return link at new routes

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

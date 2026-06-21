# Update Favicon and Remove Redundant Icons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current favicon in `index.html` with `public/favicon.png` and delete all redundant, unused icon files from the repository.

**Architecture:** Update the HTML link reference in `index.html` to point to `/favicon.png` with the correct MIME type (`image/png`). Remove the redundant `favicon.svg` and `icons.svg` from the `public/` folder, and clean up the unused default icons `vite.svg` and `vue.svg` from the `src/assets/` folder to keep the codebase clean.

**Tech Stack:** HTML, Git, Vite

---

### Task 1: Update Favicon Reference in index.html

**Files:**
- Modify: [index.html](file:///D:/Repository/real-you/real-you-service-front-end/index.html)

- [ ] **Step 1: Modify index.html**
  Update the `<link rel="icon" ...>` tag to reference `/favicon.png` instead of `/vite.svg`.
  
  ```html
  <<<<
      <link rel="icon" type="image/svg+xml" href="/vite.svg" />
  ====
      <link rel="icon" type="image/png" href="/favicon.png" />
  >>>>
  ```

---

### Task 2: Delete Redundant/Unused Assets

**Files:**
- Modify: Delete unused icon and asset files

- [ ] **Step 1: Delete public/favicon.svg**
  Run: `git rm public/favicon.svg`
  
- [ ] **Step 2: Delete public/icons.svg**
  Run: `git rm public/icons.svg`
  
- [ ] **Step 3: Delete src/assets/vite.svg**
  Run: `git rm src/assets/vite.svg`
  
- [ ] **Step 4: Delete src/assets/vue.svg**
  Run: `git rm src/assets/vue.svg`

---

### Task 3: Verification & Commit

**Files:**
- None

- [ ] **Step 1: Verify index.html reference**
  Ensure `/favicon.png` is the only favicon reference.
  
- [ ] **Step 2: Start the dev server**
  Run: `npm run dev` or build the app to verify there are no compilation or layout issues.
  
- [ ] **Step 3: Check git status**
  Run: `git status` to verify changes.
  
- [ ] **Step 4: Commit changes**
  Run:
  ```bash
  git add index.html public/favicon.png
  git commit -m "chore: update favicon to favicon.png and remove redundant icons"
  ```

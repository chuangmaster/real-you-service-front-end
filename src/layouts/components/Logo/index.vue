<script setup lang="ts">
withDefaults(
  defineProps<{
    collapse?: boolean
    isTop?: boolean
  }>(),
  {
    collapse: false,
    isTop: false
  }
)
</script>

<template>
  <div
    class="logo-container"
    :style="{
      height: isTop ? 'var(--v3-navigationbar-height)' : 'var(--v3-header-height)'
    }"
  >
    <transition name="layout-logo-fade" mode="out-in">
      <span v-if="!collapse" class="layout-logo-text">REAL YOU</span>
      <span v-else class="layout-logo-abbr">RY</span>
    </transition>
  </div>
</template>

<style scoped>
.logo-container {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  overflow: hidden;
}

.layout-logo-text {
  font-family: "AFuturaOrto", sans-serif;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 5px;
  color: var(--v3-sidebar-menu-active-text-color);
  line-height: 1;
  white-space: nowrap;
}

.layout-logo-abbr {
  font-family: "AFuturaOrto", sans-serif;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 3px;
  color: var(--v3-sidebar-menu-active-text-color);
  line-height: 1;
  white-space: nowrap;
}

/* Transition Animation styles */
.layout-logo-fade-enter-active,
.layout-logo-fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.layout-logo-fade-enter-from {
  opacity: 0;
  transform: scale(0.9);
}
.layout-logo-fade-leave-to {
  opacity: 0;
  transform: scale(0.9);
}
</style>

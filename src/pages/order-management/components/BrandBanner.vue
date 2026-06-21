<script setup>
// Print banner component for certificates and order sheets
</script>

<template>
  <div class="brand-banner-container">
    <h2 class="brand-logo-text">REAL YOU</h2>
    <div class="brand-slogan">無懼追求唯真世代</div>
    <div class="brand-subtitle">— LVMH 集團授權鑑定中心 —</div>
  </div>
</template>

<style scoped>
.brand-banner-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  width: 100%;
  padding: 16px 0;
}

.brand-logo-text {
  font-family: "AFuturaOrto", sans-serif;
  font-size: 28px;
  font-weight: 700;
  letter-spacing: 6px;
  margin: 0 0 8px;
  color: var(--el-text-color-primary);
  line-height: 1;
  white-space: nowrap;
}

.brand-slogan {
  font-size: 12px;
  letter-spacing: 8px;
  margin: 0 0 4px;
  color: var(--el-text-color-primary);
}

.brand-subtitle {
  font-size: 7.2px;
  letter-spacing: 3px;
  color: var(--el-text-color-secondary, #909399);
}

/* Prevent text overflow */
.brand-logo-text,
.brand-slogan,
.brand-subtitle {
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
  max-width: 100%;
}
</style>

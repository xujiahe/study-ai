<template>
  <div class="app-layout">
    <Sidebar class="app-sidebar" />
    <main class="app-main">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import Sidebar from "./Sidebar.vue";
</script>

<style scoped>
.app-layout {
  display: flex;
  height: 100vh;
  overflow: hidden;
  background: #f5f5f5;
}

.app-sidebar {
  width: 260px;
  flex-shrink: 0;
  border-right: 1px solid #e0e0e0;
  background: #fff;
  overflow-y: auto;
}

.app-main {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
</style>

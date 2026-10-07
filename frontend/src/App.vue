<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router';
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <div>
        <p class="eyebrow">60-minute delivery</p>
        <h1>Gigabox Ops Lite</h1>
      </div>
      <nav>
        <RouterLink to="/orders">Orders</RouterLink>
        <RouterLink to="/inventory">Inventory</RouterLink>
      </nav>
    </header>
    <main>
      <RouterView />
    </main>
  </div>
</template>

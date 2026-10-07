<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useInventoryStore } from '../stores/inventory';

const store = useInventoryStore();
const quantities = ref<Record<string, number>>({});

onMounted(async () => {
  await store.fetchStores();
  await store.fetchInventory();
});

async function changeStore() {
  await store.fetchInventory();
}

function quantityFor(productId: string) {
  return quantities.value[productId] ?? 1;
}

function setQuantity(productId: string, value: string) {
  const parsed = Number(value);
  quantities.value[productId] = Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}

function apply(productId: string, sign: 1 | -1) {
  const magnitude = Math.abs(quantityFor(productId));
  if (magnitude === 0) return;
  void store.adjust(productId, sign * magnitude);
}
</script>

<template>
  <section class="panel">
    <form class="toolbar" @submit.prevent="changeStore">
      <label>
        Store
        <select v-model="store.storeId" @change="changeStore">
          <option v-for="item in store.stores" :key="item.id" :value="item.id">{{ item.name }}</option>
        </select>
      </label>
    </form>

    <p v-if="store.actionError" class="error">{{ store.actionError }}</p>
    <p v-if="store.error" class="error">{{ store.error }}</p>
    <p v-else-if="store.loading" class="loading">Loading inventory…</p>
    <p v-else-if="store.rows.length === 0" class="empty">This store has no inventory records.</p>

    <div v-else class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Product</th>
            <th>SKU</th>
            <th>Stock</th>
            <th>Low-stock threshold</th>
            <th>Status</th>
            <th>Adjust</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in store.rows" :key="row.id" :class="{ low: row.lowStock }">
            <td>{{ row.product.name }}</td>
            <td class="mono">{{ row.product.sku }}</td>
            <td>{{ row.stock }}</td>
            <td>{{ row.lowStockThreshold }}</td>
            <td>
              <span class="badge" :class="row.lowStock ? 'CANCELLED' : 'PLACED'">
                {{ row.lowStock ? 'Low stock' : 'In stock' }}
              </span>
            </td>
            <td>
              <div class="adjust">
                <input
                  type="number"
                  min="1"
                  step="1"
                  :value="quantityFor(row.productId)"
                  @input="setQuantity(row.productId, ($event.target as HTMLInputElement).value)"
                />
                <button type="button" :disabled="store.pendingProductId === row.productId" @click="apply(row.productId, 1)">
                  Add stock
                </button>
                <button
                  class="secondary"
                  type="button"
                  :disabled="store.pendingProductId === row.productId"
                  @click="apply(row.productId, -1)"
                >
                  Remove stock
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

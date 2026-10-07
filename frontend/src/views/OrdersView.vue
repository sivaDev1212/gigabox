<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useOrdersStore } from '../stores/orders';
import type { Order, OrderStatus } from '../types';

const store = useOrdersStore();

const actions: Record<OrderStatus, Array<{ status: OrderStatus; label: string; danger?: boolean }>> = {
  PLACED: [
    { status: 'PACKED', label: 'Mark Packed' },
    { status: 'CANCELLED', label: 'Cancel', danger: true },
  ],
  PACKED: [
    { status: 'OUT_FOR_DELIVERY', label: 'Out for Delivery' },
    { status: 'CANCELLED', label: 'Cancel', danger: true },
  ],
  OUT_FOR_DELIVERY: [{ status: 'DELIVERED', label: 'Mark Delivered' }],
  DELIVERED: [],
  CANCELLED: [],
};

const statusLabel: Record<OrderStatus, string> = {
  PLACED: 'Placed',
  PACKED: 'Packed',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

const showing = computed(() => {
  if (store.pagination.total === 0) return 'No orders';
  const start = (store.pagination.page - 1) * store.pagination.limit + 1;
  const end = Math.min(store.pagination.page * store.pagination.limit, store.pagination.total);
  return `${start}-${end} of ${store.pagination.total}`;
});

onMounted(async () => {
  await store.fetchStores();
  await store.fetchOrders();
});

async function applyFilters() {
  store.setPage(1);
  await store.fetchOrders();
}

async function changePage(page: number) {
  store.setPage(page);
  await store.fetchOrders();
}

function runAction(order: Order, next: OrderStatus) {
  if (next === 'CANCELLED' && !window.confirm('Cancel this order and return the items to stock?')) return;
  void store.updateStatus(order.id, next);
}

function formatWhen(value: string) {
  return new Date(value).toLocaleString();
}

function shortId(id: string) {
  return id.slice(-8);
}
</script>

<template>
  <section class="panel">
    <form class="toolbar" @submit.prevent="applyFilters">
      <label>
        Status
        <select v-model="store.status">
          <option value="">All</option>
          <option value="PLACED">Placed</option>
          <option value="PACKED">Packed</option>
          <option value="OUT_FOR_DELIVERY">Out for delivery</option>
          <option value="DELIVERED">Delivered</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </label>
      <label>
        Store
        <select v-model="store.storeId">
          <option value="">All stores</option>
          <option v-for="item in store.stores" :key="item.id" :value="item.id">{{ item.name }}</option>
        </select>
      </label>
      <button type="submit">Apply</button>
    </form>

    <p v-if="store.actionError" class="error">{{ store.actionError }}</p>
    <p v-if="store.error" class="error">{{ store.error }}</p>
    <p v-else-if="store.loading" class="loading">Loading orders…</p>
    <p v-else-if="store.orders.length === 0" class="empty">No orders match these filters.</p>

    <div v-else class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Order</th>
            <th>Store</th>
            <th>Created</th>
            <th>Items Count</th>
            <th>Items</th>
            <th>Total</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="order in store.orders" :key="order.id">
            <td>
              <div class="mono" :title="order.id">{{ shortId(order.id) }}</div>
              <div class="muted">{{ order.customerName || 'Walk-in' }}</div>
            </td>
            <td>{{ order.store.name }}</td>
            <td>{{ formatWhen(order.createdAt) }}</td>
            <td>{{ order.itemCount }}</td>
            <td>
              <div v-for="value in order?.items" :key="value.id">
                {{ value.product.name }} × {{ value.quantity }}
              </div>
            </td>
            <td>{{ order.totalAmount }}</td>
            <td><span class="badge" :class="order.status">{{ statusLabel[order.status] }}</span></td>
            <td>
              <div class="actions">
                <button
                  v-for="action in actions[order.status]"
                  :key="action.status"
                  :class="{ danger: action.danger, secondary: !action.danger }"
                  :disabled="store.pendingIds.includes(order.id)"
                  @click="runAction(order, action.status)"
                >
                  {{ action.label }}
                </button>
                <span v-if="actions[order.status].length === 0" class="muted">No actions</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="pager">
      <span class="muted">{{ showing }}</span>
      <div class="actions">
        <button class="secondary" type="button" :disabled="store.pagination.page <= 1" @click="changePage(store.pagination.page - 1)">
          Previous
        </button>
        <button
          class="secondary"
          type="button"
          :disabled="store.pagination.page >= store.pagination.totalPages"
          @click="changePage(store.pagination.page + 1)"
        >
          Next
        </button>
      </div>
    </div>
  </section>
</template>

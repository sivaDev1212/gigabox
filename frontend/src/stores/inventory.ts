import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api, toApiError } from '../api/client';
import type { InventoryRow, InventoryUpdatedEvent, Store } from '../types';

export const useInventoryStore = defineStore('inventory', () => {
  const stores = ref<Store[]>([]);
  const storeId = ref('');
  const rows = ref<InventoryRow[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const actionError = ref<string | null>(null);
  const pendingProductId = ref<string | null>(null);

  async function fetchStores() {
    const response = await api.get<{ data: Store[] }>('/stores');
    stores.value = response.data.data;
    if (!storeId.value && stores.value[0]) {
      storeId.value = stores.value[0].id;
    }
  }

  async function fetchInventory() {
    if (!storeId.value) return;
    loading.value = true;
    error.value = null;
    try {
      const response = await api.get<{ data: InventoryRow[] }>(`/stores/${storeId.value}/inventory`);
      rows.value = response.data.data;
    } catch (caught) {
      error.value = toApiError(caught).message;
    } finally {
      loading.value = false;
    }
  }

  async function adjust(productId: string, quantity: number) {
    if (!storeId.value || quantity === 0) return;
    actionError.value = null;
    pendingProductId.value = productId;
    try {
      const response = await api.patch<{ data: InventoryRow }>(
        `/stores/${storeId.value}/inventory/${productId}/adjust`,
        { quantity },
      );
      replaceRow(response.data.data);
    } catch (caught) {
      actionError.value = toApiError(caught).message;
    } finally {
      pendingProductId.value = null;
    }
  }

  function replaceRow(row: InventoryRow) {
    const index = rows.value.findIndex((current) => current.productId === row.productId);
    if (index === -1) return;
    rows.value[index] = row;
  }

  function applyUpdate(event: InventoryUpdatedEvent) {
    if (event.storeId !== storeId.value) return;
    const index = rows.value.findIndex((row) => row.productId === event.productId);
    const current = rows.value[index];
    if (!current) return;
    rows.value[index] = {
      ...current,
      stock: event.stock,
      lowStockThreshold: event.lowStockThreshold,
      lowStock: event.lowStock,
    };
  }

  return {
    stores,
    storeId,
    rows,
    loading,
    error,
    actionError,
    pendingProductId,
    fetchStores,
    fetchInventory,
    adjust,
    applyUpdate,
  };
});

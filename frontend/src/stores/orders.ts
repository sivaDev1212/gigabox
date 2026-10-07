import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api, toApiError } from '../api/client';
import type { Order, OrderStatus, Pagination, StatusChangedEvent, Store } from '../types';

export const useOrdersStore = defineStore('orders', () => {
  const orders = ref<Order[]>([]);
  const stores = ref<Store[]>([]);
  const pagination = ref<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const status = ref<OrderStatus | ''>('');
  const storeId = ref('');
  const loading = ref(false);
  const error = ref<string | null>(null);
  const actionError = ref<string | null>(null);
  const pendingIds = ref<string[]>([]);

  async function fetchStores() {
    const response = await api.get<{ data: Store[] }>('/stores');
    stores.value = response.data.data;
  }

  async function fetchOrders() {
    loading.value = true;
    error.value = null;
    try {
      const response = await api.get<{ data: Order[]; pagination: Pagination }>('/orders', {
        params: {
          page: pagination.value.page,
          limit: pagination.value.limit,
          status: status.value || undefined,
          storeId: storeId.value || undefined,
          sortBy: 'createdAt',
          sortOrder: 'desc',
        },
      });
      orders.value = response.data.data;
      pagination.value = response.data.pagination;
    } catch (caught) {
      error.value = toApiError(caught).message;
    } finally {
      loading.value = false;
    }
  }

  async function updateStatus(orderId: string, next: OrderStatus) {
    actionError.value = null;
    pendingIds.value = [...pendingIds.value, orderId];
    try {
      const response = await api.patch<{ data: Order }>(`/orders/${orderId}/status`, { status: next });
      replaceOrder(response.data.data);
    } catch (caught) {
      actionError.value = toApiError(caught).message;
    } finally {
      pendingIds.value = pendingIds.value.filter((id) => id !== orderId);
    }
  }

  function replaceOrder(order: Order) {
    if (status.value && order.status !== status.value) {
      orders.value = orders.value.filter((current) => current.id !== order.id);
      return;
    }
    if (storeId.value && order.storeId !== storeId.value) {
      orders.value = orders.value.filter((current) => current.id !== order.id);
      return;
    }
    const index = orders.value.findIndex((current) => current.id === order.id);
    if (index === -1) return;
    orders.value[index] = order;
  }

  function applyStatusChanged(event: StatusChangedEvent) {
    const index = orders.value.findIndex((order) => order.id === event.orderId);
    if (index === -1) return;
    const current = orders.value[index];
    if (!current) return;
    if (status.value && event.status !== status.value) {
      orders.value.splice(index, 1);
      pagination.value.total = Math.max(0, pagination.value.total - 1);
      return;
    }
    orders.value[index] = {
      ...current,
      status: event.status,
      updatedAt: event.updatedAt,
      packedAt: event.status === 'PACKED' ? event.updatedAt : current.packedAt,
      outForDeliveryAt: event.status === 'OUT_FOR_DELIVERY' ? event.updatedAt : current.outForDeliveryAt,
      deliveredAt: event.status === 'DELIVERED' ? event.updatedAt : current.deliveredAt,
      cancelledAt: event.status === 'CANCELLED' ? event.updatedAt : current.cancelledAt,
    };
  }

  function applyCreated(order: Order) {
    if (orders.value.some((current) => current.id === order.id)) return;
    if (status.value && order.status !== status.value) return;
    if (storeId.value && order.storeId !== storeId.value) return;
    pagination.value.total += 1;
    pagination.value.totalPages = pagination.value.total === 0 ? 0 : Math.ceil(pagination.value.total / pagination.value.limit);
    if (pagination.value.page !== 1) return;
    orders.value.unshift(order);
    if (orders.value.length > pagination.value.limit) orders.value.pop();
  }

  function setPage(page: number) {
    pagination.value.page = page;
  }

  return {
    orders,
    stores,
    pagination,
    status,
    storeId,
    loading,
    error,
    actionError,
    pendingIds,
    fetchStores,
    fetchOrders,
    updateStatus,
    applyStatusChanged,
    applyCreated,
    setPage,
  };
});

import { io } from 'socket.io-client';
import { useInventoryStore } from './stores/inventory';
import { useOrdersStore } from './stores/orders';
import type { InventoryUpdatedEvent, Order, StatusChangedEvent } from './types';

export function connectRealtime() {
  const socket = io({ path: '/socket.io', transports: ['websocket', 'polling'] });

  socket.on('connect', () => {
    const orders = useOrdersStore();
    const inventory = useInventoryStore();
    if (orders.orders.length > 0 || orders.loading) {
      void orders.fetchOrders();
    }
    if (inventory.storeId) {
      void inventory.fetchInventory();
    }
  });

  socket.on('order:statusChanged', (event: StatusChangedEvent) => {
    useOrdersStore().applyStatusChanged(event);
  });

  socket.on('order:created', (event: { order: Order }) => {
    useOrdersStore().applyCreated(event.order);
  });

  socket.on('inventory:updated', (event: InventoryUpdatedEvent) => {
    useInventoryStore().applyUpdate(event);
  });

  return socket;
}

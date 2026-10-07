import { createRouter, createWebHistory } from 'vue-router';
import OrdersView from '../views/OrdersView.vue';
import InventoryView from '../views/InventoryView.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/orders' },
    { path: '/orders', name: 'orders', component: OrdersView },
    { path: '/inventory', name: 'inventory', component: InventoryView },
  ],
});

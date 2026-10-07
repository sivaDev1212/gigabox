export type OrderStatus = 'PLACED' | 'PACKED' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED';

export type Store = {
  id: string;
  name: string;
  address: string;
};

export type OrderItem = {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: string;
  product: { id: string; name: string; sku: string };
};

export type Order = {
  id: string;
  storeId: string;
  store: { id: string; name: string };
  status: OrderStatus;
  customerName: string | null;
  totalAmount: string;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
  packedAt: string | null;
  outForDeliveryAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  items: OrderItem[];
};

export type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type InventoryRow = {
  id: string;
  storeId: string;
  productId: string;
  stock: number;
  lowStockThreshold: number;
  lowStock: boolean;
  product: {
    id: string;
    sku: string;
    name: string;
    price: string;
  };
};

export type ApiError = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
};

export type StatusChangedEvent = {
  orderId: string;
  storeId: string;
  previousStatus: OrderStatus;
  status: OrderStatus;
  updatedAt: string;
};

export type InventoryUpdatedEvent = {
  storeId: string;
  productId: string;
  stock: number;
  lowStockThreshold: number;
  lowStock: boolean;
  updatedAt: string;
};

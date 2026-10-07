import type { Prisma } from '@prisma/client';

export const orderInclude = {
  store: { select: { id: true, name: true } },
  items: {
    select: {
      id: true,
      productId: true,
      quantity: true,
      unitPrice: true,
      product: { select: { id: true, name: true, sku: true } },
    },
  },
} satisfies Prisma.OrderInclude;

export type OrderWithRelations = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

export function serializeOrder(order: OrderWithRelations) {
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
  return {
    id: order.id,
    storeId: order.storeId,
    store: order.store,
    status: order.status,
    customerName: order.customerName,
    totalAmount: order.totalAmount.toFixed(2),
    itemCount,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    packedAt: order.packedAt?.toISOString() ?? null,
    outForDeliveryAt: order.outForDeliveryAt?.toISOString() ?? null,
    deliveredAt: order.deliveredAt?.toISOString() ?? null,
    cancelledAt: order.cancelledAt?.toISOString() ?? null,
    items: order.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice.toFixed(2),
      product: item.product,
    })),
  };
}

export type OrderDto = ReturnType<typeof serializeOrder>;

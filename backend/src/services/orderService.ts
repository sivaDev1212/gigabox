import { Prisma, type OrderStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../errors/AppError';
import { canTransition, timestampFieldForStatus } from '../domain/orderState';
import { publish } from '../realtime/publisher';
import { orderInclude, serializeOrder, type OrderWithRelations } from '../serializers/order';
import { serializeInventoryEvent } from '../serializers/catalog';
import { hashRequest } from '../utils/hash';
import { scheduleOrderAutoCancel } from '../jobs/scheduler';

type ItemInput = { productId: string; quantity: number };

export type CreateOrderInput = {
  storeId: string;
  customerName?: string;
  items: ItemInput[];
  idempotencyKey?: string;
};

export type ListOrdersQuery = {
  page: number;
  limit: number;
  status?: OrderStatus;
  storeId?: string;
  from?: Date;
  to?: Date;
  sortBy: 'createdAt' | 'updatedAt' | 'totalAmount' | 'status';
  sortOrder: 'asc' | 'desc';
};

type InventorySnapshot = {
  storeId: string;
  productId: string;
  stock: number;
  lowStockThreshold: number;
  updatedAt: Date;
};

/**
 * Duplicate lines for the same product are summed so each stock update runs once per product.
 */
export function mergeOrderItems(items: ItemInput[]): ItemInput[] {
  const quantities = new Map<string, number>();
  for (const item of items) {
    quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
  }
  return [...quantities.entries()].map(([productId, quantity]) => ({ productId, quantity }));
}

export async function createOrder(input: CreateOrderInput) {
  const items = mergeOrderItems(input.items);
  const normalized = {
    storeId: input.storeId,
    customerName: input.customerName ?? null,
    items: [...items].sort((left, right) => left.productId.localeCompare(right.productId)),
  };
  const requestHash = hashRequest(normalized);

  try {
    const result = await prisma.$transaction(async (tx) => {
      if (input.idempotencyKey) {
        const existing = await tx.idempotencyKey.findUnique({
          where: { key: input.idempotencyKey },
          include: { order: { include: orderInclude } },
        });
        if (existing) {
          if (existing.requestHash !== requestHash) {
            throw new AppError(
              409,
              'IDEMPOTENCY_KEY_MISMATCH',
              'This Idempotency-Key was already used for a different order request',
            );
          }
          return { order: existing.order, replay: true as const, inventory: [] as InventorySnapshot[] };
        }
      }

      const store = await tx.store.findUnique({ where: { id: input.storeId }, select: { id: true } });
      if (!store) {
        throw new AppError(404, 'NOT_FOUND', 'Store not found', { storeId: input.storeId });
      }

      const productIds = items.map((item) => item.productId);
      const products = await tx.product.findMany({ where: { id: { in: productIds } } });
      if (products.length !== productIds.length) {
        const found = new Set(products.map((product) => product.id));
        throw new AppError(404, 'NOT_FOUND', 'One or more products were not found', {
          productIds: productIds.filter((id) => !found.has(id)),
        });
      }
      const productById = new Map(products.map((product) => [product.id, product]));

      for (const item of items) {
        // Atomic conditional decrement. A concurrent order can lock the same row, but the WHERE
        // clause is rechecked after the lock, so stock cannot go negative.
        const updated = await tx.inventory.updateMany({
          where: {
            storeId: input.storeId,
            productId: item.productId,
            stock: { gte: item.quantity },
          },
          data: { stock: { decrement: item.quantity } },
        });

        if (updated.count !== 1) {
          const inventory = await tx.inventory.findUnique({
            where: { storeId_productId: { storeId: input.storeId, productId: item.productId } },
          });
          if (!inventory) {
            throw new AppError(404, 'NOT_FOUND', 'Product is not stocked at this store', {
              productId: item.productId,
              storeId: input.storeId,
            });
          }
          throw new AppError(409, 'INSUFFICIENT_STOCK', 'Insufficient stock for product', {
            productId: item.productId,
            available: inventory.stock,
            requested: item.quantity,
          });
        }
      }

      let total = new Prisma.Decimal(0);
      const orderItems = items.map((item) => {
        const product = productById.get(item.productId);
        if (!product) {
          throw new AppError(404, 'NOT_FOUND', 'Product not found', { productId: item.productId });
        }
        total = total.plus(product.price.mul(item.quantity));
        return {
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: product.price,
        };
      });

      const order = await tx.order.create({
        data: {
          storeId: input.storeId,
          customerName: input.customerName,
          status: 'PLACED',
          totalAmount: total,
          items: { create: orderItems },
        },
        include: orderInclude,
      });

      if (input.idempotencyKey) {
        await tx.idempotencyKey.create({
          data: {
            key: input.idempotencyKey,
            requestHash,
            orderId: order.id,
          },
        });
      }

      const inventory = await tx.inventory.findMany({
        where: { storeId: input.storeId, productId: { in: productIds } },
        select: {
          storeId: true,
          productId: true,
          stock: true,
          lowStockThreshold: true,
          updatedAt: true,
        },
      });

      return { order, replay: false as const, inventory };
    });

    if (!result.replay) {
      publishOrderCreated(result.order);
      for (const row of result.inventory) {
        publish('inventory:updated', serializeInventoryEvent(row));
      }
      scheduleOrderAutoCancel(result.order.id).catch((error) => {
        console.error('Failed to schedule auto-cancel', error);
      });
    }

    return result;
  } catch (error) {
    if (
      input.idempotencyKey &&
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const existing = await prisma.idempotencyKey.findUnique({
        where: { key: input.idempotencyKey },
        include: { order: { include: orderInclude } },
      });
      if (existing) {
        if (existing.requestHash !== requestHash) {
          throw new AppError(
            409,
            'IDEMPOTENCY_KEY_MISMATCH',
            'This Idempotency-Key was already used for a different order request',
          );
        }
        return { order: existing.order, replay: true as const, inventory: [] as InventorySnapshot[] };
      }
    }
    throw error;
  }
}

export async function listOrders(query: ListOrdersQuery) {
  const where: Prisma.OrderWhereInput = {
    status: query.status,
    storeId: query.storeId,
    createdAt:
      query.from || query.to
        ? {
            gte: query.from,
            lte: query.to,
          }
        : undefined,
  };

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: orderInclude,
      orderBy: { [query.sortBy]: query.sortOrder },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.order.count({ where }),
  ]);

  return {
    data: orders.map(serializeOrder),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
    },
  };
}

export async function getOrder(id: string) {
  const order = await prisma.order.findUnique({ where: { id }, include: orderInclude });
  if (!order) {
    throw new AppError(404, 'NOT_FOUND', 'Order not found', { orderId: id });
  }
  return serializeOrder(order);
}

/**
 * Status change and, for cancellation, inventory restoration commit in one transaction.
 * updateMany matches the status we read, so a concurrent cancel or pack cannot apply twice.
 */
export async function updateOrderStatus(orderId: string, nextStatus: OrderStatus) {
  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: orderInclude });
    if (!order) {
      throw new AppError(404, 'NOT_FOUND', 'Order not found', { orderId });
    }

    if (!canTransition(order.status, nextStatus)) {
      throw new AppError(409, 'INVALID_ORDER_TRANSITION', `Cannot move an order from ${order.status} to ${nextStatus}`, {
        from: order.status,
        to: nextStatus,
      });
    }

    const timestampField = timestampFieldForStatus(nextStatus);
    const updated = await tx.order.updateMany({
      where: { id: orderId, status: order.status },
      data: {
        status: nextStatus,
        ...(timestampField ? { [timestampField]: new Date() } : {}),
      },
    });

    if (updated.count !== 1) {
      throw new AppError(409, 'INVALID_ORDER_TRANSITION', 'Order status changed concurrently', {
        orderId,
        expected: order.status,
        to: nextStatus,
      });
    }

    let inventory: InventorySnapshot[] = [];
    if (nextStatus === 'CANCELLED') {
      for (const item of order.items) {
        const restored = await tx.inventory.updateMany({
          where: { storeId: order.storeId, productId: item.productId },
          data: { stock: { increment: item.quantity } },
        });
        if (restored.count !== 1) {
          throw new AppError(409, 'NOT_FOUND', 'Inventory record missing while restoring stock', {
            storeId: order.storeId,
            productId: item.productId,
          });
        }
      }
      inventory = await tx.inventory.findMany({
        where: {
          storeId: order.storeId,
          productId: { in: order.items.map((item) => item.productId) },
        },
        select: {
          storeId: true,
          productId: true,
          stock: true,
          lowStockThreshold: true,
          updatedAt: true,
        },
      });
    }

    const fresh = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: orderInclude });
    return { previousStatus: order.status, order: fresh, inventory };
  });

  publish('order:statusChanged', {
    orderId: result.order.id,
    storeId: result.order.storeId,
    previousStatus: result.previousStatus,
    status: result.order.status,
    updatedAt: result.order.updatedAt.toISOString(),
  });

  for (const row of result.inventory) {
    publish('inventory:updated', serializeInventoryEvent(row));
  }

  return serializeOrder(result.order);
}

function publishOrderCreated(order: OrderWithRelations) {
  publish('order:created', { order: serializeOrder(order) });
}

/**
 * Used by the delayed auto-cancel job. A status that is no longer PLACED is left untouched,
 * so a late job cannot restore stock for an order that was already packed or cancelled.
 */
export async function cancelIfStillPlaced(orderId: string): Promise<'cancelled' | 'skipped'> {
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { status: true } });
  if (!order || order.status !== 'PLACED') return 'skipped';
  try {
    await updateOrderStatus(orderId, 'CANCELLED');
    return 'cancelled';
  } catch (error) {
    if (error instanceof AppError && error.code === 'INVALID_ORDER_TRANSITION') return 'skipped';
    throw error;
  }
}

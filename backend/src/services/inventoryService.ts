import { prisma } from '../lib/prisma';
import { AppError } from '../errors/AppError';
import { publish } from '../realtime/publisher';
import { serializeInventory, serializeInventoryEvent } from '../serializers/catalog';

const inventoryInclude = { product: true } as const;

export async function listStoreInventory(storeId: string) {
  await assertStore(storeId);
  const rows = await prisma.inventory.findMany({
    where: { storeId },
    include: inventoryInclude,
    orderBy: { product: { name: 'asc' } },
  });
  return rows.map(serializeInventory);
}

export async function createStoreInventory(
  storeId: string,
  input: { productId: string; stock: number; lowStockThreshold?: number },
) {
  await assertStore(storeId);
  const product = await prisma.product.findUnique({ where: { id: input.productId } });
  if (!product) {
    throw new AppError(404, 'NOT_FOUND', 'Product not found', { productId: input.productId });
  }

  try {
    const row = await prisma.inventory.create({
      data: {
        storeId,
        productId: input.productId,
        stock: input.stock,
        lowStockThreshold: input.lowStockThreshold ?? 5,
      },
      include: inventoryInclude,
    });
    publish('inventory:updated', serializeInventoryEvent(row));
    return serializeInventory(row);
  } catch (error) {
    if (isPrismaCode(error, 'P2002')) {
      throw new AppError(409, 'CONFLICT', 'This product is already stocked at the store', {
        storeId,
        productId: input.productId,
      });
    }
    throw error;
  }
}

export async function updateStoreInventory(
  storeId: string,
  productId: string,
  input: { stock?: number; lowStockThreshold?: number },
) {
  const existing = await prisma.inventory.findUnique({
    where: { storeId_productId: { storeId, productId } },
  });
  if (!existing) {
    throw new AppError(404, 'NOT_FOUND', 'Product is not stocked at this store', { storeId, productId });
  }

  const row = await prisma.inventory.update({
    where: { storeId_productId: { storeId, productId } },
    data: {
      stock: input.stock,
      lowStockThreshold: input.lowStockThreshold,
    },
    include: inventoryInclude,
  });
  publish('inventory:updated', serializeInventoryEvent(row));
  return serializeInventory(row);
}

/**
 * Applies a signed stock delta. Negative adjustments use a conditional update so stock cannot cross zero,
 * even if two adjustments race.
 */
export async function adjustStoreInventory(storeId: string, productId: string, quantity: number) {
  const existing = await prisma.inventory.findUnique({
    where: { storeId_productId: { storeId, productId } },
  });
  if (!existing) {
    throw new AppError(404, 'NOT_FOUND', 'Product is not stocked at this store', { storeId, productId });
  }

  if (quantity > 0) {
    const row = await prisma.inventory.update({
      where: { storeId_productId: { storeId, productId } },
      data: { stock: { increment: quantity } },
      include: inventoryInclude,
    });
    publish('inventory:updated', serializeInventoryEvent(row));
    return serializeInventory(row);
  }

  const decrement = Math.abs(quantity);
  const updated = await prisma.inventory.updateMany({
    where: {
      storeId,
      productId,
      stock: { gte: decrement },
    },
    data: { stock: { decrement } },
  });

  if (updated.count !== 1) {
    const current = await prisma.inventory.findUnique({
      where: { storeId_productId: { storeId, productId } },
    });
    throw new AppError(409, 'STOCK_CANNOT_BE_NEGATIVE', 'Stock adjustment would make inventory negative', {
      storeId,
      productId,
      available: current?.stock ?? existing.stock,
      quantity,
    });
  }

  const row = await prisma.inventory.findUniqueOrThrow({
    where: { storeId_productId: { storeId, productId } },
    include: inventoryInclude,
  });
  publish('inventory:updated', serializeInventoryEvent(row));
  return serializeInventory(row);
}

async function assertStore(storeId: string) {
  const store = await prisma.store.findUnique({ where: { id: storeId }, select: { id: true } });
  if (!store) {
    throw new AppError(404, 'NOT_FOUND', 'Store not found', { storeId });
  }
}

function isPrismaCode(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}

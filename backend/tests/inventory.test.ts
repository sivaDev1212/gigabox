import { describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { adjustStoreInventory } from '../src/services/inventoryService';
import { createProduct, createStore, stockProduct } from './helpers';

describe('inventory adjustments', () => {
  it('rejects a decrement that would make stock negative', async () => {
    const store = await createStore();
    const product = await createProduct('SOAP');
    await stockProduct(store.id, product.id, 2);

    await expect(adjustStoreInventory(store.id, product.id, -3)).rejects.toMatchObject({
      code: 'STOCK_CANNOT_BE_NEGATIVE',
    });

    const row = await prisma.inventory.findUniqueOrThrow({
      where: { storeId_productId: { storeId: store.id, productId: product.id } },
    });
    expect(row.stock).toBe(2);
  });

  it('applies a positive adjustment', async () => {
    const store = await createStore();
    const product = await createProduct('SOAP-2');
    await stockProduct(store.id, product.id, 2);

    const updated = await adjustStoreInventory(store.id, product.id, 5);
    expect(updated.stock).toBe(7);
  });
});

import { Prisma } from '@prisma/client';
import { prisma } from '../src/lib/prisma';

export async function createStore(name = 'Test Store') {
  return prisma.store.create({ data: { name, address: '1 Test Lane' } });
}

export async function createProduct(sku = 'SKU-1', price = '10.00') {
  return prisma.product.create({
    data: { sku, name: sku, price: new Prisma.Decimal(price) },
  });
}

export async function stockProduct(storeId: string, productId: string, stock: number) {
  return prisma.inventory.create({
    data: { storeId, productId, stock, lowStockThreshold: 5 },
  });
}

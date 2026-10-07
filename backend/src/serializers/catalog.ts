import type { Inventory, Product } from '@prisma/client';

export function serializeProduct(product: Product) {
  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    description: product.description,
    price: product.price.toFixed(2),
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
}

export function serializeInventory(
  row: Inventory & { product: Product },
) {
  return {
    id: row.id,
    storeId: row.storeId,
    productId: row.productId,
    stock: row.stock,
    lowStockThreshold: row.lowStockThreshold,
    lowStock: row.stock <= row.lowStockThreshold,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    product: serializeProduct(row.product),
  };
}

export function serializeInventoryEvent(row: Pick<Inventory, 'storeId' | 'productId' | 'stock' | 'lowStockThreshold' | 'updatedAt'>) {
  return {
    storeId: row.storeId,
    productId: row.productId,
    stock: row.stock,
    lowStockThreshold: row.lowStockThreshold,
    lowStock: row.stock <= row.lowStockThreshold,
    updatedAt: row.updatedAt.toISOString(),
  };
}

import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../errors/AppError';
import { serializeProduct } from '../serializers/catalog';
import { invalidateProductListCache, readProductListCache, writeProductListCache } from '../cache/productCache';

type CreateProductInput = {
  sku: string;
  name: string;
  description?: string;
  price: Prisma.Decimal;
};

type UpdateProductInput = {
  sku?: string;
  name?: string;
  description?: string | null;
  price?: Prisma.Decimal;
};

export async function listProducts() {
  const cached = await readProductListCache<ReturnType<typeof serializeProduct>[]>();
  if (cached) return cached;
  const products = await prisma.product.findMany({ orderBy: { name: 'asc' } });
  const serialized = products.map(serializeProduct);
  await writeProductListCache(serialized);
  return serialized;
}

export async function getProduct(id: string) {
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) {
    throw new AppError(404, 'NOT_FOUND', 'Product not found', { productId: id });
  }
  return serializeProduct(product);
}

export async function createProduct(input: CreateProductInput) {
  try {
    const product = await prisma.product.create({ data: input });
    await invalidateProductListCache();
    return serializeProduct(product);
  } catch (error) {
    throw mapUniqueSku(error);
  }
}

export async function updateProduct(id: string, input: UpdateProductInput) {
  try {
    const product = await prisma.product.update({ where: { id }, data: input });
    await invalidateProductListCache();
    return serializeProduct(product);
  } catch (error) {
    if (isPrismaCode(error, 'P2025')) {
      throw new AppError(404, 'NOT_FOUND', 'Product not found', { productId: id });
    }
    throw mapUniqueSku(error);
  }
}

export async function deleteProduct(id: string) {
  const product = await prisma.product.findUnique({
    where: { id },
    include: { _count: { select: { orderItems: true } } },
  });
  if (!product) {
    throw new AppError(404, 'NOT_FOUND', 'Product not found', { productId: id });
  }
  if (product._count.orderItems > 0) {
    throw new AppError(409, 'PRODUCT_IN_USE', 'Cannot delete a product that is referenced by orders', {
      productId: id,
    });
  }

  await prisma.$transaction([
    prisma.inventory.deleteMany({ where: { productId: id } }),
    prisma.product.delete({ where: { id } }),
  ]);
  await invalidateProductListCache();

  return { id };
}

function mapUniqueSku(error: unknown): unknown {
  if (isPrismaCode(error, 'P2002')) {
    return new AppError(409, 'CONFLICT', 'A product with this SKU already exists');
  }
  return error;
}

function isPrismaCode(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}

import { prisma } from '../lib/prisma';
import { AppError } from '../errors/AppError';

export async function listStores() {
  return prisma.store.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, address: true, createdAt: true, updatedAt: true },
  });
}

export async function getStore(id: string) {
  const store = await prisma.store.findUnique({
    where: { id },
    select: { id: true, name: true, address: true, createdAt: true, updatedAt: true },
  });
  if (!store) {
    throw new AppError(404, 'NOT_FOUND', 'Store not found', { storeId: id });
  }
  return store;
}

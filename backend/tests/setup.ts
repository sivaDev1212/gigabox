import { beforeEach } from 'vitest';
import { prisma } from '../src/lib/prisma';

beforeEach(async () => {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "IdempotencyKey", "OrderItem", "Order", "Inventory", "Product", "Store" RESTART IDENTITY CASCADE',
  );
});

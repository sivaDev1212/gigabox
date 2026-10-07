import { afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { Prisma } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import { createApp } from '../src/app';
import { cancelIfStillPlaced, createOrder, updateOrderStatus } from '../src/services/orderService';
import { createProduct, createStore, stockProduct } from './helpers';

const app = createApp();

describe('order creation and stock', () => {
  it('decrements stock and snapshots the server price', async () => {
    const store = await createStore();
    const product = await createProduct('MILK', '25.50');
    await stockProduct(store.id, product.id, 5);

    const result = await createOrder({
      storeId: store.id,
      customerName: 'Asha',
      items: [{ productId: product.id, quantity: 2 }],
    });

    expect(result.replay).toBe(false);
    expect(result.order.status).toBe('PLACED');
    expect(result.order.totalAmount.toFixed(2)).toBe('51.00');
    expect(result.order.items[0]?.unitPrice.toFixed(2)).toBe('25.50');

    await prisma.product.update({ where: { id: product.id }, data: { price: new Prisma.Decimal('99.00') } });
    const stored = await prisma.orderItem.findFirstOrThrow({ where: { orderId: result.order.id } });
    expect(stored.unitPrice.toFixed(2)).toBe('25.50');

    const inventory = await prisma.inventory.findUniqueOrThrow({
      where: { storeId_productId: { storeId: store.id, productId: product.id } },
    });
    expect(inventory.stock).toBe(3);
  });

  it('rejects the whole order when one item is short and leaves stock unchanged', async () => {
    const store = await createStore();
    const milk = await createProduct('MILK');
    const bread = await createProduct('BREAD', '20.00');
    await stockProduct(store.id, milk.id, 5);
    await stockProduct(store.id, bread.id, 1);

    await expect(
      createOrder({
        storeId: store.id,
        items: [
          { productId: milk.id, quantity: 2 },
          { productId: bread.id, quantity: 2 },
        ],
      }),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_STOCK' });

    const rows = await prisma.inventory.findMany({ orderBy: { productId: 'asc' } });
    expect(rows.map((row) => row.stock).sort()).toEqual([1, 5]);
    expect(await prisma.order.count()).toBe(0);
  });

  it('merges duplicate product lines before decrementing stock', async () => {
    const store = await createStore();
    const product = await createProduct();
    await stockProduct(store.id, product.id, 3);

    await createOrder({
      storeId: store.id,
      items: [
        { productId: product.id, quantity: 1 },
        { productId: product.id, quantity: 2 },
      ],
    });

    const inventory = await prisma.inventory.findUniqueOrThrow({
      where: { storeId_productId: { storeId: store.id, productId: product.id } },
    });
    expect(inventory.stock).toBe(0);
    expect(await prisma.orderItem.count()).toBe(1);
  });

  it('lets only one of two concurrent orders take the last unit', async () => {
    const store = await createStore();
    const product = await createProduct();
    await stockProduct(store.id, product.id, 1);

    const results = await Promise.allSettled([
      createOrder({ storeId: store.id, items: [{ productId: product.id, quantity: 1 }] }),
      createOrder({ storeId: store.id, items: [{ productId: product.id, quantity: 1 }] }),
    ]);

    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]).toMatchObject({
      status: 'rejected',
      reason: expect.objectContaining({ code: 'INSUFFICIENT_STOCK' }),
    });

    const inventory = await prisma.inventory.findUniqueOrThrow({
      where: { storeId_productId: { storeId: store.id, productId: product.id } },
    });
    expect(inventory.stock).toBe(0);
    expect(await prisma.order.count()).toBe(1);
  });

  it('allows only as many concurrent orders as the available stock', async () => {
    const store = await createStore();
    const product = await createProduct();
    await stockProduct(store.id, product.id, 5);

    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () =>
        createOrder({ storeId: store.id, items: [{ productId: product.id, quantity: 1 }] }),
      ),
    );

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(5);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(5);

    const inventory = await prisma.inventory.findUniqueOrThrow({
      where: { storeId_productId: { storeId: store.id, productId: product.id } },
    });
    expect(inventory.stock).toBe(0);
    expect(await prisma.order.count()).toBe(5);
  });
});

describe('order lifecycle', () => {
  it('follows the happy path and records timestamps', async () => {
    const store = await createStore();
    const product = await createProduct();
    await stockProduct(store.id, product.id, 4);
    const created = await createOrder({ storeId: store.id, items: [{ productId: product.id, quantity: 1 }] });

    const packed = await updateOrderStatus(created.order.id, 'PACKED');
    const out = await updateOrderStatus(created.order.id, 'OUT_FOR_DELIVERY');
    const delivered = await updateOrderStatus(created.order.id, 'DELIVERED');

    expect(packed.status).toBe('PACKED');
    expect(packed.packedAt).not.toBeNull();
    expect(out.status).toBe('OUT_FOR_DELIVERY');
    expect(out.outForDeliveryAt).not.toBeNull();
    expect(delivered.status).toBe('DELIVERED');
    expect(delivered.deliveredAt).not.toBeNull();
  });

  it('rejects skips, terminal changes, and cancellation after dispatch', async () => {
    const store = await createStore();
    const product = await createProduct();
    await stockProduct(store.id, product.id, 3);
    const created = await createOrder({ storeId: store.id, items: [{ productId: product.id, quantity: 1 }] });

    await expect(updateOrderStatus(created.order.id, 'DELIVERED')).rejects.toMatchObject({
      code: 'INVALID_ORDER_TRANSITION',
    });
    await updateOrderStatus(created.order.id, 'PACKED');
    await updateOrderStatus(created.order.id, 'OUT_FOR_DELIVERY');
    await expect(updateOrderStatus(created.order.id, 'CANCELLED')).rejects.toMatchObject({
      code: 'INVALID_ORDER_TRANSITION',
    });
    await updateOrderStatus(created.order.id, 'DELIVERED');
    await expect(updateOrderStatus(created.order.id, 'PACKED')).rejects.toMatchObject({
      code: 'INVALID_ORDER_TRANSITION',
    });
  });

  it('restores stock exactly once when an order is cancelled', async () => {
    const store = await createStore();
    const product = await createProduct();
    await stockProduct(store.id, product.id, 4);
    const created = await createOrder({
      storeId: store.id,
      items: [{ productId: product.id, quantity: 3 }],
    });

    await updateOrderStatus(created.order.id, 'CANCELLED');
    const afterCancel = await prisma.inventory.findUniqueOrThrow({
      where: { storeId_productId: { storeId: store.id, productId: product.id } },
    });
    expect(afterCancel.stock).toBe(4);

    await expect(updateOrderStatus(created.order.id, 'CANCELLED')).rejects.toMatchObject({
      code: 'INVALID_ORDER_TRANSITION',
    });
    const afterRepeat = await prisma.inventory.findUniqueOrThrow({
      where: { storeId_productId: { storeId: store.id, productId: product.id } },
    });
    expect(afterRepeat.stock).toBe(4);
  });

  it('does not restore stock twice when cancellation races', async () => {
    const store = await createStore();
    const product = await createProduct();
    await stockProduct(store.id, product.id, 2);
    const created = await createOrder({ storeId: store.id, items: [{ productId: product.id, quantity: 2 }] });

    const results = await Promise.allSettled([
      updateOrderStatus(created.order.id, 'CANCELLED'),
      updateOrderStatus(created.order.id, 'CANCELLED'),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const inventory = await prisma.inventory.findUniqueOrThrow({
      where: { storeId_productId: { storeId: store.id, productId: product.id } },
    });
    expect(inventory.stock).toBe(2);
    const order = await prisma.order.findUniqueOrThrow({ where: { id: created.order.id } });
    expect(order.status).toBe('CANCELLED');
  });
});

describe('auto-cancel job', () => {
  it('cancels an order that is still placed and restores stock', async () => {
    const store = await createStore();
    const product = await createProduct('AUTO');
    await stockProduct(store.id, product.id, 3);
    const created = await createOrder({ storeId: store.id, items: [{ productId: product.id, quantity: 2 }] });

    await expect(cancelIfStillPlaced(created.order.id)).resolves.toBe('cancelled');
    const inventory = await prisma.inventory.findUniqueOrThrow({
      where: { storeId_productId: { storeId: store.id, productId: product.id } },
    });
    expect(inventory.stock).toBe(3);
  });

  it('does nothing when the order has already moved past PLACED', async () => {
    const store = await createStore();
    const product = await createProduct('AUTO-2');
    await stockProduct(store.id, product.id, 3);
    const created = await createOrder({ storeId: store.id, items: [{ productId: product.id, quantity: 2 }] });
    await updateOrderStatus(created.order.id, 'PACKED');

    await expect(cancelIfStillPlaced(created.order.id)).resolves.toBe('skipped');
    const inventory = await prisma.inventory.findUniqueOrThrow({
      where: { storeId_productId: { storeId: store.id, productId: product.id } },
    });
    expect(inventory.stock).toBe(1);
    const order = await prisma.order.findUniqueOrThrow({ where: { id: created.order.id } });
    expect(order.status).toBe('PACKED');
  });
});

describe('HTTP API', () => {
  it('creates an order and rejects invalid quantities', async () => {
    const store = await createStore();
    const product = await createProduct('HTTP', '12.00');
    await stockProduct(store.id, product.id, 2);

    const created = await request(app).post('/api/orders').send({
      storeId: store.id,
      items: [{ productId: product.id, quantity: 1 }],
    });
    expect(created.status).toBe(201);
    expect(created.body.success).toBe(true);
    expect(created.body.data.status).toBe('PLACED');
    expect(created.body.data.totalAmount).toBe('12.00');

    const invalid = await request(app).post('/api/orders').send({
      storeId: store.id,
      items: [{ productId: product.id, quantity: 0 }],
    });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('paginates, filters, and rejects unknown sort columns in the database query', async () => {
    const store = await createStore();
    const other = await createStore('Other');
    const product = await createProduct();
    await stockProduct(store.id, product.id, 10);
    await stockProduct(other.id, product.id, 10);

    for (let index = 0; index < 3; index += 1) {
      await createOrder({ storeId: store.id, items: [{ productId: product.id, quantity: 1 }] });
    }
    const cancelled = await createOrder({ storeId: other.id, items: [{ productId: product.id, quantity: 1 }] });
    await updateOrderStatus(cancelled.order.id, 'CANCELLED');

    const page = await request(app).get('/api/orders').query({ page: 1, limit: 2, storeId: store.id, status: 'PLACED' });
    expect(page.status).toBe(200);
    expect(page.body.data).toHaveLength(2);
    expect(page.body.pagination).toMatchObject({ page: 1, limit: 2, total: 3, totalPages: 2 });

    const badSort = await request(app).get('/api/orders').query({ sortBy: 'customerName' });
    expect(badSort.status).toBe(400);
    expect(badSort.body.error.code).toBe('VALIDATION_ERROR');

    const hugeLimit = await request(app).get('/api/orders').query({ limit: 500 });
    expect(hugeLimit.status).toBe(400);
  });

  it('returns 409 for an illegal status change', async () => {
    const store = await createStore();
    const product = await createProduct('LIFE');
    await stockProduct(store.id, product.id, 1);
    const created = await request(app).post('/api/orders').send({
      storeId: store.id,
      items: [{ productId: product.id, quantity: 1 }],
    });

    const response = await request(app).patch(`/api/orders/${created.body.data.id}/status`).send({ status: 'DELIVERED' });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('INVALID_ORDER_TRANSITION');
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

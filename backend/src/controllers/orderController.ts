import type { Request, Response } from 'express';
import type { OrderStatus } from '@prisma/client';
import { ZodError } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler';
import { getValidated } from '../middleware/validate';
import { fromZodError } from '../errors/errorHandler';
import { createOrder, getOrder, listOrders, updateOrderStatus, type ListOrdersQuery } from '../services/orderService';
import { serializeOrder } from '../serializers/order';
import { idempotencyKeySchema } from '../schemas/order';

export const postOrder = asyncHandler(async (req: Request, res: Response) => {
  const { body } = getValidated<{
    storeId: string;
    customerName?: string;
    items: { productId: string; quantity: number }[];
  }>(res);

  const header = req.header('Idempotency-Key');
  let idempotencyKey: string | undefined;
  if (header !== undefined && header !== '') {
    const parsed = idempotencyKeySchema.safeParse(header);
    if (!parsed.success) {
      throw fromZodError(new ZodError(parsed.error.issues));
    }
    idempotencyKey = parsed.data;
  }

  const result = await createOrder({ ...body, idempotencyKey });
  res.status(result.replay ? 200 : 201).json({ success: true, data: serializeOrder(result.order) });
});

export const getOrders = asyncHandler(async (_req: Request, res: Response) => {
  const { query } = getValidated<unknown, ListOrdersQuery>(res);
  const result = await listOrders(query);
  res.json({ success: true, ...result });
});

export const getOrderById = asyncHandler(async (_req: Request, res: Response) => {
  const { params } = getValidated<unknown, unknown, { id: string }>(res);
  const order = await getOrder(params.id);
  res.json({ success: true, data: order });
});

export const patchOrderStatus = asyncHandler(async (_req: Request, res: Response) => {
  const { params, body } = getValidated<{ status: OrderStatus }, unknown, { id: string }>(res);
  const order = await updateOrderStatus(params.id, body.status);
  res.json({ success: true, data: order });
});

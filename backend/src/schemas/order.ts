import { OrderStatus } from '@prisma/client';
import { z } from 'zod';

const dateInput = z
  .string()
  .trim()
  .min(1)
  .refine((value) => !Number.isNaN(Date.parse(value.length === 10 ? `${value}T00:00:00.000Z` : value)), {
    message: 'Invalid date',
  });

function toRangeDate(value: string, bound: 'start' | 'end'): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(bound === 'start' ? `${value}T00:00:00.000Z` : `${value}T23:59:59.999Z`);
  }
  return new Date(value);
}

export const createOrderBodySchema = z.object({
  storeId: z.string().min(1),
  customerName: z.string().trim().min(1).max(120).optional(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().positive().max(1000),
      }),
    )
    .min(1)
    .max(50),
});

export const updateOrderStatusBodySchema = z.object({
  status: z.nativeEnum(OrderStatus),
});

export const listOrdersQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    status: z.nativeEnum(OrderStatus).optional(),
    storeId: z.string().trim().min(1).optional(),
    from: dateInput.optional(),
    to: dateInput.optional(),
    sortBy: z.enum(['createdAt', 'updatedAt', 'totalAmount', 'status']).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  })
  .transform((query) => ({
    ...query,
    from: query.from ? toRangeDate(query.from, 'start') : undefined,
    to: query.to ? toRangeDate(query.to, 'end') : undefined,
  }))
  .refine((query) => !query.from || !query.to || query.from <= query.to, {
    message: 'from must be earlier than or equal to to',
    path: ['from'],
  });

export const idempotencyKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z0-9:_-]+$/, 'Idempotency-Key contains unsupported characters');

import { z } from 'zod';

export const createInventoryBodySchema = z.object({
  productId: z.string().min(1),
  stock: z.number().int().min(0),
  lowStockThreshold: z.number().int().min(0).optional(),
});

export const updateInventoryBodySchema = z
  .object({
    stock: z.number().int().min(0).optional(),
    lowStockThreshold: z.number().int().min(0).optional(),
  })
  .refine((value) => value.stock !== undefined || value.lowStockThreshold !== undefined, {
    message: 'Provide stock or lowStockThreshold',
  });

export const adjustInventoryBodySchema = z.object({
  quantity: z.number().int().refine((value) => value !== 0, { message: 'Quantity cannot be zero' }),
});

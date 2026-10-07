import { z } from 'zod';

export const idParamSchema = z.object({
  id: z.string().min(1),
});

export const storeIdParamSchema = z.object({
  storeId: z.string().min(1),
});

export const storeProductParamsSchema = z.object({
  storeId: z.string().min(1),
  productId: z.string().min(1),
});

import { Prisma } from '@prisma/client';
import { z } from 'zod';

const moneySchema = z
  .union([z.string(), z.number()])
  .transform((value, ctx) => {
    try {
      const decimal = new Prisma.Decimal(value);
      if (!decimal.isFinite() || decimal.lte(0) || decimal.decimalPlaces() > 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Price must be a positive amount with at most 2 decimal places',
        });
        return z.NEVER;
      }
      return decimal;
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Price must be a valid decimal amount' });
      return z.NEVER;
    }
  });

export const createProductBodySchema = z.object({
  sku: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  price: moneySchema,
});

export const updateProductBodySchema = z
  .object({
    sku: z.string().trim().min(1).max(64).optional(),
    name: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    price: moneySchema.optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'At least one field is required',
  });

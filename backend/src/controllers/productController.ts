import type { Request, Response } from 'express';
import type { Prisma } from '@prisma/client';
import { asyncHandler } from '../middleware/asyncHandler';
import { getValidated } from '../middleware/validate';
import { createProduct, deleteProduct, getProduct, listProducts, updateProduct } from '../services/productService';

type CreateBody = {
  sku: string;
  name: string;
  description?: string;
  price: Prisma.Decimal;
};

type UpdateBody = {
  sku?: string;
  name?: string;
  description?: string | null;
  price?: Prisma.Decimal;
};

export const getProducts = asyncHandler(async (_req: Request, res: Response) => {
  const products = await listProducts();
  res.json({ success: true, data: products });
});

export const getProductById = asyncHandler(async (_req: Request, res: Response) => {
  const { params } = getValidated<unknown, unknown, { id: string }>(res);
  const product = await getProduct(params.id);
  res.json({ success: true, data: product });
});

export const postProduct = asyncHandler(async (_req: Request, res: Response) => {
  const { body } = getValidated<CreateBody>(res);
  const product = await createProduct(body);
  res.status(201).json({ success: true, data: product });
});

export const patchProduct = asyncHandler(async (_req: Request, res: Response) => {
  const { params, body } = getValidated<UpdateBody, unknown, { id: string }>(res);
  const product = await updateProduct(params.id, body);
  res.json({ success: true, data: product });
});

export const removeProduct = asyncHandler(async (_req: Request, res: Response) => {
  const { params } = getValidated<unknown, unknown, { id: string }>(res);
  const result = await deleteProduct(params.id);
  res.json({ success: true, data: result });
});

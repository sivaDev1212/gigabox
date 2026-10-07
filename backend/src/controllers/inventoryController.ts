import type { Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { getValidated } from '../middleware/validate';
import {
  adjustStoreInventory,
  createStoreInventory,
  listStoreInventory,
  updateStoreInventory,
} from '../services/inventoryService';

export const getInventory = asyncHandler(async (_req: Request, res: Response) => {
  const { params } = getValidated<unknown, unknown, { storeId: string }>(res);
  const inventory = await listStoreInventory(params.storeId);
  res.json({ success: true, data: inventory });
});

export const postInventory = asyncHandler(async (_req: Request, res: Response) => {
  const { params, body } = getValidated<
    { productId: string; stock: number; lowStockThreshold?: number },
    unknown,
    { storeId: string }
  >(res);
  const row = await createStoreInventory(params.storeId, body);
  res.status(201).json({ success: true, data: row });
});

export const patchInventory = asyncHandler(async (_req: Request, res: Response) => {
  const { params, body } = getValidated<
    { stock?: number; lowStockThreshold?: number },
    unknown,
    { storeId: string; productId: string }
  >(res);
  const row = await updateStoreInventory(params.storeId, params.productId, body);
  res.json({ success: true, data: row });
});

export const patchInventoryAdjust = asyncHandler(async (_req: Request, res: Response) => {
  const { params, body } = getValidated<{ quantity: number }, unknown, { storeId: string; productId: string }>(res);
  const row = await adjustStoreInventory(params.storeId, params.productId, body.quantity);
  res.json({ success: true, data: row });
});

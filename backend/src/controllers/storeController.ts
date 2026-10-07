import type { Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { getValidated } from '../middleware/validate';
import { getStore, listStores } from '../services/storeService';

export const getStores = asyncHandler(async (_req: Request, res: Response) => {
  const stores = await listStores();
  res.json({ success: true, data: stores });
});

export const getStoreById = asyncHandler(async (_req: Request, res: Response) => {
  const { params } = getValidated<unknown, unknown, { id: string }>(res);
  const store = await getStore(params.id);
  res.json({ success: true, data: store });
});

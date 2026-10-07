import { Router } from 'express';
import { validate } from '../middleware/validate';
import { orderRateLimit } from '../middleware/rateLimit';
import { idParamSchema, storeIdParamSchema, storeProductParamsSchema } from '../schemas/common';
import { createProductBodySchema, updateProductBodySchema } from '../schemas/product';
import { adjustInventoryBodySchema, createInventoryBodySchema, updateInventoryBodySchema } from '../schemas/inventory';
import { createOrderBodySchema, listOrdersQuerySchema, updateOrderStatusBodySchema } from '../schemas/order';
import { getStoreById, getStores } from '../controllers/storeController';
import {
  getProductById,
  getProducts,
  patchProduct,
  postProduct,
  removeProduct,
} from '../controllers/productController';
import {
  getInventory,
  patchInventory,
  patchInventoryAdjust,
  postInventory,
} from '../controllers/inventoryController';
import { getOrderById, getOrders, patchOrderStatus, postOrder } from '../controllers/orderController';

export const apiRouter = Router();

apiRouter.get('/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok' } });
});

apiRouter.get('/stores', getStores);
apiRouter.get('/stores/:id', validate({ params: idParamSchema }), getStoreById);

apiRouter.get('/products', getProducts);
apiRouter.get('/products/:id', validate({ params: idParamSchema }), getProductById);
apiRouter.post('/products', validate({ body: createProductBodySchema }), postProduct);
apiRouter.patch('/products/:id', validate({ params: idParamSchema, body: updateProductBodySchema }), patchProduct);
apiRouter.delete('/products/:id', validate({ params: idParamSchema }), removeProduct);

apiRouter.get('/stores/:storeId/inventory', validate({ params: storeIdParamSchema }), getInventory);
apiRouter.post(
  '/stores/:storeId/inventory',
  validate({ params: storeIdParamSchema, body: createInventoryBodySchema }),
  postInventory,
);
apiRouter.patch(
  '/stores/:storeId/inventory/:productId',
  validate({ params: storeProductParamsSchema, body: updateInventoryBodySchema }),
  patchInventory,
);
apiRouter.patch(
  '/stores/:storeId/inventory/:productId/adjust',
  validate({ params: storeProductParamsSchema, body: adjustInventoryBodySchema }),
  patchInventoryAdjust,
);

apiRouter.post('/orders', orderRateLimit, validate({ body: createOrderBodySchema }), postOrder);
apiRouter.get('/orders', validate({ query: listOrdersQuerySchema }), getOrders);
apiRouter.get('/orders/:id', validate({ params: idParamSchema }), getOrderById);
apiRouter.patch(
  '/orders/:id/status',
  validate({ params: idParamSchema, body: updateOrderStatusBodySchema }),
  patchOrderStatus,
);

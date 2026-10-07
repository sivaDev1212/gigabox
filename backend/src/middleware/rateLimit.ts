import rateLimit from 'express-rate-limit';
import { env } from '../config/env';
import { errorBody } from '../errors/errorHandler';

export const orderRateLimit = rateLimit({
  windowMs: env.ORDER_RATE_LIMIT_WINDOW_MS,
  limit: env.ORDER_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json(errorBody('RATE_LIMIT_EXCEEDED', 'Too many order requests. Try again shortly.'));
  },
});

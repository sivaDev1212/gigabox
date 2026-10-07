import type { NextFunction, Request, Response } from 'express';
import type { ZodTypeAny } from 'zod';
import { fromZodError } from '../errors/errorHandler';

type SchemaGroup = {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
};

export type ValidatedRequest<TBody = unknown, TQuery = unknown, TParams = unknown> = {
  body: TBody;
  query: TQuery;
  params: TParams;
};

export function validate(schemas: SchemaGroup) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const validated: ValidatedRequest = {
      body: req.body,
      query: req.query,
      params: req.params,
    };

    if (schemas.params) {
      const parsed = schemas.params.safeParse(req.params);
      if (!parsed.success) {
        next(fromZodError(parsed.error));
        return;
      }
      validated.params = parsed.data;
    }

    if (schemas.query) {
      const parsed = schemas.query.safeParse(req.query);
      if (!parsed.success) {
        next(fromZodError(parsed.error));
        return;
      }
      validated.query = parsed.data;
    }

    if (schemas.body) {
      const parsed = schemas.body.safeParse(req.body);
      if (!parsed.success) {
        next(fromZodError(parsed.error));
        return;
      }
      validated.body = parsed.data;
    }

    res.locals.validated = validated;
    next();
  };
}

export function getValidated<TBody, TQuery = unknown, TParams = unknown>(
  res: Response,
): ValidatedRequest<TBody, TQuery, TParams> {
  return res.locals.validated as ValidatedRequest<TBody, TQuery, TParams>;
}

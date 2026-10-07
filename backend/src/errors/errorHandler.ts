import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { AppError } from './AppError';

type ErrorBody = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
};

export function errorBody(code: string, message: string, details?: Record<string, unknown>): ErrorBody {
  return {
    success: false,
    error: details ? { code, message, details } : { code, message },
  };
}

export function fromZodError(error: ZodError): AppError {
  return new AppError(400, 'VALIDATION_ERROR', 'Request validation failed', {
    issues: error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    })),
  });
}

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (error instanceof AppError) {
    res.status(error.statusCode).json(errorBody(error.code, error.message, error.details));
    return;
  }

  if (error instanceof ZodError) {
    const appError = fromZodError(error);
    res.status(appError.statusCode).json(errorBody(appError.code, appError.message, appError.details));
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      res.status(409).json(errorBody('CONFLICT', 'A record with the same unique value already exists'));
      return;
    }
    if (error.code === 'P2025') {
      res.status(404).json(errorBody('NOT_FOUND', 'Record not found'));
      return;
    }
  }

  console.error(error);
  res.status(500).json(errorBody('INTERNAL_SERVER_ERROR', 'Unexpected server error'));
}

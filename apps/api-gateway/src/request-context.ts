import { BadRequestException } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

export type CorrelatedRequest = Request & { correlationId: string };

export function correlationIdMiddleware(
  request: CorrelatedRequest,
  response: Response,
  next: NextFunction,
) {
  const incoming = request.header('x-correlation-id');
  if (
    incoming &&
    (incoming.length > 100 || !/^[A-Za-z0-9._:-]+$/.test(incoming))
  ) {
    throw new BadRequestException('X-Correlation-Id inválido');
  }

  request.correlationId = incoming || crypto.randomUUID();
  response.setHeader('X-Correlation-Id', request.correlationId);
  next();
}

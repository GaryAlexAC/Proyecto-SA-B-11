import { HttpException, HttpStatus } from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';

const SERVICE_TIMEOUT_MS = 8_000;

export function rpcToHttp<T>(request: Observable<T>) {
  return request.pipe(
    timeout(SERVICE_TIMEOUT_MS),
    catchError((error: unknown) =>
      throwError(() => mapRpcError(error)),
    ),
  );
}

function mapRpcError(error: unknown) {
  if (error && typeof error === 'object') {
    const value = error as {
      statusCode?: number;
      error?: unknown;
      message?: unknown;
    };
    if (
      typeof value.statusCode === 'number' &&
      value.statusCode >= 400 &&
      value.statusCode <= 599
    ) {
      return new HttpException(value.error ?? value.message ?? value, value.statusCode);
    }
  }

  return new HttpException(
    'Customer Service no disponible',
    HttpStatus.SERVICE_UNAVAILABLE,
  );
}

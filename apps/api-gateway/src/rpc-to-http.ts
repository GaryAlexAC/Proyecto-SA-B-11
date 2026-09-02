import { HttpException } from '@nestjs/common';
import { Observable, TimeoutError, catchError, timeout } from 'rxjs';

export function rpcToHttp<T>(request: Observable<T>): Observable<T> {
  return request.pipe(timeout(10_000), catchError((error: unknown) => {
    if (error instanceof TimeoutError) throw new HttpException('El servicio no respondió a tiempo', 504);
    const payload = isRecord(error) && isRecord(error.message) ? error.message : error;
    const statusCode = isRecord(payload) && typeof payload.statusCode === 'number' ? payload.statusCode : 502;
    throw new HttpException(payload ?? 'El servicio no respondió correctamente', statusCode);
  }));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

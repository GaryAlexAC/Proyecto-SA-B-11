import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { AppError } from '../../application/errors/app-error';

@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(AppExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();
    const correlationId = request.header('x-correlation-id');
    const error = this.toAppError(exception);

    if (error.statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error({ correlationId, path: request.originalUrl, exception });
    }

    response.status(error.statusCode).json({
      statusCode: error.statusCode,
      code: error.code,
      message: error.message,
      details: error.details ?? [],
      ...(correlationId ? { correlationId } : {}),
      timestamp: new Date().toISOString(),
      path: request.originalUrl,
    });
  }

  private toAppError(exception: unknown): AppError {
    if (exception instanceof AppError) return exception;
    if (exception instanceof HttpException) {
      return new AppError(exception.getStatus(), 'HTTP_ERROR', this.messageFromHttpException(exception));
    }
    return new AppError(500, 'INTERNAL_ERROR', 'Ocurrió un error interno');
  }

  private messageFromHttpException(exception: HttpException): string {
    const response = exception.getResponse();
    if (typeof response === 'string') return response;
    const body = response as { message?: string | string[] };
    if (Array.isArray(body.message)) return body.message.join(', ');
    return body.message ?? 'Error en la solicitud';
  }
}

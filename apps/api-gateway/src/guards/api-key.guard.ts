import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly validApiKeys: Set<string>;

  constructor() {
    const configuredKey = process.env.INTERBANK_API_KEY?.trim();
    // Claves por defecto acordadas para pruebas y desarrollo
    const defaultKeys = [
      'bank11-partner-key-2026',
      'api-key-bank06-to-bank11',
      'bank11-api-key-test',
      'test-api-key',
    ];
    this.validApiKeys = new Set(
      configuredKey ? [configuredKey, ...defaultKeys] : defaultKeys,
    );
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const apiKey =
      (request.headers['x-api-key'] as string)?.trim() ||
      (request.headers['X-Api-Key'] as string)?.trim();

    if (!apiKey) {
      throw new UnauthorizedException({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Header X-Api-Key faltante',
      });
    }

    if (!this.validApiKeys.has(apiKey)) {
      throw new UnauthorizedException({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'API Key inválida o no autorizada',
      });
    }

    // Guardar el código de banco llamante identificado
    (request as any).callingBankCode = 'BANK06';
    return true;
  }
}

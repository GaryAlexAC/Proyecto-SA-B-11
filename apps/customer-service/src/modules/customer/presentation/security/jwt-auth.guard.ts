import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { AppError, Errors } from '../../../../common/application/errors/app-error';
import { CustomersService } from '../../application/customers.service';

export interface AuthenticatedRequest extends Request {
  user: { sub: string; username: string; role: 'ADMIN' | 'CASHIER' | 'CLIENT' };
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService, private readonly customers: CustomersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = request.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) throw Errors.invalidToken();
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; username: string; role: 'ADMIN' | 'CASHIER' | 'CLIENT' }>(token);
      const customer = await this.customers.findAuthorizationState(payload.sub);
      if (!customer || customer.role !== payload.role) throw Errors.invalidToken();
      if (customer.status === 'BLOCKED') throw Errors.customerBlocked();
      if (customer.status !== 'ACTIVE') throw Errors.customerInactive();
      request.user = { sub: customer.id, username: customer.username, role: customer.role };
      return true;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw Errors.invalidToken();
    }
  }
}

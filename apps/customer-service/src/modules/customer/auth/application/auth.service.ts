import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { CustomersService } from '../../application/customers.service';
import { AppError, Errors } from '../../../../common/application/errors/app-error';

interface AuthorizationPolicy {
  customerId?: string;
  allowedRoles?: string[];
  allowSelf?: boolean;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly customers: CustomersService, private readonly jwt: JwtService) {}

  async login(username: string, password: string, correlationId: string) {
    try {
      const customer = await this.customers.validateCredentials(username, password);
      if (customer.status === 'INACTIVE') {
        await this.customers.requestActivation(customer, correlationId);
        throw Errors.customerInactive();
      }
      const accessToken = await this.jwt.signAsync({ sub: customer.id, username: customer.username, role: customer.role });
      return { accessToken, customer: { id: customer.id, username: customer.username, role: customer.role, status: customer.status } };
    } catch (error) {
      if (error instanceof AppError && error.code === 'INVALID_CREDENTIALS') {
        this.logger.warn(JSON.stringify({ event: 'AuthenticationFailed', correlationId, username: username.trim().toLowerCase() }));
      }
      throw error;
    }
  }

  async activate(token: string, correlationId: string) {
    return this.customers.activate(token, correlationId);
  }

  async authorize(token: string, policy: AuthorizationPolicy): Promise<void> {
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; role: string }>(token.replace(/^Bearer\s+/i, ''));
      const customer = await this.customers.findAuthorizationState(payload.sub);
      if (!customer || customer.role !== payload.role) throw Errors.invalidToken();
      if (customer.status === 'BLOCKED') throw Errors.customerBlocked();
      if (customer.status !== 'ACTIVE') throw Errors.customerInactive();
      const roleAllowed = policy.allowedRoles?.includes(customer.role) ?? false;
      const selfAllowed = policy.allowSelf === true && policy.customerId === customer.id;
      if (!roleAllowed && !selfAllowed) throw Errors.forbidden();
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw Errors.invalidToken();
    }
  }
}

import { Body, Controller, Get, Inject, Post, Query, Req } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import type { CorrelatedRequest } from '../request-context.js';
import { rpcToHttp } from '../rpc-to-http.js';

@Controller('api/auth')
export class AuthController {
  constructor(
    @Inject('CUSTOMER_SERVICE') private readonly customerClient: ClientProxy,
  ) {}

  @Post('login')
  login(
    @Body() credentials: { username: string; password: string },
    @Req() request: CorrelatedRequest,
  ) {
    return rpcToHttp(
      this.customerClient.send('login_customer', {
        ...credentials,
        correlationId: request.correlationId,
      }),
    );
  }

  @Get('activate')
  activate(
    @Query('token') token: string,
    @Req() request: CorrelatedRequest,
  ) {
    return rpcToHttp(
      this.customerClient.send('activate_customer', {
        token,
        correlationId: request.correlationId,
      }),
    );
  }
}

import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Post, Query } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { v4 as uuidv4 } from 'uuid';
import { rpcToHttp } from '../rpc-to-http.js';

@Controller('api/auth')
export class AuthController {
  constructor(@Inject('CUSTOMER_SERVICE') private readonly client: ClientProxy) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() data: { username: string; password: string }) {
    return rpcToHttp(this.client.send('login_customer', { ...data, correlationId: uuidv4() }));
  }

  @Get('activate')
  activate(@Query('token') token: string) {
    return rpcToHttp(this.client.send('activate_customer', { token, correlationId: uuidv4() }));
  }
}

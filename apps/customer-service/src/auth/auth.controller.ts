import { Controller, Get, Headers, Post, Body, Query } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { LoginDto } from './login.dto.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto, @Headers('x-correlation-id') id?: string) {
    return this.authService.login(dto, id || crypto.randomUUID());
  }

  @Get('activate')
  activate(
    @Query('token') token: string,
    @Headers('x-correlation-id') id?: string,
  ) {
    return this.authService.activate(token, id || crypto.randomUUID());
  }
}

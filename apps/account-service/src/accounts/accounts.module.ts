import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthService } from '../auth/jwt-auth.service.js';
import { AccountsService } from './accounts.service.js';
import { AccountsController } from './accounts.controller.js';

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must contain at least 32 characters');
}

@Module({
  imports: [JwtModule.register({ secret: jwtSecret })],
  providers: [AccountsService, JwtAuthService],
  controllers: [AccountsController],
  exports: [AccountsService],
})
export class AccountsModule {}

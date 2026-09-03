import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CustomerMessageController } from './customer-message.controller.js';
import { CustomersController } from './customers.controller.js';
import { CustomersService } from './customers.service.js';

@Module({
  imports: [AuthModule],
  controllers: [CustomersController, CustomerMessageController],
  providers: [CustomersService],
})
export class CustomersModule {}

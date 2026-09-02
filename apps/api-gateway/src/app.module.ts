import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { CustomerController } from './controllers/customer.controller.js';
import { AccountController } from './controllers/account.controller.js';
import { TransactionController } from './controllers/transaction.controller.js';
import { PaymentController } from './controllers/payment.controller.js';
import { AuthController } from './controllers/auth.controller.js';
import { CashierController } from './controllers/cashier.controller.js';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'CUSTOMER_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL ?? 'amqp://localhost:5672'],
          queue: 'customer_queue',
          queueOptions: { durable: true },
        },
      },
      {
        name: 'ACCOUNT_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: ['amqp://localhost:5672'],
          queue: 'account_queue',
          queueOptions: { durable: true },
        },
      },
      {
        name: 'TRANSACTION_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: ['amqp://localhost:5672'],
          queue: 'transaction_queue',
          queueOptions: { durable: true },
        },
      },
      {
        name: 'PAYMENT_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: ['amqp://localhost:5672'],
          queue: 'payment_queue',
          queueOptions: { durable: true },
        },
      },
    ]),
  ],
  controllers: [
    CustomerController,
    AccountController,
    TransactionController,
    PaymentController,
    AuthController,
    CashierController,
  ],
  providers: [],
})
export class AppModule {}

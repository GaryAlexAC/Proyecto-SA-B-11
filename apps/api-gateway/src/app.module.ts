import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { CustomerController } from './controllers/customer.controller.js';
import { AccountController } from './controllers/account.controller.js';
import { TransactionController } from './controllers/transaction.controller.js';
import { PaymentController } from './controllers/payment.controller.js';
import { AuthController } from './controllers/auth.controller.js';
import { CashierController } from './controllers/cashier.controller.js';
import { CustomerHttpService } from './customer-http.service.js';
import { HealthController } from './health.controller.js';
import { AuditController } from './controllers/audit.controller.js';
import { AlertController } from './controllers/alert.controller.js';
import { InterbankController } from './controllers/interbank.controller.js';
import { InterbankClientController } from './controllers/interbank-client.controller.js';
import { ApiKeyGuard } from './guards/api-key.guard.js';

// FIX P1: All RabbitMQ URLs now read from environment variables instead of being hardcoded.
// In Kubernetes, RABBITMQ_URL = "amqp://rabbitmq:5672"
// Locally (dev), falls back to "amqp://localhost:5672"
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost:5672';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'CUSTOMER_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: [RABBITMQ_URL],
          queue: 'customer_queue',
          queueOptions: { durable: true },
        },
      },
      {
        name: 'ACCOUNT_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: [RABBITMQ_URL],
          queue: 'account_queue',
          queueOptions: { durable: true },
        },
      },
      {
        name: 'TRANSACTION_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: [RABBITMQ_URL],
          queue: 'transaction_queue',
          queueOptions: { durable: true },
        },
      },
      {
        name: 'PAYMENT_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: [RABBITMQ_URL],
          queue: 'payment_queue',
          queueOptions: { durable: true },
        },
      },
      {
        name: 'NOTIFICATION_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: [RABBITMQ_URL],
          queue: 'notification_queue',
          queueOptions: { durable: true },
        },
      },
    ]),
  ],
  controllers: [
    HealthController,
    CustomerController,
    AuthController,
    CashierController,
    AccountController,
    TransactionController,
    PaymentController,
    AuditController,
    AlertController,
    InterbankController,
    InterbankClientController,
  ],
  providers: [CustomerHttpService, ApiKeyGuard],
})
export class AppModule {}

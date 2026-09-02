import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from './presentation/security/jwt-auth.guard';
import { CustomersController } from './presentation/http/controllers/customers.controller';
import { CustomersService } from './application/customers.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: config.getOrThrow<string>('JWT_EXPIRES_IN') as never },
      }),
    }),
  ],
  controllers: [CustomersController],
  providers: [CustomersService, JwtAuthGuard],
  exports: [CustomersService],
})
export class CustomersModule {}

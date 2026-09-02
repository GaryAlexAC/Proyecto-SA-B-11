import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { CustomersModule } from '../customers.module';
import { AuthService } from './application/auth.service';
import { CustomerMessageController } from './presentation/rmq/customer-message.controller';

@Module({
  imports: [
    CustomersModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({ secret: config.getOrThrow<string>('JWT_SECRET'), signOptions: { expiresIn: config.getOrThrow<string>('JWT_EXPIRES_IN') as never } }),
    }),
  ],
  controllers: [CustomerMessageController],
  providers: [AuthService],
})
export class AuthModule {}

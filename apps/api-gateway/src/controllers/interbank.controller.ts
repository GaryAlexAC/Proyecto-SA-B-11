import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import type { Request, Response } from 'express';
import { firstValueFrom, timeout } from 'rxjs';
import { ApiKeyGuard } from '../guards/api-key.guard.js';

@Controller('interbank/v1')
export class InterbankController {
  constructor(
    @Inject('PAYMENT_SERVICE') private readonly paymentClient: ClientProxy,
  ) {}

  @Get('health')
  @HttpCode(200)
  async health() {
    return {
      status: 'UP',
      bankCode: process.env.BANK_CODE || 'BANK11',
    };
  }

  @Post('transfers')
  @UseGuards(ApiKeyGuard)
  async receiveTransfer(
    @Body() body: any,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Headers('traceparent') traceparent: string | undefined,
    @Res() res: Response,
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Header Idempotency-Key es obligatorio',
      });
    }

    if (idempotencyKey !== body.interbankTransferId) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Idempotency-Key debe ser igual a interbankTransferId',
      });
    }

    try {
      const result = await firstValueFrom(
        this.paymentClient
          .send('interbank_receive_transfer', {
            payload: body,
            traceparent,
            idempotencyKey,
          })
          .pipe(timeout(10_000)),
      );

      return res.status(result.status || 202).json(result.body || result);
    } catch (err: any) {
      const statusCode = err.statusCode || 500;
      return res.status(statusCode).json({
        statusCode,
        error: err.error || err.message || 'Error al procesar transferencia',
        ...(err.code ? { code: err.code } : {}),
        ...(err.reasonCode ? { reasonCode: err.reasonCode } : {}),
      });
    }
  }

  @Get('transfers/:interbankTransferId')
  @UseGuards(ApiKeyGuard)
  async getTransfer(
    @Param('interbankTransferId') interbankTransferId: string,
    @Res() res: Response,
  ) {
    try {
      const result = await firstValueFrom(
        this.paymentClient
          .send('interbank_get_transfer', { id: interbankTransferId })
          .pipe(timeout(8_000)),
      );
      return res.status(200).json(result);
    } catch (err: any) {
      const statusCode = err.statusCode || 404;
      return res.status(statusCode).json({
        statusCode,
        error: err.error || 'Depósito no encontrado',
      });
    }
  }

  @Post('transfers/:interbankTransferId/cancel')
  @UseGuards(ApiKeyGuard)
  async cancelTransfer(
    @Param('interbankTransferId') interbankTransferId: string,
    @Body() body: any,
    @Res() res: Response,
  ) {
    try {
      const result = await firstValueFrom(
        this.paymentClient
          .send('interbank_cancel_transfer', {
            id: interbankTransferId,
            reason: body,
          })
          .pipe(timeout(8_000)),
      );
      return res.status(200).json(result);
    } catch (err: any) {
      const statusCode = err.statusCode || 500;
      return res.status(statusCode).json({
        statusCode,
        error: err.error || 'Error al cancelar transferencia',
      });
    }
  }

  @Post('transfers/:interbankTransferId/result')
  @UseGuards(ApiKeyGuard)
  async receiveResult(
    @Param('interbankTransferId') interbankTransferId: string,
    @Body() body: any,
    @Headers('traceparent') traceparent: string | undefined,
    @Res() res: Response,
  ) {
    try {
      const result = await firstValueFrom(
        this.paymentClient
          .send('interbank_receive_result', {
            payload: { ...body, interbankTransferId },
            traceparent,
          })
          .pipe(timeout(8_000)),
      );
      return res.status(200).json(result);
    } catch (err: any) {
      const statusCode = err.statusCode || 500;
      return res.status(statusCode).json({
        statusCode,
        error: err.error || 'Error registrando resultado de transferencia',
      });
    }
  }

  @Get('reconciliation')
  @UseGuards(ApiKeyGuard)
  async reconciliation(
    @Query('date') date: string,
    @Query('page') page: string | undefined,
    @Query('pageSize') pageSize: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!date) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Parámetro date es requerido (formato YYYY-MM-DD)',
      });
    }

    const callingBank = (req as any).callingBankCode || 'BANK06';

    try {
      const result = await firstValueFrom(
        this.paymentClient
          .send('interbank_reconciliation', {
            date,
            page: page ? Number(page) : 1,
            pageSize: pageSize ? Number(pageSize) : 100,
            callingBankCode: callingBank,
          })
          .pipe(timeout(10_000)),
      );
      return res.status(200).json(result);
    } catch (err: any) {
      const statusCode = err.statusCode || 500;
      return res.status(statusCode).json({
        statusCode,
        error: err.error || 'Error consultando conciliación',
      });
    }
  }
}

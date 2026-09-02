import { Body, Controller, Get, Headers, HttpCode, HttpException, HttpStatus, Inject, Param, Patch, Post, Put, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ClientProxy } from '@nestjs/microservices';
import { v4 as uuidv4 } from 'uuid';
import { rpcToHttp } from '../rpc-to-http.js';

interface UploadedImage {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
}

@Controller('api/customers')
export class CustomerController {
  constructor(@Inject('CUSTOMER_SERVICE') private readonly client: ClientProxy) {}

  @Post()
  @UseInterceptors(FileInterceptor('identityPhoto', { limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 10, parts: 11, fieldSize: 4 * 1024 } }))
  registerCustomer(@Body() data: Record<string, string>, @UploadedFile() identityPhoto: UploadedImage | undefined, @Headers('authorization') authorization?: string, @Headers('idempotency-key') idempotencyKey?: string) {
    return this.forwardMultipart('/customers', 'POST', data, identityPhoto, authorization, idempotencyKey);
  }

  @Get()
  listCustomers(@Headers('authorization') authorization?: string) {
    return rpcToHttp(this.client.send('list_customers', { authorization, correlationId: uuidv4() }));
  }

  @Get(':id')
  getCustomer(@Param('id') id: string, @Headers('authorization') authorization?: string) {
    return rpcToHttp(this.client.send('get_customer', { id, authorization, correlationId: uuidv4() }));
  }

  @Patch(':id')
  updateCustomer(@Param('id') id: string, @Body() data: Record<string, unknown>, @Headers('authorization') authorization?: string, @Headers('idempotency-key') idempotencyKey?: string) {
    return rpcToHttp(this.client.send('update_customer', { id, data, authorization, idempotencyKey, correlationId: uuidv4() }));
  }

  @Post(':id/block')
  @HttpCode(HttpStatus.OK)
  blockCustomer(@Param('id') id: string, @Body('version') version: number, @Headers('authorization') authorization?: string, @Headers('idempotency-key') idempotencyKey?: string) {
    return rpcToHttp(this.client.send('block_customer', { id, version, authorization, idempotencyKey, correlationId: uuidv4() }));
  }

  @Put(':id/identity-document')
  @UseInterceptors(FileInterceptor('identityPhoto', { limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 10, parts: 11, fieldSize: 4 * 1024 } }))
  updateIdentityDocument(@Param('id') id: string, @Body() data: Record<string, string>, @UploadedFile() identityPhoto: UploadedImage | undefined, @Headers('authorization') authorization?: string, @Headers('idempotency-key') idempotencyKey?: string) {
    return this.forwardMultipart(`/customers/${id}/identity-document`, 'PUT', data, identityPhoto, authorization, idempotencyKey);
  }

  private async forwardMultipart(path: string, method: 'POST' | 'PUT', data: Record<string, string>, file?: UploadedImage, authorization?: string, idempotencyKey?: string): Promise<unknown> {
    const form = new FormData();
    Object.entries(data).forEach(([key, value]) => form.append(key, value));
    if (file) form.append('identityPhoto', new Blob([Uint8Array.from(file.buffer)], { type: file.mimetype }), file.originalname);

    const headers: Record<string, string> = { 'x-correlation-id': uuidv4() };
    if (authorization) headers.authorization = authorization;
    if (idempotencyKey) headers['idempotency-key'] = idempotencyKey;

    try {
      const response = await fetch(`${process.env.CUSTOMER_SERVICE_HTTP_URL ?? 'http://localhost:3001'}${path}`, { method, headers, body: form, signal: AbortSignal.timeout(10_000) });
      const text = await response.text();
      const body = text ? this.parseResponse(text) : {};
      if (!response.ok) throw new HttpException(body, response.status);
      return body;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      if (error instanceof Error && error.name === 'TimeoutError') throw new HttpException('Customer Service no respondió a tiempo', HttpStatus.GATEWAY_TIMEOUT);
      throw new HttpException('No fue posible conectar con Customer Service', HttpStatus.BAD_GATEWAY);
    }
  }

  private parseResponse(text: string): Record<string, unknown> {
    try {
      const parsed: unknown = JSON.parse(text);
      return typeof parsed === 'object' && parsed !== null ? parsed as Record<string, unknown> : { message: String(parsed) };
    } catch {
      return { message: text };
    }
  }
}

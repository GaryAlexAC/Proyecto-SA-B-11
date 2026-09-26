import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import axios from 'axios';
import FormData from 'form-data';

interface ProxyHeaders {
  authorization?: string;
  correlationId: string;
  idempotencyKey?: string;
}

@Injectable()
export class CustomerHttpService {
  private readonly baseUrl =
    process.env.CUSTOMER_SERVICE_HTTP_URL || 'http://localhost:3001';

  registerCustomer(
    fields: Record<string, unknown>,
    file: Express.Multer.File | undefined,
    headers: ProxyHeaders,
  ) {
    return this.sendMultipart('post', '/customers', fields, file, headers);
  }

  updateIdentityDocument(
    customerId: string,
    fields: Record<string, unknown>,
    file: Express.Multer.File | undefined,
    headers: ProxyHeaders,
  ) {
    return this.sendMultipart(
      'put',
      `/customers/${encodeURIComponent(customerId)}/identity-document`,
      fields,
      file,
      headers,
    );
  }

  private async sendMultipart(
    method: 'post' | 'put',
    path: string,
    fields: Record<string, unknown>,
    file: Express.Multer.File | undefined,
    headers: ProxyHeaders,
  ) {
    const form = new FormData();
    for (const [name, value] of Object.entries(fields)) {
      if (value !== undefined && value !== null) form.append(name, String(value));
    }
    if (file) {
      form.append('identityPhoto', file.buffer, {
        filename: file.originalname,
        contentType: file.mimetype,
        knownLength: file.size,
      });
    }

    try {
      const response = await axios.request({
        method,
        url: `${this.baseUrl}${path}`,
        data: form,
        headers: {
          ...form.getHeaders(),
          Authorization: headers.authorization || '',
          'X-Correlation-Id': headers.correlationId,
          ...(headers.idempotencyKey
            ? { 'Idempotency-Key': headers.idempotencyKey }
            : {}),
        },
        timeout: 8_000,
        maxBodyLength: 6 * 1024 * 1024,
        validateStatus: () => true,
      });

      if (response.status >= 400) {
        throw new HttpException(response.data, response.status);
      }
      return response.data;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        'Customer Service no disponible',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}

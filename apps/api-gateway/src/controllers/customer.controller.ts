import { Body, Controller, Get, Inject, Param, Post, Put, Delete } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { v4 as uuidv4 } from 'uuid';

@Controller('api/customers')
export class CustomerController {
  constructor(
    @Inject('CUSTOMER_SERVICE') private readonly client: ClientProxy,
  ) {}

  @Post()
  registerCustomer(@Body() data: any) {
    // Inyectamos correlationId para trazabilidad (RNF-07)
    const payload = { ...data, correlationId: uuidv4() };
    
    // Usamos send() para comunicación asíncrona sobre RabbitMQ pero respuesta HTTP sincrónica
    return this.client.send('register_customer', payload);
  }

  @Get(':id')
  getCustomer(@Param('id') id: string) {
    return this.client.send('get_customer', { id, correlationId: uuidv4() });
  }

  @Put(':id')
  updateCustomer(@Param('id') id: string, @Body() data: any) {
    const payload = { id, ...data, correlationId: uuidv4() };
    return this.client.send('update_customer', payload);
  }
}

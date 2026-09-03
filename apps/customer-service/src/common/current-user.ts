import { CustomerRole } from '../generated/prisma/index.js';

export interface CurrentUser {
  customerId: string;
  username: string;
  role: CustomerRole;
}

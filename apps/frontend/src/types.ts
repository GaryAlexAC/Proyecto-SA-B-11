export type Role = 'ADMIN' | 'CASHIER' | 'CLIENT';
export type CustomerStatus = 'INACTIVE' | 'ACTIVE' | 'BLOCKED';

export interface Customer {
  id: string;
  fullName: string;
  document: string;
  email: string;
  birthDate: string;
  address: string;
  username: string;
  role: Role;
  status: CustomerStatus;
  activatedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  hasIdentityPhoto: boolean;
}

export interface Session {
  accessToken: string;
  customer: Pick<Customer, 'id' | 'username' | 'role' | 'status'>;
}

export interface Account {
  id: string;
  customerId: string;
  accountNumber?: string;
  type?: string;
  accountType?: string;
  balance?: number | string;
  status?: string;
}

export interface Transaction {
  id: string;
  sourceAccountId?: string;
  destinationAccountId?: string;
  amount?: number | string;
  status?: string;
  createdAt?: string;
}

export interface Payment {
  id: string;
  transactionId?: string;
  amount?: number | string;
  status?: string;
  reason?: string;
}

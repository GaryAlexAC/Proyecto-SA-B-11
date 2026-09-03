export type UserRole = "ADMIN" | "CASHIER" | "CLIENT";
export type CustomerStatus = "INACTIVE" | "ACTIVE" | "BLOCKED";
export type AccountType = "MONETARIA" | "AHORRO";
export type AccountStatus = "ACTIVE" | "INACTIVE" | "BLOCKED";
export type TransactionStatus =
  "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "COMPENSATING";
export type PaymentStatus = "PENDING" | "APPROVED" | "REJECTED" | "PROCESSING";
export type PaymentType = "INTERNAL" | "EXTERNAL";
export type Money = number | string;

export interface SessionUser {
  customerId: string;
  username: string;
  role: UserRole;
  status: CustomerStatus;
}

export interface AuthSession {
  accessToken: string;
  user: SessionUser;
}

export interface Customer {
  id: string;
  fullName: string;
  document: string;
  email: string;
  birthDate: string;
  address: string;
  identityPhotoMimeType: string | null;
  username: string;
  role: UserRole;
  status: CustomerStatus;
  activatedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  hasIdentityPhoto: boolean;
}

export interface CustomerInput {
  fullName: string;
  document: string;
  email: string;
  birthDate: string;
  address: string;
  password: string;
}

export interface CustomerUpdateInput {
  version: number;
  fullName?: string;
  email?: string;
  birthDate?: string;
  address?: string;
}

export interface Account {
  id: string;
  customerId: string;
  type: AccountType;
  balance: Money;
  status: AccountStatus;
  lastActivity: string;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  correlationId: string;
  sourceAccountId: string;
  targetAccountId: string;
  amount: Money;
  status: TransactionStatus;
  failReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  transactionId: string;
  correlationId: string;
  amount: Money;
  status: PaymentStatus;
  type: PaymentType;
  description: string | null;
  failReason: string | null;
  createdAt: string;
  updatedAt: string;
}

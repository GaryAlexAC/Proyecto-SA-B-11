export type ReasonCode =
  | 'ACCOUNT_NOT_FOUND'
  | 'ACCOUNT_INACTIVE'
  | 'AMOUNT_LIMIT_EXCEEDED'
  | 'CURRENCY_NOT_SUPPORTED'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'PROCESSING_ERROR';

export interface TransferRequest {
  interbankTransferId: string;
  originBankCode: string;
  destinationBankCode: string;
  originAccount: string;
  destinationAccount: string;
  amount: string;
  currency: 'GTQ';
  description?: string;
  createdAt: string;
  expiresAt: string;
}

export interface TransferAck {
  interbankTransferId: string;
  status: 'PROCESSING';
  receivedAt: string;
}

export interface TransferStatusResponse {
  interbankTransferId: string;
  status: 'PROCESSING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';
  reasonCode?: ReasonCode;
  updatedAt: string;
}

export interface TransferResult {
  interbankTransferId: string;
  destinationBankCode: string;
  status: 'ACCEPTED' | 'REJECTED';
  reasonCode?: ReasonCode;
  reasonMessage?: string;
  processedAt: string;
}

export interface CallbackAck {
  interbankTransferId: string;
  status: 'ACCEPTED' | 'REJECTED';
  acknowledgedAt: string;
}

export interface CancelRequest {
  reason: 'TIMEOUT' | 'CANCELLED' | 'OTHER';
}

export interface CancelResponse {
  interbankTransferId: string;
  status: 'CANCELLED' | 'ALREADY_ACCEPTED' | 'ALREADY_REJECTED';
  cancelledAt: string;
}

export interface ReversalRequest {
  reversalId: string;
  originalTransferId: string;
  reason: 'LATE_ACCEPTED' | 'DUPLICATE' | 'OTHER';
}

export interface ReversalStatusResponse {
  reversalId: string;
  originalTransferId: string;
  status: 'PROCESSING' | 'COMPLETED' | 'REJECTED';
  reason: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReconciliationPage {
  date: string;
  totalTransfers: number;
  totalAmount: string;
  page: number;
  pageSize: number;
  totalPages: number;
  transfers: Array<{
    interbankTransferId: string;
    originBankCode: string;
    destinationBankCode: string;
    originAccount: string;
    destinationAccount: string;
    amount: string;
    status: string;
    reasonCode?: string;
    processedAt: string;
  }>;
}

export interface InterbankMockConfig {
  enabled: boolean;
  behavior: 'SUCCESS' | 'REJECT' | 'TIMEOUT' | 'SLOW';
  rejectReason: ReasonCode;
  latencyMs: number;
}

export interface OutgoingTransferDto {
  sourceAccountId: string;
  destinationBankCode: string;
  destinationAccount: string;
  amount: number;
  description?: string;
}

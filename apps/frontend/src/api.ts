import type { Account, Customer, Payment, Session, Transaction } from './types';

const apiUrl = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly details: Array<{ field: string; message: string }> = [],
  ) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(options.headers);
  if (token) headers.set('authorization', `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData)) headers.set('content-type', 'application/json');

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(`${apiUrl}${path}`, { ...options, headers, signal: controller.signal });
    const text = await response.text();
    const payload = text ? parseJson(text) : {};
    if (!response.ok) {
      const body = payload as { message?: string; code?: string; details?: Array<{ field: string; message: string }> };
      throw new ApiError(body.message ?? 'No fue posible completar la operación', response.status, body.code, body.details);
    }
    return payload as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') throw new ApiError('El servidor tardó demasiado en responder', 504);
    throw new ApiError('No se pudo conectar con el API Gateway', 503);
  } finally {
    window.clearTimeout(timeout);
  }
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

function mutationHeaders(): HeadersInit {
  return { 'idempotency-key': crypto.randomUUID() };
}

export const api = {
  login(username: string, password: string) {
    return request<Session>('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
  },

  getCustomer(id: string, token: string) {
    return request<Customer>(`/api/customers/${encodeURIComponent(id)}`, {}, token);
  },

  listCustomers(token: string) {
    return request<Customer[]>('/api/customers', {}, token);
  },

  createCashier(data: Record<string, string>, token: string) {
    return request<Customer>('/api/cashiers', { method: 'POST', headers: mutationHeaders(), body: JSON.stringify(data) }, token);
  },

  registerCustomer(data: Record<string, string>, identityPhoto: File, token: string) {
    const form = new FormData();
    Object.entries(data).forEach(([key, value]) => form.append(key, value));
    form.set('role', 'CLIENT');
    form.set('identityPhoto', identityPhoto);
    return request<Customer>('/api/customers', { method: 'POST', headers: mutationHeaders(), body: form }, token);
  },

  updateCustomer(id: string, version: number, data: Record<string, string>, token: string) {
    return request<Customer>(`/api/customers/${encodeURIComponent(id)}`, { method: 'PATCH', headers: mutationHeaders(), body: JSON.stringify({ ...data, version }) }, token);
  },

  blockCustomer(id: string, version: number, token: string) {
    return request<Customer>(`/api/customers/${encodeURIComponent(id)}/block`, { method: 'POST', headers: mutationHeaders(), body: JSON.stringify({ version }) }, token);
  },

  updateIdentityDocument(id: string, version: number, identityPhoto: File, token: string) {
    const form = new FormData();
    form.set('version', String(version));
    form.set('identityPhoto', identityPhoto);
    return request<Customer>(`/api/customers/${encodeURIComponent(id)}/identity-document`, { method: 'PUT', headers: mutationHeaders(), body: form }, token);
  },

  createAccount(data: { customerId: string; accountType: string }, token: string) {
    return request<Account>('/api/accounts', { method: 'POST', headers: mutationHeaders(), body: JSON.stringify(data) }, token);
  },

  getAccounts(customerId: string, token: string) {
    return request<Account[]>(`/api/accounts/customer/${encodeURIComponent(customerId)}`, {}, token);
  },

  getBalance(accountId: string, token: string) {
    return request<{ balance: number | string }>(`/api/accounts/${encodeURIComponent(accountId)}/balance`, {}, token);
  },

  createTransaction(data: { sourceAccountId: string; destinationAccountId: string; amount: number }, token: string) {
    return request<Transaction>('/api/transactions', { method: 'POST', headers: mutationHeaders(), body: JSON.stringify(data) }, token);
  },

  getTransactions(customerId: string, token: string) {
    return request<Transaction[]>(`/api/transactions/customer/${encodeURIComponent(customerId)}`, {}, token);
  },

  getTransaction(id: string, token: string) {
    return request<Transaction>(`/api/transactions/${encodeURIComponent(id)}`, {}, token);
  },

  createPayment(data: { transactionId: string; amount: number }, token: string) {
    return request<Payment>('/api/payments', { method: 'POST', headers: mutationHeaders(), body: JSON.stringify(data) }, token);
  },

  getPayment(id: string, token: string) {
    return request<Payment>(`/api/payments/${encodeURIComponent(id)}`, {}, token);
  },
};

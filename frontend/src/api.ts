import type {
  Account,
  AccountType,
  AuthSession,
  Customer,
  CustomerInput,
  CustomerUpdateInput,
  Payment,
  PaymentType,
  Transaction,
} from "./types";

const configuredUrl = import.meta.env.VITE_API_GATEWAY_URL?.trim();
const API_URL = configuredUrl ? configuredUrl.replace(/\/$/, "") : "";
const SESSION_KEY = "bank-usac-session";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function getAccessToken() {
  try {
    const stored = localStorage.getItem(SESSION_KEY);
    if (!stored) return undefined;
    return (JSON.parse(stored) as AuthSession).accessToken;
  } catch {
    return undefined;
  }
}

function errorMessage(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(errorMessage).join(", ");
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (record.message) return errorMessage(record.message);
    if (record.error) return errorMessage(record.error);
  }
  return "No fue posible completar la operación";
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  options: { authenticated?: boolean; idempotent?: boolean } = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("X-Correlation-Id", crypto.randomUUID());

  if (!(init.body instanceof FormData) && init.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  if (options.authenticated !== false) {
    const token = getAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }
  if (options.idempotent) headers.set("Idempotency-Key", crypto.randomUUID());

  const response = await fetch(`${API_URL}${path}`, { ...init, headers });
  const contentType = response.headers.get("content-type") ?? "";
  const body: unknown = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    if (response.status === 401 && options.authenticated !== false) {
      window.dispatchEvent(new Event("bank-usac:unauthorized"));
    }
    throw new ApiError(errorMessage(body), response.status, body);
  }
  return body as T;
}

function jsonBody(value: unknown) {
  return JSON.stringify(value);
}

function customerForm(input: CustomerInput, identityPhoto?: File) {
  const form = new FormData();
  Object.entries(input).forEach(([key, value]) => form.append(key, value));
  if (identityPhoto) form.append("identityPhoto", identityPhoto);
  return form;
}

export const api = {
  login(username: string, password: string) {
    return request<AuthSession>(
      "/api/auth/login",
      { method: "POST", body: jsonBody({ username, password }) },
      { authenticated: false },
    );
  },

  activate(token: string) {
    return request<{ customerId: string; status: "ACTIVE" }>(
      `/api/auth/activate?token=${encodeURIComponent(token)}`,
      {},
      { authenticated: false },
    );
  },

  listCustomers() {
    return request<Customer[]>("/api/customers");
  },

  getCustomer(customerId: string) {
    return request<Customer>(
      `/api/customers/${encodeURIComponent(customerId)}`,
    );
  },

  registerCustomer(input: CustomerInput, identityPhoto: File) {
    return request<Customer>(
      "/api/customers",
      { method: "POST", body: customerForm(input, identityPhoto) },
      { idempotent: true },
    );
  },

  createCashier(input: CustomerInput) {
    return request<Customer>(
      "/api/cashiers",
      { method: "POST", body: jsonBody(input) },
      { idempotent: true },
    );
  },

  updateCustomer(customerId: string, input: CustomerUpdateInput) {
    return request<Customer>(
      `/api/customers/${encodeURIComponent(customerId)}`,
      { method: "PATCH", body: jsonBody(input) },
      { idempotent: true },
    );
  },

  updateIdentityDocument(customerId: string, version: number, photo: File) {
    const form = new FormData();
    form.append("version", String(version));
    form.append("identityPhoto", photo);
    return request<Customer>(
      `/api/customers/${encodeURIComponent(customerId)}/identity-document`,
      { method: "PUT", body: form },
      { idempotent: true },
    );
  },

  blockCustomer(customerId: string, version: number) {
    return request<Customer>(
      `/api/customers/${encodeURIComponent(customerId)}/block`,
      { method: "POST", body: jsonBody({ version }) },
      { idempotent: true },
    );
  },

  createAccount(customerId: string, type: AccountType, balance: number) {
    return request<Account>("/api/accounts", {
      method: "POST",
      body: jsonBody({ customerId, type, balance }),
    });
  },

  getAccounts(customerId: string) {
    return request<Account[]>(
      `/api/accounts/customer/${encodeURIComponent(customerId)}`,
    );
  },

  getBalance(accountId: string) {
    return request<{ balance?: number | string; error?: string }>(
      `/api/accounts/${encodeURIComponent(accountId)}/balance`,
    );
  },

  createTransaction(
    sourceAccount: string,
    targetAccount: string,
    amount: number,
  ) {
    return request<Transaction>("/api/transactions", {
      method: "POST",
      body: jsonBody({ sourceAccount, targetAccount, amount }),
    });
  },

  getTransaction(transactionId: string) {
    return request<Transaction | null>(
      `/api/transactions/${encodeURIComponent(transactionId)}`,
    );
  },

  getTransactions(customerId: string) {
    return request<Transaction[]>(
      `/api/transactions/customer/${encodeURIComponent(customerId)}`,
    );
  },

  createPayment(input: {
    transactionId?: string;
    amount: number;
    type: PaymentType;
    description?: string;
  }) {
    return request<Payment>("/api/payments", {
      method: "POST",
      body: jsonBody(input),
    });
  },

  getPayment(paymentId: string) {
    return request<Payment | null>(
      `/api/payments/${encodeURIComponent(paymentId)}`,
    );
  },
};

export { SESSION_KEY };

import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import type {
  Account,
  Customer,
  Transaction,
  TransactionStatus,
} from "../types";
import {
  Alert,
  Button,
  EmptyState,
  Field,
  Icon,
  Loading,
  SelectField,
  StatusBadge,
  accountOptionLabel,
  formatDate,
  formatAccountNumber,
  formatMoney,
  shortAccountNumber,
} from "../ui";

export function TransactionsPage() {
  const { session } = useAuth();
  const user = session!.user;
  const fixedCustomer = user.role === "CLIENT" ? user.customerId : "";
  const isCashier = user.role === "CASHIER";
  const [customerId, setCustomerId] = useState(fixedCustomer);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [sourceAccount, setSourceAccount] = useState("");
  const [targetAccount, setTargetAccount] = useState("");
  const [amount, setAmount] = useState("");
  const [lookupId, setLookupId] = useState("");
  const [lookupResult, setLookupResult] = useState<
    Transaction | null | undefined
  >();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [accountFilter, setAccountFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | TransactionStatus>("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  async function loadHistory(target = customerId) {
    if (!target.trim()) {
      setError("Selecciona un cliente");
      return;
    }
    setLoading(true);
    setError("");
    try {
      setTransactions(
        await api.getTransactions(target.trim(), {
          accountId: accountFilter.trim() || undefined,
          status: statusFilter || undefined,
          from: fromDate || undefined,
          to: toDate || undefined,
        }),
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No fue posible consultar las transferencias",
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadCustomerAccounts(target: string) {
    setAccounts([]);
    if (!target) return;
    try {
      setAccounts(await api.getAccounts(target));
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No fue posible consultar las cuentas",
      );
    }
  }

  function selectCustomer(value: string) {
    setCustomerId(value);
    setSourceAccount("");
    setAccountFilter("");
    setTransactions([]);
    void loadCustomerAccounts(value);
  }

  useEffect(() => {
    if (fixedCustomer) {
      void loadHistory(fixedCustomer);
      return;
    }

    void api
      .listCustomers()
      .then((data) =>
        setCustomers(data.filter((customer) => customer.role === "CLIENT")),
      )
      .catch((caught: unknown) =>
        setError(
          caught instanceof Error
            ? caught.message
            : "No fue posible cargar los clientes",
        ),
      );
  }, [fixedCustomer]);

  useEffect(() => {
    if (!fixedCustomer) return;

    async function loadSourceAccounts() {
      try {
        setAccounts(await api.getAccounts(fixedCustomer));
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "No fue posible consultar las cuentas de origen",
        );
      }
    }

    void loadSourceAccounts();
  }, [fixedCustomer]);

  async function create(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      const created = await api.createTransaction(
        sourceAccount.trim().toLowerCase(),
        targetAccount.trim().toLowerCase(),
        Number(amount),
        isCashier ? customerId.trim() : undefined,
      );
      setTransactions((current) => [created, ...current]);
      setLookupResult(created);
      setMessage(`Transferencia creada con estado ${created.status}`);
      setTargetAccount("");
      setAmount("");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No fue posible crear la transferencia",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function lookup(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      setLookupResult(await api.getTransaction(lookupId.trim()));
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No fue posible consultar la transferencia",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <span className="overline">Movimiento de fondos</span>
          <h1>Transferencias</h1>
          <p>
            Envía dinero y consulta el estado de cada operación.
          </p>
        </div>
      </header>
      {error && <Alert>{error}</Alert>}
      {message && <Alert tone="success">{message}</Alert>}
      <section className="operations-grid">
        <form className="content-card operation-form" onSubmit={create}>
          <div className="operation-form__number">01</div>
          <span className="overline">Nueva operación</span>
          <h2>Transferir fondos</h2>
          {isCashier && (
            <SelectField
              label="Cliente titular"
              value={customerId}
              onChange={selectCustomer}
              required
            >
              <option value="" disabled>
                Selecciona un cliente
              </option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {`${customer.fullName} · @${customer.username}`}
                </option>
              ))}
            </SelectField>
          )}
          <SelectField
            label="Cuenta origen"
            value={sourceAccount}
            onChange={setSourceAccount}
            required
          >
            <option value="" disabled>
              {customerId
                ? "Selecciona una cuenta"
                : "Selecciona primero un cliente"}
            </option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {accountOptionLabel(account)}
              </option>
            ))}
          </SelectField>
          <Field
            label="Número de cuenta destino"
            value={targetAccount}
            onChange={(event) => setTargetAccount(event.target.value)}
            placeholder="Ingresa el número de cuenta"
            required
          />
          <Field
            label="Monto"
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="0.00"
            required
          />
          <Button type="submit" disabled={submitting}>
            {submitting ? "Enviando solicitud..." : "Confirmar transferencia"}{" "}
            <Icon name="arrow" />
          </Button>
          <small>
            La operación protege ambos saldos y se revierte automáticamente si
            algún paso falla.
          </small>
        </form>
        <div className="operations-side">
          <form className="content-card inline-lookup" onSubmit={lookup}>
            <div>
              <span className="overline">Seguimiento</span>
              <h2>Consultar operación</h2>
            </div>
            <Field
              label="Referencia de transferencia"
              value={lookupId}
              onChange={(event) => setLookupId(event.target.value)}
              placeholder="Referencia de la operación"
              required
            />
            <Button type="submit" variant="secondary">
              <Icon name="search" /> Buscar
            </Button>
          </form>
          {lookupResult !== undefined && (
            <div className="content-card result-card">
              {lookupResult ? (
                <TransactionSummary transaction={lookupResult} />
              ) : (
                <EmptyState
                  title="Transferencia no encontrada"
                  detail="Verifica la referencia ingresada."
                />
              )}
            </div>
          )}
        </div>
      </section>

      <section className="content-card transaction-history">
        <div className="section-heading">
          <div>
            <span className="overline">Historial</span>
            <h2>Transferencias recientes</h2>
          </div>
          <Button variant="quiet" onClick={() => void loadHistory()}>
            <Icon name="refresh" /> Actualizar
          </Button>
        </div>
        <div className="history-filters">
          {isCashier && (
            <SelectField
              label="Cliente"
              value={customerId}
              onChange={selectCustomer}
            >
              <option value="" disabled>
                Selecciona un cliente
              </option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {`${customer.fullName} · @${customer.username}`}
                </option>
              ))}
            </SelectField>
          )}
          <SelectField
            label="Cuenta"
            value={accountFilter}
            onChange={setAccountFilter}
          >
            <option value="">Todas las cuentas</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {accountOptionLabel(account)}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Estado"
            value={statusFilter}
            onChange={(value) =>
              setStatusFilter(value as "" | TransactionStatus)
            }
          >
            <option value="">Todos</option>
            <option value="PENDING_KYC">Validando KYC</option>
            <option value="PENDING">Pendiente</option>
            <option value="PROCESSING">Procesando</option>
            <option value="APPROVED">Aprobada</option>
            <option value="FAILED">Fallida</option>
            <option value="COMPENSATING">Compensando</option>
          </SelectField>
          <Field
            label="Desde"
            type="date"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
          />
          <Field
            label="Hasta"
            type="date"
            value={toDate}
            min={fromDate || undefined}
            onChange={(event) => setToDate(event.target.value)}
          />
          <Button variant="secondary" onClick={() => void loadHistory()}>
            <Icon name="search" /> Filtrar
          </Button>
        </div>
        {loading ? (
          <Loading />
        ) : transactions.length ? (
          <div className="transaction-table">
            <div className="transaction-table__head">
              <span>Fecha</span>
              <span>Origen</span>
              <span>Destino</span>
              <span>Estado</span>
              <span>Monto</span>
            </div>
            {transactions.map((transaction) => (
              <button
                key={transaction.id}
                className="transaction-row"
                onClick={() => setLookupResult(transaction)}
              >
                <span>{formatDate(transaction.createdAt, true)}</span>
                <code>{shortAccountNumber(transaction.sourceAccountId)}</code>
                <code>
                  {transaction.targetAccountId
                    ? shortAccountNumber(transaction.targetAccountId)
                    : "Pago de servicio"}
                </code>
                <StatusBadge status={transaction.status} />
                <strong>{formatMoney(transaction.amount)}</strong>
              </button>
            ))}
          </div>
        ) : (
          <EmptyState
            title="Sin transferencias"
            detail="Las operaciones del cliente aparecerán en este historial."
          />
        )}
      </section>
    </div>
  );
}

function TransactionSummary({ transaction }: { transaction: Transaction }) {
  return (
    <div className="summary-card">
      <div className="summary-card__heading">
        <div className="activity-row__icon">
          <Icon name="transfer" />
        </div>
        <div>
          <small>Referencia de transferencia</small>
          <strong>{transaction.id.slice(0, 12)}…</strong>
        </div>
        <StatusBadge status={transaction.status} />
      </div>
      <strong className="summary-card__amount">
        {formatMoney(transaction.amount)}
      </strong>
      <dl>
        <div>
          <dt>Número de cuenta origen</dt>
          <dd>{formatAccountNumber(transaction.sourceAccountId)}</dd>
        </div>
        <div>
          <dt>Número de cuenta destino</dt>
          <dd>
            {transaction.targetAccountId
              ? formatAccountNumber(transaction.targetAccountId)
              : "Pago de servicio"}
          </dd>
        </div>
        <div>
          <dt>Fecha</dt>
          <dd>{formatDate(transaction.createdAt, true)}</dd>
        </div>
        {transaction.failReason && (
          <div>
            <dt>Motivo</dt>
            <dd>{transaction.failReason}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}

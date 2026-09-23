import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import type { Account, Transaction, TransactionStatus } from "../types";
import {
  Alert,
  Button,
  EmptyState,
  Field,
  Icon,
  Loading,
  SelectField,
  StatusBadge,
  formatDate,
  formatMoney,
} from "../ui";

export function TransactionsPage() {
  const { session } = useAuth();
  const user = session!.user;
  const fixedCustomer = user.role === "CLIENT" ? user.customerId : "";
  const [customerId, setCustomerId] = useState(fixedCustomer);
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
      setError("Ingresa el identificador del cliente");
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

  useEffect(() => {
    if (fixedCustomer) void loadHistory(fixedCustomer);
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
        sourceAccount.trim(),
        targetAccount.trim(),
        Number(amount),
        user.role === "CASHIER" ? customerId.trim() : undefined,
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
            Envía dinero y consulta el avance de cada operación distribuida.
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
          {user.role === "CASHIER" && (
            <Field
              label="Cliente titular"
              value={customerId}
              onChange={(event) => setCustomerId(event.target.value)}
              placeholder="UUID del cliente"
              required
            />
          )}
          {user.role === "CLIENT" ? (
            <SelectField
              label="Cuenta origen"
              value={sourceAccount}
              onChange={setSourceAccount}
              required
            >
              <option value="" disabled>
                Selecciona una cuenta
              </option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {`Cuenta ${account.type.toLowerCase()} - ${account.id}`}
                </option>
              ))}
            </SelectField>
          ) : (
            <Field
              label="Cuenta origen"
              value={sourceAccount}
              onChange={(event) => setSourceAccount(event.target.value)}
              placeholder="UUID de la cuenta"
              required
            />
          )}
          <Field
            label="Cuenta destino"
            value={targetAccount}
            onChange={(event) => setTargetAccount(event.target.value)}
            placeholder="UUID de la cuenta receptora"
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
            El resultado inicia como pendiente y se actualiza mediante la saga
            bancaria.
          </small>
        </form>
        <div className="operations-side">
          <form className="content-card inline-lookup" onSubmit={lookup}>
            <div>
              <span className="overline">Seguimiento</span>
              <h2>Consultar por ID</h2>
            </div>
            <Field
              label="ID de transferencia"
              value={lookupId}
              onChange={(event) => setLookupId(event.target.value)}
              placeholder="UUID"
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
                  detail="Verifica el identificador ingresado."
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
          {user.role === "CASHIER" && (
            <Field
              label="Cliente"
              value={customerId}
              onChange={(event) => setCustomerId(event.target.value)}
              placeholder="UUID del cliente"
            />
          )}
          {user.role === "CLIENT" ? (
            <SelectField
              label="Cuenta"
              value={accountFilter}
              onChange={setAccountFilter}
            >
              <option value="">Todas las cuentas</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {`${account.type.toLowerCase()} - ${account.id.slice(0, 8)}…`}
                </option>
              ))}
            </SelectField>
          ) : (
            <Field
              label="Cuenta"
              value={accountFilter}
              onChange={(event) => setAccountFilter(event.target.value)}
              placeholder="Todas o UUID"
            />
          )}
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
            <option value="COMPLETED">Completada</option>
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
                <code>{transaction.sourceAccountId.slice(0, 8)}…</code>
                <code>
                  {transaction.targetAccountId
                    ? `${transaction.targetAccountId.slice(0, 8)}…`
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
          <small>Transferencia</small>
          <strong>{transaction.id.slice(0, 12)}…</strong>
        </div>
        <StatusBadge status={transaction.status} />
      </div>
      <strong className="summary-card__amount">
        {formatMoney(transaction.amount)}
      </strong>
      <dl>
        <div>
          <dt>Origen</dt>
          <dd>{transaction.sourceAccountId}</dd>
        </div>
        <div>
          <dt>Destino</dt>
          <dd>{transaction.targetAccountId}</dd>
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

import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import type { Transaction } from "../types";
import {
  Alert,
  Button,
  EmptyState,
  Field,
  Icon,
  Loading,
  StatusBadge,
  formatDate,
  formatMoney,
} from "../ui";

export function TransactionsPage() {
  const { session } = useAuth();
  const user = session!.user;
  const fixedCustomer = user.role === "CLIENT" ? user.customerId : "";
  const [customerId, setCustomerId] = useState(fixedCustomer);
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

  async function loadHistory(target = customerId) {
    if (!target.trim()) {
      setError("Ingresa el identificador del cliente");
      return;
    }
    setLoading(true);
    setError("");
    try {
      setTransactions(await api.getTransactions(target.trim()));
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
          <Field
            label="Cuenta origen"
            value={sourceAccount}
            onChange={(event) => setSourceAccount(event.target.value)}
            placeholder="UUID de la cuenta"
            required
          />
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
          {user.role === "CASHIER" ? (
            <div className="history-filter">
              <input
                value={customerId}
                onChange={(event) => setCustomerId(event.target.value)}
                placeholder="UUID del cliente"
              />
              <Button variant="quiet" onClick={() => void loadHistory()}>
                Consultar
              </Button>
            </div>
          ) : (
            <Button variant="quiet" onClick={() => void loadHistory()}>
              <Icon name="refresh" /> Actualizar
            </Button>
          )}
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
                <code>{transaction.targetAccountId.slice(0, 8)}…</code>
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

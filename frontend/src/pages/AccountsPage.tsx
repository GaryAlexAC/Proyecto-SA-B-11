import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import type { Account, AccountType } from "../types";
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

export function AccountsPage() {
  const { session } = useAuth();
  const user = session!.user;
  const fixedCustomer = user.role === "CLIENT" ? user.customerId : "";
  const [customerId, setCustomerId] = useState(fixedCustomer);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [balances, setBalances] = useState<Record<string, string>>({});
  const [type, setType] = useState<AccountType>("MONETARIA");
  const [initialBalance, setInitialBalance] = useState("0");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadAccounts(target = customerId) {
    if (!target.trim()) {
      setError("Ingresa el identificador del cliente");
      return;
    }
    setLoading(true);
    setError("");
    setMessage("");
    try {
      setAccounts(await api.getAccounts(target.trim()));
      setBalances({});
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No fue posible consultar las cuentas",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (fixedCustomer) void loadAccounts(fixedCustomer);
  }, [fixedCustomer]);

  async function createAccount(event: FormEvent) {
    event.preventDefault();
    if (!customerId.trim()) return;
    setCreating(true);
    setError("");
    setMessage("");
    try {
      const created = await api.createAccount(
        customerId.trim(),
        type,
        Number(initialBalance),
      );
      setAccounts((current) => [created, ...current]);
      setMessage(`Cuenta ${created.type.toLowerCase()} creada correctamente`);
      setInitialBalance("0");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No fue posible crear la cuenta",
      );
    } finally {
      setCreating(false);
    }
  }

  async function checkBalance(account: Account) {
    setError("");
    try {
      const response = await api.getBalance(account.id);
      setBalances((current) => ({
        ...current,
        [account.id]: response.error ?? formatMoney(response.balance),
      }));
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No fue posible consultar el saldo",
      );
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <span className="overline">Productos financieros</span>
          <h1>Cuentas bancarias</h1>
          <p>Consulta saldos y productos monetarios o de ahorro.</p>
        </div>
      </header>
      {error && <Alert>{error}</Alert>}
      {message && <Alert tone="success">{message}</Alert>}

      {user.role !== "CLIENT" && (
        <section className="content-card lookup-bar">
          <Field
            label="Identificador del cliente"
            value={customerId}
            onChange={(event) => setCustomerId(event.target.value)}
            placeholder="UUID del cliente"
          />
          <Button onClick={() => void loadAccounts()} disabled={loading}>
            <Icon name="search" /> Consultar cuentas
          </Button>
        </section>
      )}

      <section
        className={`account-layout ${user.role === "CASHIER" ? "" : "account-layout--single"}`}
      >
        <div className="account-list-section">
          <div className="section-heading">
            <div>
              <span className="overline">Portafolio</span>
              <h2>
                {user.role === "CLIENT" ? "Mis cuentas" : "Cuentas encontradas"}
              </h2>
            </div>
            <span className="count-tag">{accounts.length}</span>
          </div>
          {loading ? (
            <Loading label="Consultando cuentas" />
          ) : accounts.length ? (
            <div className="account-grid">
              {accounts.map((account, index) => (
                <article
                  className={`bank-card ${account.type === "AHORRO" ? "bank-card--saving" : ""}`}
                  key={account.id}
                >
                  <div className="bank-card__top">
                    <span>
                      {account.type === "AHORRO"
                        ? "Cuenta de ahorro"
                        : "Cuenta monetaria"}
                    </span>
                    <StatusBadge status={account.status} />
                  </div>
                  <small>Saldo disponible</small>
                  <strong>
                    {balances[account.id] ?? formatMoney(account.balance)}
                  </strong>
                  <code>{account.id.toUpperCase()}</code>
                  <div className="bank-card__bottom">
                    <span>
                      Última actividad
                      <br />
                      <b>{formatDate(account.lastActivity)}</b>
                    </span>
                    <button onClick={() => void checkBalance(account)}>
                      Actualizar saldo <Icon name="refresh" />
                    </button>
                  </div>
                  <span className="bank-card__number">0{index + 1}</span>
                </article>
              ))}
            </div>
          ) : (
            <div className="content-card">
              <EmptyState
                title="No hay cuentas para mostrar"
                detail={
                  user.role === "CLIENT"
                    ? "Cuando se cree una cuenta a tu nombre aparecerá aquí."
                    : "Consulta un cliente para ver sus productos."
                }
              />
            </div>
          )}
        </div>

        {user.role === "CASHIER" && (
          <form className="content-card compact-form" onSubmit={createAccount}>
            <span className="overline">Apertura</span>
            <h2>Nueva cuenta</h2>
            <p>Crea un producto para el cliente consultado.</p>
            <Field
              label="Cliente"
              value={customerId}
              onChange={(event) => setCustomerId(event.target.value)}
              placeholder="UUID del cliente"
              required
            />
            <SelectField
              label="Tipo de cuenta"
              value={type}
              onChange={(value) => setType(value as AccountType)}
            >
              <option value="MONETARIA">Monetaria</option>
              <option value="AHORRO">Ahorro</option>
            </SelectField>
            <Field
              label="Saldo inicial"
              type="number"
              min="0"
              step="0.01"
              value={initialBalance}
              onChange={(event) => setInitialBalance(event.target.value)}
              required
            />
            <Button type="submit" disabled={creating}>
              {creating ? "Creando cuenta..." : "Crear cuenta"}
            </Button>
          </form>
        )}
      </section>
    </div>
  );
}

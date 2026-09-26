import { useEffect, useState } from "react";
import type { PageName } from "../App";
import { api } from "../api";
import { useAuth } from "../auth";
import type { Account, Customer, Transaction } from "../types";
import {
  Button,
  EmptyState,
  Icon,
  Loading,
  StatusBadge,
  formatDate,
  formatMoney,
  roleLabel,
} from "../ui";

export function DashboardPage({
  onNavigate,
}: {
  onNavigate: (page: PageName) => void;
}) {
  const { session } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load =
      session!.user.role === "CLIENT"
        ? Promise.all([
            api.getAccounts(session!.user.customerId),
            api.getTransactions(session!.user.customerId),
          ]).then(([accountData, transactionData]) => {
            if (active) {
              setAccounts(accountData);
              setTransactions(transactionData);
            }
          })
        : api.listCustomers().then((data) => {
            if (active) {
              setCustomers(
                session!.user.role === "CASHIER"
                  ? data.filter((customer) => customer.role === "CLIENT")
                  : data,
              );
            }
          });
    load
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [session]);

  const user = session!.user;
  const totalBalance = accounts.reduce(
    (total, account) => total + Number(account.balance),
    0,
  );
  const activeCustomers = customers.filter(
    (customer) => customer.status === "ACTIVE",
  ).length;

  return (
    <div className="page">
      <header className="page-header page-header--hero">
        <div>
          <span className="overline">{roleLabel(user.role)}</span>
          <h1>Buen día, {user.username.split(".")[0]}</h1>
          <p>
            {user.role === "ADMIN"
              ? "Supervisa el acceso y estado de las personas."
              : user.role === "CASHIER"
                ? "Gestiona clientes y operaciones desde tu mesa de trabajo."
                : "Consulta tu dinero y realiza operaciones con seguridad."}
          </p>
        </div>
        <div className="business-date">
          <small>Fecha operativa</small>
          <strong>{formatDate(new Date().toISOString())}</strong>
        </div>
      </header>

      {loading ? (
        <Loading />
      ) : user.role === "CLIENT" ? (
        <>
          <section className="metric-grid">
            <article className="metric-card metric-card--primary">
              <span>Saldo consolidado</span>
              <strong>{formatMoney(totalBalance)}</strong>
              <small>
                {accounts.length}{" "}
                {accounts.length === 1
                  ? "cuenta activa"
                  : "cuentas registradas"}
              </small>
              <button onClick={() => onNavigate("accounts")}>
                Ver mis cuentas <Icon name="arrow" />
              </button>
            </article>
            <article className="metric-card">
              <span>Transferencias</span>
              <strong>{transactions.length}</strong>
              <small>Operaciones encontradas</small>
              <button onClick={() => onNavigate("transactions")}>
                Ir a transferencias <Icon name="arrow" />
              </button>
            </article>
            <article className="metric-card metric-card--accent">
              <span>Acceso</span>
              <strong>Protegido</strong>
              <small>Sesión activa y protegida</small>
              <button onClick={() => onNavigate("profile")}>
                Revisar perfil <Icon name="arrow" />
              </button>
            </article>
          </section>
          <section className="content-card">
            <div className="section-heading">
              <div>
                <span className="overline">Actividad</span>
                <h2>Últimas transferencias</h2>
              </div>
              <Button
                variant="quiet"
                onClick={() => onNavigate("transactions")}
              >
                Ver todas
              </Button>
            </div>
            {transactions.length ? (
              <div className="activity-list">
                {transactions.slice(0, 5).map((transaction) => (
                  <div className="activity-row" key={transaction.id}>
                    <div className="activity-row__icon">
                      <Icon name="transfer" />
                    </div>
                    <div>
                      <strong>Transferencia</strong>
                      <small>{formatDate(transaction.createdAt, true)}</small>
                    </div>
                    <StatusBadge status={transaction.status} />
                    <strong className="activity-row__amount">
                      {formatMoney(transaction.amount)}
                    </strong>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="Sin movimientos recientes"
                detail="Tus transferencias aparecerán aquí."
              />
            )}
          </section>
        </>
      ) : (
        <>
          <section className="metric-grid">
            <article className="metric-card metric-card--primary">
              <span>
                {user.role === "CASHIER"
                  ? "Clientes registrados"
                  : "Personas registradas"}
              </span>
              <strong>{customers.length}</strong>
              <small>
                {user.role === "CASHIER"
                  ? "En tu directorio de clientes"
                  : "En el directorio general"}
              </small>
              <button onClick={() => onNavigate("customers")}>
                Abrir directorio <Icon name="arrow" />
              </button>
            </article>
            <article className="metric-card">
              <span>Usuarios activos</span>
              <strong>{activeCustomers}</strong>
              <small>
                {customers.length
                  ? `${Math.round((activeCustomers / customers.length) * 100)}% del total`
                  : "Sin registros"}
              </small>
              <button onClick={() => onNavigate("customers")}>
                Revisar estados <Icon name="arrow" />
              </button>
            </article>
            <article className="metric-card metric-card--accent">
              <span>Acción principal</span>
              <strong>
                {user.role === "ADMIN" ? "Nuevo cajero" : "Nuevo cliente"}
              </strong>
              <small>
                {user.role === "ADMIN"
                  ? "Gestiona al equipo operativo"
                  : "Inicia un registro seguro"}
              </small>
              <button onClick={() => onNavigate("customers")}>
                Comenzar <Icon name="arrow" />
              </button>
            </article>
          </section>
          <section className="content-card">
            <div className="section-heading">
              <div>
                <span className="overline">Directorio</span>
                 <h2>
                   {user.role === "CASHIER"
                     ? "Clientes recientes"
                     : "Registros recientes"}
                 </h2>
              </div>
            </div>
            {customers.length ? (
              <div className="people-preview">
                {customers.slice(0, 6).map((customer) => (
                  <div key={customer.id} className="person-line">
                    <div className="avatar avatar--light">
                      {customer.fullName.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <strong>{customer.fullName}</strong>
                      <small>{customer.email}</small>
                    </div>
                    <StatusBadge status={customer.status} />
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="El directorio está vacío"
                detail={
                  user.role === "CASHIER"
                    ? "Los clientes registrados aparecerán aquí."
                    : "Los usuarios registrados aparecerán aquí."
                }
              />
            )}
          </section>
        </>
      )}
    </div>
  );
}

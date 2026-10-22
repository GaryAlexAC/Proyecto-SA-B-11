import { useState } from "react";
import { useAuth } from "./auth";
import { AccountsPage } from "./pages/AccountsPage";
import { AuditPage } from "./pages/AuditPage";
import { ActivationPage } from "./pages/ActivationPage";
import { CustomersPage } from "./pages/CustomersPage";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { PaymentsPage } from "./pages/PaymentsPage";
import { ProfilePage } from "./pages/ProfilePage";
import { TransactionsPage } from "./pages/TransactionsPage";
import { InterbankPage } from "./pages/InterbankPage";
import { Brand, Icon, initials, roleLabel } from "./ui";
import type { UserRole } from "./types";

export type PageName =
  | "dashboard"
  | "customers"
  | "accounts"
  | "transactions"
   | "payments"
   | "interbank"
   | "profile"
   | "audit";

interface NavigationItem {
  id: PageName;
  label: string;
  icon: string;
  roles: UserRole[];
}

const navigation: NavigationItem[] = [
  {
    id: "dashboard",
    label: "Resumen",
    icon: "dashboard",
    roles: ["ADMIN", "CASHIER", "CLIENT"],
  },
  {
    id: "customers",
    label: "Personas",
    icon: "users",
    roles: ["ADMIN", "CASHIER"],
  },
  {
    id: "accounts",
    label: "Cuentas",
    icon: "wallet",
    roles: ["ADMIN", "CASHIER", "CLIENT"],
  },
  {
    id: "transactions",
    label: "Transferencias",
    icon: "transfer",
    roles: ["CASHIER", "CLIENT"],
  },
  {
    id: "payments",
    label: "Pagos",
    icon: "payment",
    roles: ["CASHIER", "CLIENT"],
  },
  {
    id: "interbank",
    label: "Interbancario",
    icon: "transfer",
    roles: ["ADMIN", "CASHIER", "CLIENT"],
  },
  {
    id: "audit",
    label: "Auditoría",
    icon: "search",
    roles: ["ADMIN", "CASHIER"],
  },
  {
    id: "profile",
    label: "Mi perfil",
    icon: "profile",
    roles: ["ADMIN", "CASHIER", "CLIENT"],
  },
];

export function App() {
  const { session, signOut } = useAuth();
  const [page, setPage] = useState<PageName>("dashboard");
  const activationToken = new URLSearchParams(window.location.search).get(
    "token",
  );

  if (activationToken && !session)
    return <ActivationPage token={activationToken} />;
  if (!session) return <LoginPage />;

  const items = navigation
    .filter((item) => item.roles.includes(session.user.role))
    .map((item) =>
      session.user.role === "CASHIER" && item.id === "customers"
        ? { ...item, label: "Clientes" }
        : item,
    );
  const activePage = items.some((item) => item.id === page)
    ? page
    : "dashboard";

  function renderPage() {
    switch (activePage) {
      case "customers":
        return <CustomersPage />;
      case "accounts":
        return <AccountsPage />;
      case "transactions":
        return <TransactionsPage />;
      case "payments":
        return <PaymentsPage />;
      case "interbank":
        return <InterbankPage />;
      case "audit":
        return <AuditPage />;
      case "profile":
        return <ProfilePage />;
      default:
        return <DashboardPage onNavigate={setPage} />;
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <nav className="sidebar__nav" aria-label="Navegación principal">
          <span className="sidebar__eyebrow">Espacio de trabajo</span>
          {items.map((item) => (
            <button
              key={item.id}
              className={
                activePage === item.id
                  ? "nav-item nav-item--active"
                  : "nav-item"
              }
              onClick={() => setPage(item.id)}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
              {activePage === item.id && <span className="nav-item__dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar__user">
          <div className="avatar">
            {initials(session.user.username.replace(".", " "))}
          </div>
          <div>
            <strong>{session.user.username}</strong>
            <small>{roleLabel(session.user.role)}</small>
          </div>
          <button
            className="icon-button"
            onClick={signOut}
            title="Cerrar sesión"
          >
            <Icon name="logout" />
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="mobile-header">
          <Brand compact />
          <button
            className="mobile-user"
            onClick={signOut}
            title="Cerrar sesión"
          >
            {initials(session.user.username.replace(".", " "))}
          </button>
        </header>
        {renderPage()}
      </main>

      <nav className="mobile-nav" aria-label="Navegación móvil">
        {items.slice(0, 5).map((item) => (
          <button
            key={item.id}
            className={
              activePage === item.id
                ? "mobile-nav__item mobile-nav__item--active"
                : "mobile-nav__item"
            }
            onClick={() => setPage(item.id)}
          >
            <Icon name={item.icon} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

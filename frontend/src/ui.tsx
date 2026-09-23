import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
} from "react";
import type {
  AccountStatus,
  CustomerStatus,
  KycStatus,
  PaymentStatus,
  TransactionStatus,
  UserRole,
} from "./types";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand ${compact ? "brand--compact" : ""}`}>
      <div className="brand__mark" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div>
        <strong>Bank USAC</strong>
        {!compact && <small>Banca con propósito</small>}
      </div>
    </div>
  );
}

export function Icon({ name }: { name: string }) {
  const paths: Record<string, ReactNode> = {
    dashboard: (
      <path d="M4 13h6V4H4v9Zm0 7h6v-4H4v4Zm10 0h6v-9h-6v9Zm0-16v4h6V4h-6Z" />
    ),
    users: (
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m7-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 10v-2a4 4 0 0 0-3-3.87m-2-12a4 4 0 0 1 0 7.75" />
    ),
    wallet: (
      <path d="M20 7V5a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h15v12H5a3 3 0 0 1-3-3V6m14 8h.01" />
    ),
    transfer: <path d="m17 3 4 4-4 4M3 7h18M7 21l-4-4 4-4m14 4H3" />,
    payment: <path d="M3 6h18v12H3V6Zm0 4h18M7 15h2" />,
    profile: (
      <path d="M20 21a8 8 0 0 0-16 0m8-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
    ),
    logout: (
      <path d="M10 17l5-5-5-5m5 5H3m12-9h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
    ),
    arrow: <path d="m9 18 6-6-6-6" />,
    plus: <path d="M12 5v14M5 12h14" />,
    search: (
      <path d="m21 21-4.35-4.35m2.35-5.65a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z" />
    ),
    shield: (
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Zm-3-10 2 2 4-4" />
    ),
    refresh: <path d="M20 11a8 8 0 1 0-2.34 5.66M20 4v7h-7" />,
  };
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] ?? paths.dashboard}
    </svg>
  );
}

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "quiet";
}) {
  return (
    <button className={`button button--${variant} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function Field({
  label,
  hint,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input {...props} />
      {hint && <small>{hint}</small>}
    </label>
  );
}

export function SelectField({
  label,
  children,
  value,
  onChange,
  required,
}: {
  label: string;
  children: ReactNode;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
      >
        {children}
      </select>
    </label>
  );
}

export function Alert({
  children,
  tone = "error",
}: {
  children: ReactNode;
  tone?: "error" | "success" | "info";
}) {
  return <div className={`alert alert--${tone}`}>{children}</div>;
}

export function Loading({
  label = "Cargando información",
}: {
  label?: string;
}) {
  return (
    <div className="loading" role="status">
      <span className="loading__spinner" />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  return (
    <div className="empty-state">
      <div className="empty-state__line" />
      <h3>{title}</h3>
      <p>{detail}</p>
    </div>
  );
}

export function StatusBadge({
  status,
}: {
  status:
    | CustomerStatus
    | KycStatus
    | AccountStatus
    | TransactionStatus
    | PaymentStatus;
}) {
  const success = ["ACTIVE", "VERIFIED", "COMPLETED", "APPROVED"].includes(
    status,
  );
  const danger = ["BLOCKED", "FAILED", "REJECTED"].includes(status);
  return (
    <span
      className={`status ${success ? "status--success" : danger ? "status--danger" : "status--pending"}`}
    >
      {statusLabel(status)}
    </span>
  );
}

export function roleLabel(role: UserRole) {
  return {
    ADMIN: "Administrador",
    CASHIER: "Cajero receptor",
    CLIENT: "Cliente",
  }[role];
}

export function statusLabel(status: string) {
  const labels: Record<string, string> = {
    ACTIVE: "Activo",
    INACTIVE: "Inactivo",
    BLOCKED: "Bloqueado",
    PENDING: "Pendiente",
    PENDING_KYC: "Validando KYC",
    VERIFIED: "Verificado",
    PROCESSING: "Procesando",
    COMPLETED: "Completada",
    FAILED: "Fallida",
    COMPENSATING: "Compensando",
    APPROVED: "Aprobado",
    REJECTED: "Rechazado",
  };
  return labels[status] ?? status;
}

export function formatMoney(value: number | string | undefined) {
  const number = Number(value ?? 0);
  return new Intl.NumberFormat("es-GT", {
    style: "currency",
    currency: "GTQ",
    minimumFractionDigits: 2,
  }).format(Number.isFinite(number) ? number : 0);
}

export function formatDate(
  value: string | null | undefined,
  includeTime = false,
) {
  if (!value) return "Sin registro";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat("es-GT", {
    dateStyle: "medium",
    ...(includeTime ? { timeStyle: "short" as const } : {}),
  }).format(date);
}

export function initials(value: string) {
  return value
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
}

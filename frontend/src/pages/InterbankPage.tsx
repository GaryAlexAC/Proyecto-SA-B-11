import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import type { Account, InterbankTransfer, InterbankMockConfig } from "../types";
import {
  Alert,
  Button,
  EmptyState,
  Field,
  Icon,
  Loading,
  SelectField,
  accountOptionLabel,
  formatDate,
  formatMoney,
  shortAccountNumber,
} from "../ui";

export function InterbankPage() {
  const { session } = useAuth();
  const user = session!.user;
  const isAdmin = user.role === "ADMIN";

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transfers, setTransfers] = useState<InterbankTransfer[]>([]);
  const [sourceAccount, setSourceAccount] = useState("");
  const [destinationBankCode, setDestinationBankCode] = useState("BANK06");
  const [destinationAccount, setDestinationAccount] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  const [mockConfig, setMockConfig] = useState<InterbankMockConfig | null>(null);
  const [mockBehavior, setMockBehavior] = useState<"SUCCESS" | "REJECT" | "TIMEOUT" | "SLOW">("SUCCESS");
  const [mockLatency, setMockLatency] = useState("500");

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savingMock, setSavingMock] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const customerId = user.role === "CLIENT" ? user.customerId : "";
      if (customerId) {
        const accs = await api.getAccounts(customerId);
        setAccounts(accs);
        if (accs.length > 0 && !sourceAccount) {
          setSourceAccount(accs[0].id);
        }
      }
      const history = await api.getInterbankTransfers();
      setTransfers(history);

      if (isAdmin) {
        const config = await api.getInterbankMockConfig();
        setMockConfig(config);
        setMockBehavior(config.behavior);
        setMockLatency(String(config.latencyMs));
      }
    } catch (err: any) {
      setError(err.message ?? "Error cargando información interbancaria");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function handleSendTransfer(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");

    const parsedAmount = Number(amount);
    if (!sourceAccount) {
      setError("Selecciona una cuenta de origen");
      return;
    }
    if (!destinationAccount.trim()) {
      setError("Ingresa la cuenta de destino en el otro banco");
      return;
    }
    if (!parsedAmount || parsedAmount <= 0) {
      setError("Ingresa un monto válido");
      return;
    }
    if (parsedAmount > 10000) {
      setError("El monto máximo por transferencia interbancaria es Q10,000.00");
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.createInterbankTransfer({
        sourceAccountId: sourceAccount,
        destinationBankCode,
        destinationAccount: destinationAccount.trim(),
        amount: parsedAmount,
        description: description.trim() || undefined,
      });

      setMessage(
        `Depósito interbancario enviado exitosamente a ${destinationBankCode}. Referencia: ${res.interbankTransferId}`
      );
      setAmount("");
      setDescription("");
      setDestinationAccount("");
      void loadData();
    } catch (err: any) {
      setError(err.message ?? "No fue posible procesar la transferencia interbancaria");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveMock(event: FormEvent) {
    event.preventDefault();
    setSavingMock(true);
    setError("");
    try {
      const updated = await api.updateInterbankMockConfig({
        enabled: true,
        behavior: mockBehavior,
        latencyMs: Number(mockLatency) || 500,
      });
      setMockConfig(updated);
      setMessage(`Simulador Mock actualizado: Modo ${mockBehavior}`);
    } catch (err: any) {
      setError(err.message ?? "Error actualizando configuración del mock");
    } finally {
      setSavingMock(false);
    }
  }

  function statusBadge(status: string) {
    const map: Record<string, { label: string; className: string }> = {
      ACCEPTED: { label: "Aceptado", className: "badge--success" },
      SENT: { label: "Enviado", className: "badge--warning" },
      PROCESSING: { label: "En Proceso", className: "badge--warning" },
      REJECTED: { label: "Rechazado", className: "badge--danger" },
      TIMEOUT: { label: "Timeout", className: "badge--warning" },
      REVERSED: { label: "Revertido", className: "badge--neutral" },
      CANCELLED: { label: "Cancelado", className: "badge--neutral" },
    };
    const s = map[status] || { label: status, className: "badge--neutral" };
    return <span className={`badge ${s.className}`}>{s.label}</span>;
  }

  return (
    <div className="page-grid">
      <header className="page-header">
        <div>
          <span className="overline">Transferencias entre Bancos</span>
          <h1>Integración Interbancaria (ACH)</h1>
          <p>
            Envío y recepción de depósitos según el estándar común OpenAPI entre{" "}
            <strong>Bank USAC (BANK11)</strong> y bancos pareja del curso.
          </p>
        </div>
      </header>

      {error && <Alert>{error}</Alert>}
      {message && <Alert tone="success">{message}</Alert>}

      <div className="operations-layout">
        {/* FORMULARIO DE ENVÍO */}
        <form className="content-card" onSubmit={handleSendTransfer}>
          <div className="section-heading">
            <div>
              <span className="overline">Rol Banco Emisor</span>
              <h2>Enviar depósito a otro banco</h2>
            </div>
          </div>

          <SelectField
            label="Cuenta origen (Bank USAC - BANK11)"
            value={sourceAccount}
            onChange={setSourceAccount}
            required
          >
            <option value="" disabled>
              Selecciona una cuenta
            </option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {accountOptionLabel(acc)} — Saldo: {formatMoney(acc.balance)}
              </option>
            ))}
          </SelectField>

          <SelectField
            label="Banco destino"
            value={destinationBankCode}
            onChange={setDestinationBankCode}
            required
          >
            <option value="BANK06">BANK06 · Banco Pareja Asignado (Grupo 6)</option>
            <option value="BANK01">BANK01</option>
            <option value="BANK02">BANK02</option>
            <option value="BANK03">BANK03</option>
            <option value="BANK04">BANK04</option>
            <option value="BANK05">BANK05</option>
            <option value="BANK07">BANK07</option>
            <option value="BANK08">BANK08</option>
            <option value="BANK09">BANK09</option>
            <option value="BANK10">BANK10</option>
            <option value="BANK12">BANK12</option>
          </SelectField>

          <Field
            label="Cuenta destino en el otro banco"
            value={destinationAccount}
            onChange={(e) => setDestinationAccount(e.target.value)}
            placeholder="Ej: 3001-000123"
            required
          />

          <Field
            label="Monto en Quetzales (GTQ)"
            type="number"
            min="0.01"
            max="10000.00"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00 (Máximo Q10,000.00)"
            required
          />

          <Field
            label="Descripción / Motivo (opcional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ej: Pago de servicios / Transferencia"
          />

          <Button type="submit" disabled={submitting}>
            {submitting ? "Despachando depósito..." : "Enviar a banco destino"}
          </Button>

          <small>
            Protocolo seguro con compensación Saga automática ante rechazo o timeout
            (180s límite de expiración).
          </small>
        </form>

        {/* PANEL MOCK Y CONTROL PARA PRUEBAS (ADMIN) */}
        <div className="operations-side">
          <form className="content-card" onSubmit={handleSaveMock}>
            <div>
              <span className="overline">Rúbrica & Escenarios de Fallo</span>
              <h2>Simulador Mock (BANK06)</h2>
              <p style={{ fontSize: "0.85rem", color: "var(--color-muted)", margin: "0.5rem 0 1rem" }}>
                Permite simular respuestas del banco pareja sin depender de su infraestructura para pruebas
                locales y calificación.
              </p>
            </div>

            <SelectField
              label="Comportamiento del Mock"
              value={mockBehavior}
              onChange={(v) => setMockBehavior(v as any)}
            >
              <option value="SUCCESS">Éxito inmediato (ACCEPTED)</option>
              <option value="REJECT">Rechazo simulado (REJECTED)</option>
              <option value="TIMEOUT">Timeout / Sin respuesta (Prueba de compensación)</option>
              <option value="SLOW">Respuesta lenta (8s de latencia)</option>
            </SelectField>

            <Field
              label="Latencia simulada (ms)"
              type="number"
              min="0"
              step="100"
              value={mockLatency}
              onChange={(e) => setMockLatency(e.target.value)}
            />

            <Button type="submit" variant="secondary" disabled={savingMock}>
              {savingMock ? "Guardando..." : "Aplicar modo simulado"}
            </Button>
          </form>
        </div>
      </div>

      {/* HISTORIAL INTERBANCARIO */}
      <section className="content-card">
        <div className="section-heading">
          <div>
            <span className="overline">Registro de Auditoría</span>
            <h2>Historial de Depósitos Interbancarios</h2>
          </div>
          <Button variant="quiet" onClick={() => void loadData()}>
            <Icon name="refresh" /> Actualizar
          </Button>
        </div>

        {loading ? (
          <Loading />
        ) : transfers.length === 0 ? (
          <EmptyState
            title="Sin transferencias interbancarias"
            detail="Aún no se han registrado depósitos con otros bancos."
          />
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Referencia</th>
                  <th>Tipo</th>
                  <th>Ruta</th>
                  <th>Cuentas</th>
                  <th>Monto</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map((tx) => (
                  <tr key={tx.id}>
                    <td>
                      <code style={{ fontSize: "0.8rem" }}>
                        {tx.interbankTransferId.slice(0, 8)}...
                      </code>
                    </td>
                    <td>
                      <span
                        style={{
                          fontWeight: 600,
                          color: tx.direction === "OUTGOING" ? "#3b82f6" : "#10b981",
                        }}
                      >
                        {tx.direction === "OUTGOING" ? "↗ Enviada" : "↙ Recibida"}
                      </span>
                    </td>
                    <td>
                      <strong>{tx.originBankCode}</strong> → <strong>{tx.destinationBankCode}</strong>
                    </td>
                    <td style={{ fontSize: "0.85rem" }}>
                      De: {shortAccountNumber(tx.originAccount)}
                      <br />
                      A: {shortAccountNumber(tx.destinationAccount)}
                    </td>
                    <td>
                      <strong>Q{formatMoney(tx.amount)}</strong>
                    </td>
                    <td>
                      {statusBadge(tx.status)}
                      {tx.reasonCode && (
                        <div style={{ fontSize: "0.75rem", color: "var(--color-danger)" }}>
                          {tx.reasonCode}
                        </div>
                      )}
                    </td>
                    <td style={{ fontSize: "0.8rem", color: "var(--color-muted)" }}>
                      {formatDate(tx.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

import { useState } from "react";
import { api } from "../api";
import type { AuditRecord } from "../types";
import { Alert, Button, EmptyState, Field, Loading, SelectField, formatDate } from "../ui";

export function AuditPage() {
  const [correlationId, setCorrelationId] = useState("");
  const [traceId, setTraceId] = useState("");
  const [severity, setSeverity] = useState<"" | AuditRecord["severity"]>("");
  const [records, setRecords] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function search() {
    setLoading(true);
    setError("");
    try {
      setRecords(await api.searchAudit({ correlationId, traceId, severity: severity || undefined }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No fue posible consultar la auditoría");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <span className="overline">Operaciones observables</span>
          <h1>Auditoría</h1>
          <p>Busca eventos históricos y relaciona cada evento con su traza distribuida.</p>
        </div>
      </header>
      {error && <Alert>{error}</Alert>}
      <section className="content-card">
        <div className="history-filters">
          <Field label="Correlation ID" value={correlationId} onChange={(event) => setCorrelationId(event.target.value)} />
          <Field label="Trace ID" value={traceId} onChange={(event) => setTraceId(event.target.value)} />
          <SelectField label="Nivel" value={severity} onChange={(value) => setSeverity(value as typeof severity)}>
            <option value="">Todos</option>
            <option value="INFO">INFO</option>
            <option value="WARNING">WARNING</option>
            <option value="ERROR">ERROR</option>
          </SelectField>
          <Button variant="secondary" onClick={() => void search()}>Buscar</Button>
        </div>
      </section>
      <section className="content-card">
        {loading ? <Loading /> : records.length ? (
          <div className="table-responsive">
            <table>
              <thead><tr><th>Fecha</th><th>Evento</th><th>Servicio</th><th>Nivel</th><th>Correlation ID</th><th>Trace ID</th></tr></thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.eventId}>
                    <td>{formatDate(record.occurredAt, true)}</td>
                    <td>{record.eventType}</td>
                    <td>{record.producer}</td>
                    <td><strong>{record.severity}</strong></td>
                    <td><code>{record.correlationId}</code></td>
                    <td><code>{record.traceId ?? "-"}</code></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState title="Sin eventos" detail="Ejecuta una búsqueda para consultar la auditoría centralizada." />}
      </section>
    </div>
  );
}

import { useState, type FormEvent } from "react";
import { api } from "../api";
import type { Payment, PaymentType } from "../types";
import {
  Alert,
  Button,
  EmptyState,
  Field,
  Icon,
  SelectField,
  StatusBadge,
  formatDate,
  formatMoney,
} from "../ui";

export function PaymentsPage() {
  const [transactionId, setTransactionId] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<PaymentType>("INTERNAL");
  const [description, setDescription] = useState("");
  const [lookupId, setLookupId] = useState("");
  const [result, setResult] = useState<Payment | null | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function create(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const payment = await api.createPayment({
        transactionId: transactionId.trim() || undefined,
        amount: Number(amount),
        type,
        description: description.trim() || undefined,
      });
      setResult(payment);
      setLookupId(payment.id);
      setMessage(`Pago procesado con estado ${payment.status}`);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No fue posible procesar el pago",
      );
    } finally {
      setLoading(false);
    }
  }

  async function lookup(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    try {
      setResult(await api.getPayment(lookupId.trim()));
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No fue posible consultar el pago",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <span className="overline">Procesamiento</span>
          <h1>Pagos</h1>
          <p>Registra pagos internos o externos y consulta su resultado.</p>
        </div>
      </header>
      {error && <Alert>{error}</Alert>}
      {message && <Alert tone="success">{message}</Alert>}
      <section className="payments-layout">
        <form className="content-card operation-form" onSubmit={create}>
          <div className="operation-form__number">01</div>
          <span className="overline">Registrar pago</span>
          <h2>Datos de la operación</h2>
          <Field
            label="Transacción relacionada"
            value={transactionId}
            onChange={(event) => setTransactionId(event.target.value)}
            placeholder="UUID opcional"
            hint="Puede omitirse para un pago independiente."
          />
          <div className="form-grid">
            <Field
              label="Monto"
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              required
            />
            <SelectField
              label="Tipo"
              value={type}
              onChange={(value) => setType(value as PaymentType)}
            >
              <option value="INTERNAL">Interno</option>
              <option value="EXTERNAL">Externo</option>
            </SelectField>
          </div>
          <Field
            label="Descripción"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Concepto del pago"
          />
          <Button type="submit" disabled={loading}>
            {loading ? "Procesando..." : "Procesar pago"} <Icon name="arrow" />
          </Button>
        </form>

        <div className="payment-result-column">
          <form className="content-card inline-lookup" onSubmit={lookup}>
            <div>
              <span className="overline">Consulta</span>
              <h2>Buscar pago</h2>
            </div>
            <Field
              label="ID del pago"
              value={lookupId}
              onChange={(event) => setLookupId(event.target.value)}
              placeholder="UUID"
              required
            />
            <Button type="submit" variant="secondary">
              <Icon name="search" /> Consultar
            </Button>
          </form>
          <section className="content-card payment-receipt">
            {result === undefined ? (
              <EmptyState
                title="Sin pago seleccionado"
                detail="Procesa un pago o búscalo por su identificador."
              />
            ) : result ? (
              <>
                <div className="receipt-header">
                  <div className="receipt-icon">
                    <Icon name="payment" />
                  </div>
                  <div>
                    <span className="overline">Comprobante</span>
                    <h2>Resultado del pago</h2>
                  </div>
                  <StatusBadge status={result.status} />
                </div>
                <strong className="receipt-amount">
                  {formatMoney(result.amount)}
                </strong>
                <p>{result.description || "Pago sin descripción"}</p>
                <dl>
                  <div>
                    <dt>Identificador</dt>
                    <dd>{result.id}</dd>
                  </div>
                  <div>
                    <dt>Tipo</dt>
                    <dd>
                      {result.type === "INTERNAL" ? "Interno" : "Externo"}
                    </dd>
                  </div>
                  <div>
                    <dt>Transacción</dt>
                    <dd>{result.transactionId}</dd>
                  </div>
                  <div>
                    <dt>Fecha</dt>
                    <dd>{formatDate(result.createdAt, true)}</dd>
                  </div>
                  {result.failReason && (
                    <div>
                      <dt>Motivo</dt>
                      <dd>{result.failReason}</dd>
                    </div>
                  )}
                </dl>
              </>
            ) : (
              <EmptyState
                title="Pago no encontrado"
                detail="Verifica el identificador ingresado."
              />
            )}
          </section>
        </div>
      </section>
    </div>
  );
}

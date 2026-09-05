import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import type { Account, Payment, Service } from "../types";
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
  const { session } = useAuth();
  const user = session!.user;
  const fixedCustomer = user.role === "CLIENT" ? user.customerId : "";
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [serviceId, setServiceId] = useState("");
  const [sourceAccountId, setSourceAccountId] = useState("");
  const [lookupId, setLookupId] = useState("");
  const [result, setResult] = useState<Payment | null | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const selectedService = services.find((service) => service.id === serviceId);

  useEffect(() => {
    async function loadPaymentOptions() {
      try {
        const [availableServices, customerAccounts] = await Promise.all([
          api.getServices(),
          fixedCustomer ? api.getAccounts(fixedCustomer) : Promise.resolve([]),
        ]);
        setServices(availableServices);
        setAccounts(customerAccounts);
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "No fue posible cargar las opciones de pago",
        );
      }
    }

    void loadPaymentOptions();
  }, [fixedCustomer]);

  useEffect(() => {
    if (!result || result.status !== "PENDING") return;

    const poll = window.setInterval(() => {
      void api
        .getPayment(result.id)
        .then((payment) => {
          if (payment) setResult(payment);
        })
        .catch(() => undefined);
    }, 1_000);

    return () => window.clearInterval(poll);
  }, [result]);

  async function create(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
      setMessage("");
    try {
      const payment = await api.createPayment({
        serviceId,
        sourceAccountId: sourceAccountId.trim(),
      });
      setResult(payment);
      setLookupId(payment.id);
      setMessage(`Pago solicitado con estado ${payment.status}`);
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
          <SelectField
            label="Servicio"
            value={serviceId}
            onChange={setServiceId}
            required
          >
            <option value="" disabled>
              Selecciona un servicio
            </option>
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {`${service.company.name} - ${service.name}`}
              </option>
            ))}
          </SelectField>
          {selectedService && (
            <Field
              label="Monto a pagar"
              value={formatMoney(selectedService.amount)}
              readOnly
            />
          )}
          {user.role === "CLIENT" ? (
            <SelectField
              label="Cuenta de pago"
              value={sourceAccountId}
              onChange={setSourceAccountId}
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
              label="Cuenta de pago"
              value={sourceAccountId}
              onChange={(event) => setSourceAccountId(event.target.value)}
              placeholder="UUID de la cuenta"
              required
            />
          )}
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

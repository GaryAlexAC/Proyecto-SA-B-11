import { useDeferredValue, useEffect, useState, type FormEvent } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import type { Customer, CustomerInput, KycStatus } from "../types";
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
  initials,
  roleLabel,
} from "../ui";

const emptyCustomer: CustomerInput = {
  fullName: "",
  document: "",
  email: "",
  birthDate: "",
  address: "",
  password: "",
};

export function CustomersPage() {
  const { session } = useAuth();
  const role = session!.user.role;
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formMode, setFormMode] = useState<"customer" | "cashier" | null>(null);
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

  async function loadCustomers() {
    setLoading(true);
    setError("");
    try {
      const data = await api.listCustomers();
      setCustomers(data);
      if (selected)
        setSelected(data.find((item) => item.id === selected.id) ?? null);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No fue posible cargar el directorio",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCustomers();
  }, []);

  const filtered = customers.filter((customer) =>
    [
      customer.fullName,
      customer.document,
      customer.email,
      customer.username,
      customer.kycStatus,
    ]
      .join(" ")
      .toLowerCase()
      .includes(deferredQuery),
  );

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <span className="overline">Gestión de personas</span>
          <h1>Directorio de usuarios</h1>
          <p>
            Consulta identidades, estados y accesos registrados en Bank USAC.
          </p>
        </div>
        <Button
          onClick={() => setFormMode(role === "ADMIN" ? "cashier" : "customer")}
        >
          <Icon name="plus" />
          {role === "ADMIN" ? "Registrar cajero" : "Registrar cliente"}
        </Button>
      </header>

      {error && <Alert>{error}</Alert>}
      <section className="directory-layout">
        <div className="content-card directory-list">
          <div className="toolbar">
            <label className="search-box">
              <Icon name="search" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por nombre, DPI o correo"
              />
            </label>
            <button
              className="icon-button icon-button--bordered"
              onClick={() => void loadCustomers()}
              title="Actualizar"
            >
              <Icon name="refresh" />
            </button>
          </div>
          <div className="table-head table-head--people">
            <span>Persona</span>
            <span>Rol</span>
            <span>Acceso</span>
            <span>KYC</span>
            <span />
          </div>
          {loading ? (
            <Loading />
          ) : filtered.length ? (
            <div className="table-body">
              {filtered.map((customer) => (
                <button
                  className={`people-row ${selected?.id === customer.id ? "people-row--selected" : ""}`}
                  key={customer.id}
                  onClick={() => setSelected(customer)}
                >
                  <span className="people-row__person">
                    <span className="avatar avatar--light">
                      {initials(customer.fullName)}
                    </span>
                    <span>
                      <strong>{customer.fullName}</strong>
                      <small>{customer.email}</small>
                    </span>
                  </span>
                  <span>{roleLabel(customer.role)}</span>
                  <StatusBadge status={customer.status} />
                  {customer.role === "CLIENT" ? (
                    <StatusBadge status={customer.kycStatus} />
                  ) : (
                    <span>—</span>
                  )}
                  <Icon name="arrow" />
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Sin resultados"
              detail="Prueba otro criterio de búsqueda."
            />
          )}
        </div>

        <aside className="content-card detail-panel">
          {selected ? (
            <CustomerDetail
              customer={selected}
              canEdit={role === "ADMIN"}
              canBlock={role === "ADMIN"}
              canManageKyc={role === "ADMIN"}
              onChange={(customer) => {
                setSelected(customer);
                setCustomers((current) =>
                  current.map((item) =>
                    item.id === customer.id ? customer : item,
                  ),
                );
              }}
            />
          ) : (
            <EmptyState
              title="Selecciona una persona"
              detail="Aquí verás su información y las acciones disponibles."
            />
          )}
        </aside>
      </section>

      {formMode && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={() => setFormMode(null)}
        >
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="person-form-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal__header">
              <div>
                <span className="overline">Nuevo registro</span>
                <h2 id="person-form-title">
                  {formMode === "cashier"
                    ? "Crear cajero receptor"
                    : "Registrar cliente"}
                </h2>
              </div>
              <button
                className="modal__close"
                onClick={() => setFormMode(null)}
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>
            <CustomerForm
              mode={formMode}
              onCreated={(customer) => {
                setCustomers((current) => [customer, ...current]);
                setSelected(customer);
                setFormMode(null);
              }}
            />
          </section>
        </div>
      )}
    </div>
  );
}

function CustomerForm({
  mode,
  onCreated,
}: {
  mode: "customer" | "cashier";
  onCreated: (customer: Customer) => void;
}) {
  const [input, setInput] = useState<CustomerInput>(emptyCustomer);
  const [photo, setPhoto] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function set<K extends keyof CustomerInput>(key: K, value: CustomerInput[K]) {
    setInput((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (mode === "customer" && !photo) {
      setError("La fotografía del documento es obligatoria");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const customer =
        mode === "cashier"
          ? await api.createCashier(input)
          : await api.registerCustomer(input, photo!);
      onCreated(customer);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No fue posible completar el registro",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="form-grid" onSubmit={submit}>
      {error && (
        <div className="form-grid__full">
          <Alert>{error}</Alert>
        </div>
      )}
      <Field
        label="Nombre completo"
        value={input.fullName}
        onChange={(event) => set("fullName", event.target.value)}
        minLength={2}
        maxLength={150}
        required
      />
      <Field
        label="DPI o documento"
        value={input.document}
        onChange={(event) => set("document", event.target.value)}
        minLength={3}
        maxLength={50}
        required
      />
      <Field
        label="Correo electrónico"
        type="email"
        value={input.email}
        onChange={(event) => set("email", event.target.value)}
        maxLength={254}
        required
      />
      <Field
        label="Fecha de nacimiento"
        type="date"
        value={input.birthDate}
        onChange={(event) => set("birthDate", event.target.value)}
        required
      />
      <div className="form-grid__full">
        <Field
          label="Dirección"
          value={input.address}
          onChange={(event) => set("address", event.target.value)}
          minLength={3}
          maxLength={300}
          required
        />
      </div>
      <div className="form-grid__full">
        <Field
          label="Contraseña temporal"
          type="password"
          value={input.password}
          onChange={(event) => set("password", event.target.value)}
          minLength={8}
          maxLength={128}
          pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+"
          hint="Mínimo 8 caracteres, con mayúscula, minúscula y número."
          required
        />
      </div>
      {mode === "customer" && (
        <label className="file-field form-grid__full">
          <span>Fotografía del documento</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => setPhoto(event.target.files?.[0] ?? null)}
            required
          />
          <small>
            {photo
              ? `${photo.name} · ${(photo.size / 1024 / 1024).toFixed(2)} MB`
              : "JPEG, PNG o WebP. Máximo 5 MB."}
          </small>
        </label>
      )}
      <div className="form-actions form-grid__full">
        <Button type="submit" disabled={loading}>
          {loading ? "Guardando..." : "Completar registro"}
        </Button>
      </div>
    </form>
  );
}

function CustomerDetail({
  customer,
  canEdit,
  canBlock,
  canManageKyc,
  onChange,
}: {
  customer: Customer;
  canEdit: boolean;
  canBlock: boolean;
  canManageKyc: boolean;
  onChange: (customer: Customer) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [kycStatus, setKycStatus] = useState<KycStatus>(customer.kycStatus);
  const [form, setForm] = useState({
    fullName: customer.fullName,
    email: customer.email,
    birthDate: customer.birthDate.slice(0, 10),
    address: customer.address,
  });

  useEffect(() => {
    setForm({
      fullName: customer.fullName,
      email: customer.email,
      birthDate: customer.birthDate.slice(0, 10),
      address: customer.address,
    });
    setEditing(false);
    setPhoto(null);
    setKycStatus(customer.kycStatus);
    setError("");
    setMessage("");
  }, [customer.id]);

  async function update(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      onChange(
        await api.updateCustomer(customer.id, {
          version: customer.version,
          ...form,
        }),
      );
      setEditing(false);
      setMessage("Información actualizada correctamente");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "No fue posible actualizar",
      );
    } finally {
      setSaving(false);
    }
  }

  async function updatePhoto() {
    if (!photo) return;
    setSaving(true);
    setError("");
    try {
      onChange(
        await api.updateIdentityDocument(customer.id, customer.version, photo),
      );
      setPhoto(null);
      setMessage("Documento actualizado correctamente");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No fue posible actualizar el documento",
      );
    } finally {
      setSaving(false);
    }
  }

  async function block() {
    if (!window.confirm(`¿Bloquear el acceso de ${customer.fullName}?`)) return;
    setSaving(true);
    setError("");
    try {
      onChange(await api.blockCustomer(customer.id, customer.version));
      setMessage("Usuario bloqueado");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No fue posible bloquear el usuario",
      );
    } finally {
      setSaving(false);
    }
  }

  async function updateKyc() {
    if (kycStatus === customer.kycStatus) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      onChange(
        await api.updateKycStatus(customer.id, {
          version: customer.version,
          kycStatus,
        }),
      );
      setMessage("Estado KYC actualizado correctamente");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No fue posible actualizar el estado KYC",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="customer-detail">
      <div className="customer-detail__heading">
        <div className="avatar avatar--large">
          {initials(customer.fullName)}
        </div>
        <div>
          <span className="overline">{roleLabel(customer.role)}</span>
          <h2>{customer.fullName}</h2>
          <StatusBadge status={customer.status} />
          {customer.role === "CLIENT" && (
            <StatusBadge status={customer.kycStatus} />
          )}
        </div>
      </div>
      {error && <Alert>{error}</Alert>}
      {message && <Alert tone="success">{message}</Alert>}
      {editing ? (
        <form className="detail-form" onSubmit={update}>
          <Field
            label="Nombre"
            value={form.fullName}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                fullName: event.target.value,
              }))
            }
            required
          />
          <Field
            label="Correo"
            type="email"
            value={form.email}
            onChange={(event) =>
              setForm((current) => ({ ...current, email: event.target.value }))
            }
            required
          />
          <Field
            label="Nacimiento"
            type="date"
            value={form.birthDate}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                birthDate: event.target.value,
              }))
            }
            required
          />
          <Field
            label="Dirección"
            value={form.address}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                address: event.target.value,
              }))
            }
            required
          />
          <div className="form-actions">
            <Button
              type="button"
              variant="quiet"
              onClick={() => setEditing(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              Guardar
            </Button>
          </div>
        </form>
      ) : (
        <dl className="detail-list">
          <div>
            <dt>Usuario</dt>
            <dd>{customer.username}</dd>
          </div>
          <div>
            <dt>Documento</dt>
            <dd>{customer.document}</dd>
          </div>
          <div>
            <dt>Correo</dt>
            <dd>{customer.email}</dd>
          </div>
          <div>
            <dt>Nacimiento</dt>
            <dd>{formatDate(customer.birthDate)}</dd>
          </div>
          <div>
            <dt>Dirección</dt>
            <dd>{customer.address}</dd>
          </div>
          <div>
            <dt>Versión</dt>
            <dd>{customer.version}</dd>
          </div>
          {customer.role === "CLIENT" && (
            <div>
              <dt>Estado KYC</dt>
              <dd>{customer.kycStatus}</dd>
            </div>
          )}
        </dl>
      )}
      {customer.role === "CLIENT" && (
        <div className="kyc-panel">
          <div>
            <strong>Validación de identidad (KYC)</strong>
            <small>
              Solo clientes verificados pueden iniciar transferencias o pagos.
            </small>
          </div>
          {canManageKyc ? (
            <>
              <SelectField
                label="Nuevo estado"
                value={kycStatus}
                onChange={(value) => setKycStatus(value as KycStatus)}
              >
                <option value="PENDING">Pendiente</option>
                <option value="VERIFIED">Verificado</option>
                <option value="REJECTED">Rechazado</option>
              </SelectField>
              <Button
                variant="secondary"
                disabled={saving || kycStatus === customer.kycStatus}
                onClick={() => void updateKyc()}
              >
                Actualizar KYC
              </Button>
            </>
          ) : (
            <StatusBadge status={customer.kycStatus} />
          )}
        </div>
      )}
      <div className="document-update">
        <div>
          <strong>Documento de identidad</strong>
          <small>
            {customer.hasIdentityPhoto
              ? "Fotografía registrada"
              : "Sin fotografía"}
          </small>
        </div>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => setPhoto(event.target.files?.[0] ?? null)}
        />
        {photo && (
          <Button
            variant="secondary"
            disabled={saving}
            onClick={() => void updatePhoto()}
          >
            Actualizar fotografía
          </Button>
        )}
      </div>
      <div className="detail-actions">
        {canEdit && !editing && (
          <Button variant="secondary" onClick={() => setEditing(true)}>
            Editar información
          </Button>
        )}
        {canBlock && customer.status !== "BLOCKED" && (
          <Button
            variant="danger"
            disabled={saving}
            onClick={() => void block()}
          >
            Bloquear acceso
          </Button>
        )}
      </div>
    </div>
  );
}

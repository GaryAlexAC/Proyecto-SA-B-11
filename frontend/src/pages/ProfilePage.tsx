import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import type { Customer } from "../types";
import {
  Alert,
  Button,
  Field,
  Loading,
  StatusBadge,
  formatDate,
  initials,
  roleLabel,
} from "../ui";

export function ProfilePage() {
  const { session } = useAuth();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    birthDate: "",
    address: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    api
      .getCustomer(session!.user.customerId)
      .then((data) => {
        if (!active) return;
        setCustomer(data);
        setForm({
          fullName: data.fullName,
          email: data.email,
          birthDate: data.birthDate.slice(0, 10),
          address: data.address,
        });
      })
      .catch(
        (caught: unknown) =>
          active &&
          setError(
            caught instanceof Error
              ? caught.message
              : "No fue posible cargar tu perfil",
          ),
      )
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [session]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!customer) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const updated = await api.updateCustomer(customer.id, {
        version: customer.version,
        ...form,
      });
      setCustomer(updated);
      setMessage("Tu información fue actualizada");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No fue posible actualizar tu perfil",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <span className="overline">Cuenta personal</span>
          <h1>Mi perfil</h1>
          <p>Mantén actualizada tu información de contacto.</p>
        </div>
      </header>
      {loading ? (
        <Loading />
      ) : customer ? (
        <section className="profile-layout">
          <aside className="profile-card">
            <div className="avatar avatar--profile">
              {initials(customer.fullName)}
            </div>
            <h2>{customer.fullName}</h2>
            <p>@{customer.username}</p>
            <StatusBadge status={customer.status} />
            <dl>
              <div>
                <dt>Rol</dt>
                <dd>{roleLabel(customer.role)}</dd>
              </div>
              <div>
                <dt>Documento</dt>
                <dd>{customer.document}</dd>
              </div>
              <div>
                <dt>Miembro desde</dt>
                <dd>{formatDate(customer.createdAt)}</dd>
              </div>
            </dl>
          </aside>
          <form className="content-card profile-form" onSubmit={submit}>
            <div className="section-heading">
              <div>
                <span className="overline">Datos de contacto</span>
                <h2>Información personal</h2>
              </div>
              <span className="version-tag">Versión {customer.version}</span>
            </div>
            {error && <Alert>{error}</Alert>}
            {message && <Alert tone="success">{message}</Alert>}
            <div className="form-grid">
              <Field
                label="Nombre completo"
                value={form.fullName}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    fullName: event.target.value,
                  }))
                }
                minLength={2}
                maxLength={150}
                required
              />
              <Field
                label="Correo electrónico"
                type="email"
                value={form.email}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
                required
              />
              <Field
                label="Fecha de nacimiento"
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
                minLength={3}
                maxLength={300}
                required
              />
            </div>
            <div className="form-actions">
              <Button type="submit" disabled={saving}>
                {saving ? "Guardando cambios..." : "Guardar cambios"}
              </Button>
            </div>
          </form>
        </section>
      ) : (
        <Alert>{error || "No se encontró tu perfil"}</Alert>
      )}
    </div>
  );
}

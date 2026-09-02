import { useDeferredValue, useEffect, useState, type FormEvent } from 'react';
import { ApiError, api } from '../api';
import type { Customer, Role } from '../types';
import { PersonFields, SubmitButton } from './FormFields';

type Notify = (message: string, tone?: 'success' | 'error') => void;

export function CustomerDirectory({ token, role, notify }: { token: string; role: Role; notify: Notify }) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selected, setSelected] = useState<Customer>();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

  async function load() {
    setLoading(true);
    try {
      setCustomers(await api.listCustomers(token));
    } catch (error) {
      notify((error as ApiError).message, 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [token]);

  const visible = customers.filter((customer) => !deferredQuery || `${customer.fullName} ${customer.document} ${customer.username}`.toLowerCase().includes(deferredQuery));

  async function block(customer: Customer) {
    if (!window.confirm(`¿Bloquear a ${customer.fullName}?`)) return;
    setBusy(true);
    try {
      const updated = await api.blockCustomer(customer.id, customer.version, token);
      setCustomers((current) => current.map((item) => item.id === updated.id ? updated : item));
      setSelected(updated);
      notify('Cliente bloqueado correctamente.');
    } catch (error) {
      notify((error as ApiError).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function replaceDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const formElement = event.currentTarget;
    const file = new FormData(formElement).get('identityPhoto');
    if (!(file instanceof File) || file.size === 0) return notify('Selecciona una imagen válida.', 'error');
    setBusy(true);
    try {
      const updated = await api.updateIdentityDocument(selected.id, selected.version, file, token);
      setCustomers((current) => current.map((item) => item.id === updated.id ? updated : item));
      setSelected(updated);
      formElement.reset();
      notify('Documento actualizado correctamente.');
    } catch (error) {
      notify((error as ApiError).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="page-section">
      <div className="section-heading">
        <div><p className="eyebrow">Gestión de clientes</p><h2>Directorio</h2></div>
        <button className="ghost-button" onClick={() => void load()} disabled={loading}>Actualizar</button>
      </div>
      <div className="search-box"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nombre, documento o usuario" /></div>

      <div className="directory-layout">
        <div className="table-card">
          <div className="table-scroll">
            <table>
              <thead><tr><th>Cliente</th><th>Documento</th><th>Estado</th><th>Versión</th></tr></thead>
              <tbody>
                {visible.map((customer) => (
                  <tr key={customer.id} onClick={() => setSelected(customer)} className={selected?.id === customer.id ? 'selected-row' : ''}>
                    <td><strong>{customer.fullName}</strong><small>@{customer.username}</small></td>
                    <td>{customer.document}</td>
                    <td><Status value={customer.status} /></td>
                    <td>v{customer.version}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!loading && visible.length === 0 && <div className="empty-state">No se encontraron clientes.</div>}
          {loading && <div className="empty-state">Consultando clientes…</div>}
        </div>

        <aside className="detail-card">
          {selected ? (
            <>
              <div className="avatar large">{initials(selected.fullName)}</div>
              <h3>{selected.fullName}</h3>
              <p className="muted">{selected.email}</p>
              <dl className="detail-list">
                <div><dt>Dirección</dt><dd>{selected.address}</dd></div>
                <div><dt>Documento</dt><dd>{selected.document}</dd></div>
                <div><dt>Fotografía</dt><dd>{selected.hasIdentityPhoto ? 'Registrada' : 'Pendiente'}</dd></div>
                <div><dt>Estado</dt><dd><Status value={selected.status} /></dd></div>
              </dl>
              <form className="upload-line" onSubmit={replaceDocument}>
                <label>Reemplazar documento<input name="identityPhoto" type="file" accept="image/jpeg,image/png,image/webp" required /></label>
                <button className="secondary-button" disabled={busy}>Actualizar foto</button>
              </form>
              {role === 'ADMIN' && selected.status !== 'BLOCKED' && <button className="danger-button wide" onClick={() => void block(selected)} disabled={busy}>Bloquear cliente</button>}
            </>
          ) : <div className="empty-detail"><span>01</span><p>Selecciona un cliente para consultar su expediente.</p></div>}
        </aside>
      </div>
    </section>
  );
}

export function CreatePerson({ kind, token, notify, onCreated }: { kind: 'client' | 'cashier'; token: string; notify: Notify; onCreated?: () => void }) {
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setBusy(true);
    const form = new FormData(formElement);
    const data = Object.fromEntries([...form.entries()].filter(([, value]) => typeof value === 'string')) as Record<string, string>;
    try {
      if (kind === 'client') {
        const photo = form.get('identityPhoto');
        if (!(photo instanceof File) || photo.size === 0) throw new ApiError('La fotografía del documento es obligatoria.', 400);
        await api.registerCustomer(data, photo, token);
      } else {
        await api.createCashier(data, token);
      }
      formElement.reset();
      notify(kind === 'client' ? 'Cliente registrado. La cuenta queda pendiente de activación.' : 'Cajero creado y activo.');
      onCreated?.();
    } catch (error) {
      notify((error as ApiError).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="page-section narrow-page">
      <div className="section-heading"><div><p className="eyebrow">{kind === 'client' ? 'Alta de cliente' : 'Equipo de atención'}</p><h2>{kind === 'client' ? 'Registrar nuevo cliente' : 'Crear nuevo cajero'}</h2></div></div>
      <div className="form-card">
        <div className="form-intro"><span>{kind === 'client' ? '01' : '02'}</span><p>{kind === 'client' ? 'La cuenta iniciará inactiva. El enlace de activación se envía tras el primer login válido.' : 'El cajero se crea activo y puede registrar clientes inmediatamente.'}</p></div>
        <form onSubmit={submit} className="stack-form">
          <PersonFields />
          {kind === 'client' && <label className="file-drop">Fotografía del documento<input name="identityPhoto" type="file" accept="image/jpeg,image/png,image/webp" required /><small>JPEG, PNG o WebP · máximo 5 MB</small></label>}
          <div className="form-actions"><SubmitButton busy={busy}>{kind === 'client' ? 'Registrar cliente' : 'Crear cajero'}</SubmitButton></div>
        </form>
      </div>
    </section>
  );
}

export function ProfileView({ customer, token, notify, onUpdate }: { customer: Customer; token: string; notify: Notify; onUpdate: (customer: Customer) => void }) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const values = Object.fromEntries(new FormData(event.currentTarget).entries()) as Record<string, string>;
    try {
      const updated = await api.updateCustomer(customer.id, customer.version, values, token);
      onUpdate(updated);
      setEditing(false);
      notify('Perfil actualizado correctamente.');
    } catch (error) {
      notify((error as ApiError).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="page-section narrow-page">
      <div className="section-heading"><div><p className="eyebrow">Identidad digital</p><h2>Mi perfil</h2></div><button className="ghost-button" onClick={() => setEditing((value) => !value)}>{editing ? 'Cancelar' : 'Editar datos'}</button></div>
      <div className="profile-hero">
        <div className="avatar hero-avatar">{initials(customer.fullName)}</div>
        <div><h3>{customer.fullName}</h3><p>@{customer.username} · {roleName(customer.role)}</p></div>
        <Status value={customer.status} />
      </div>
      {editing ? (
        <form onSubmit={submit} className="form-card stack-form">
          <div className="form-grid">
            <label className="span-two">Nombre completo<input name="fullName" defaultValue={customer.fullName} required /></label>
            <label>Correo<input name="email" type="email" defaultValue={customer.email} required /></label>
            <label>Fecha de nacimiento<input name="birthDate" type="date" defaultValue={customer.birthDate.slice(0, 10)} required /></label>
            <label className="span-two">Dirección<input name="address" defaultValue={customer.address} required /></label>
          </div>
          <SubmitButton busy={busy}>Guardar cambios</SubmitButton>
        </form>
      ) : (
        <div className="profile-grid">
          <Info label="Documento" value={customer.document} />
          <Info label="Correo" value={customer.email} />
          <Info label="Nacimiento" value={formatDate(customer.birthDate)} />
          <Info label="Dirección" value={customer.address} />
          <Info label="Documento digital" value={customer.hasIdentityPhoto ? 'Verificado' : 'Sin fotografía'} />
          <Info label="Última actualización" value={formatDate(customer.updatedAt)} />
        </div>
      )}
    </section>
  );
}

export function Status({ value }: { value: string }) {
  return <span className={`status status-${value.toLowerCase()}`}>{value === 'ACTIVE' ? 'Activo' : value === 'INACTIVE' ? 'Pendiente' : 'Bloqueado'}</span>;
}

export function roleName(role: Role) {
  return role === 'ADMIN' ? 'Administrador' : role === 'CASHIER' ? 'Cajero' : 'Cliente';
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="info-tile"><span>{label}</span><strong>{value}</strong></div>;
}

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-GT', { dateStyle: 'medium' }).format(new Date(value));
}

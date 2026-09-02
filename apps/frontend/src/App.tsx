import { startTransition, useEffect, useState } from 'react';
import { ApiError, api } from './api';
import { AccountsView, PaymentsView, TransactionsView } from './components/BankingViews';
import { CreatePerson, CustomerDirectory, ProfileView, Status, roleName } from './components/CustomerViews';
import { LoginPage } from './components/LoginPage';
import type { Customer, Role, Session } from './types';

type View = 'overview' | 'customers' | 'create-client' | 'create-cashier' | 'profile' | 'accounts' | 'transactions' | 'payments';

const menus: Record<Role, Array<{ id: View; label: string; code: string }>> = {
  ADMIN: [
    { id: 'overview', label: 'Resumen', code: '01' },
    { id: 'customers', label: 'Clientes', code: '02' },
    { id: 'create-cashier', label: 'Nuevo cajero', code: '03' },
    { id: 'accounts', label: 'Cuentas', code: '04' },
    { id: 'profile', label: 'Mi perfil', code: '05' },
  ],
  CASHIER: [
    { id: 'overview', label: 'Resumen', code: '01' },
    { id: 'customers', label: 'Clientes', code: '02' },
    { id: 'create-client', label: 'Registrar cliente', code: '03' },
    { id: 'accounts', label: 'Cuentas', code: '04' },
    { id: 'profile', label: 'Mi perfil', code: '05' },
  ],
  CLIENT: [
    { id: 'overview', label: 'Resumen', code: '01' },
    { id: 'profile', label: 'Mi perfil', code: '02' },
    { id: 'accounts', label: 'Mis cuentas', code: '03' },
    { id: 'transactions', label: 'Transferencias', code: '04' },
    { id: 'payments', label: 'Pagos', code: '05' },
  ],
};

export default function App() {
  const [session, setSession] = useState<Session | null>(() => readSession());
  const [profile, setProfile] = useState<Customer>();
  const [view, setView] = useState<View>('overview');
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' }>();

  useEffect(() => {
    if (!session) return;
    void api.getCustomer(session.customer.id, session.accessToken)
      .then(setProfile)
      .catch((error: ApiError) => {
        notify(error.message, 'error');
        if (error.status === 401) logout();
      });
  }, [session?.accessToken, session?.customer.id]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(undefined), 4_000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function login(nextSession: Session) {
    localStorage.setItem('bank-usac-session', JSON.stringify(nextSession));
    setSession(nextSession);
    setView('overview');
  }

  function logout() {
    localStorage.removeItem('bank-usac-session');
    setSession(null);
    setProfile(undefined);
  }

  function navigate(nextView: View) {
    startTransition(() => setView(nextView));
    setMenuOpen(false);
  }

  function notify(message: string, tone: 'success' | 'error' = 'success') {
    setToast({ message, tone });
  }

  if (!session) return <LoginPage onLogin={login} />;

  const role = session.customer.role;
  const menu = menus[role];
  const displayName = profile?.fullName ?? session.customer.username;

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="sidebar-brand"><div className="brand-mark small"><span>B</span></div><div><strong>Bank USAC</strong><small>Banca digital</small></div></div>
        <nav aria-label="Navegación principal">
          <p>Panel de control</p>
          {menu.map((item) => <button key={item.id} className={view === item.id ? 'active' : ''} onClick={() => navigate(item.id)}><span>{item.code}</span>{item.label}</button>)}
        </nav>
        <div className="sidebar-user">
          <div className="avatar">{initials(displayName)}</div>
          <div><strong>{displayName}</strong><small>{roleName(role)}</small></div>
          <button aria-label="Cerrar sesión" title="Cerrar sesión" onClick={logout}>↗</button>
        </div>
      </aside>

      {menuOpen && <button className="menu-backdrop" aria-label="Cerrar menú" onClick={() => setMenuOpen(false)} />}

      <main className="workspace">
        <header className="topbar">
          <button className="menu-button" onClick={() => setMenuOpen(true)} aria-label="Abrir menú">☰</button>
          <div><p>{new Intl.DateTimeFormat('es-GT', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}</p><strong>Portal {roleName(role).toLowerCase()}</strong></div>
          <div className="connection-state"><i /> API Gateway</div>
        </header>

        <div className="workspace-content">
          {view === 'overview' && <Overview profile={profile} role={role} navigate={navigate} />}
          {view === 'customers' && role !== 'CLIENT' && <CustomerDirectory token={session.accessToken} role={role} notify={notify} />}
          {view === 'create-client' && role === 'CASHIER' && <CreatePerson kind="client" token={session.accessToken} notify={notify} onCreated={() => navigate('customers')} />}
          {view === 'create-cashier' && role === 'ADMIN' && <CreatePerson kind="cashier" token={session.accessToken} notify={notify} />}
          {view === 'profile' && profile && <ProfileView customer={profile} token={session.accessToken} notify={notify} onUpdate={setProfile} />}
          {view === 'accounts' && <AccountsView token={session.accessToken} role={role} customerId={session.customer.id} notify={notify} />}
          {view === 'transactions' && role === 'CLIENT' && <TransactionsView token={session.accessToken} customerId={session.customer.id} notify={notify} />}
          {view === 'payments' && role === 'CLIENT' && <PaymentsView token={session.accessToken} notify={notify} />}
        </div>
      </main>

      {toast && <div className={`toast ${toast.tone}`} role="status"><span>{toast.tone === 'success' ? '✓' : '!'}</span>{toast.message}</div>}
    </div>
  );
}

function Overview({ profile, role, navigate }: { profile?: Customer; role: Role; navigate: (view: View) => void }) {
  const actions = role === 'ADMIN'
    ? [{ title: 'Revisar clientes', text: 'Consulta expedientes y bloquea accesos.', view: 'customers' as View }, { title: 'Crear cajero', text: 'Habilita un nuevo usuario de atención.', view: 'create-cashier' as View }]
    : role === 'CASHIER'
      ? [{ title: 'Registrar cliente', text: 'Crea un perfil con documento digital.', view: 'create-client' as View }, { title: 'Consultar clientes', text: 'Revisa información y documentación.', view: 'customers' as View }]
      : [{ title: 'Ver mis cuentas', text: 'Consulta productos y saldos disponibles.', view: 'accounts' as View }, { title: 'Transferir', text: 'Mueve fondos entre cuentas bancarias.', view: 'transactions' as View }];

  return (
    <section className="page-section overview-page">
      <div className="welcome-block">
        <div><p className="eyebrow">Resumen de actividad</p><h1>Hola, {profile?.fullName.split(' ')[0] ?? 'bienvenido'}.</h1><p>Todo lo importante de tu banca, ordenado en un solo lugar.</p></div>
        <div className="welcome-number">{new Date().getFullYear().toString().slice(-2)}</div>
      </div>

      <div className="stat-grid">
        <article><span>Estado del perfil</span><strong>{profile ? <Status value={profile.status} /> : 'Consultando…'}</strong><small>Validado por Customer Service</small></article>
        <article><span>Nivel de acceso</span><strong>{roleName(role)}</strong><small>Permisos asignados al JWT</small></article>
        <article><span>Identidad digital</span><strong>{profile?.hasIdentityPhoto ? 'Completa' : role === 'CLIENT' ? 'Pendiente' : 'Interna'}</strong><small>Documento almacenado de forma segura</small></article>
      </div>

      <div className="overview-grid">
        <div className="quick-actions">
          <div className="section-heading small-heading"><div><p className="eyebrow">Accesos rápidos</p><h2>¿Qué deseas hacer?</h2></div></div>
          {actions.map((action, index) => <button key={action.view} onClick={() => navigate(action.view)}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{action.title}</strong><small>{action.text}</small></div><b>→</b></button>)}
        </div>
        <aside className="security-note"><span>Seguridad</span><h3>Tu sesión está protegida.</h3><p>Cada operación viaja al API Gateway con tu token. Nunca compartas tus credenciales.</p><div><i /> Conexión activa</div></aside>
      </div>
    </section>
  );
}

function readSession(): Session | null {
  try {
    const value = localStorage.getItem('bank-usac-session');
    return value ? JSON.parse(value) as Session : null;
  } catch {
    localStorage.removeItem('bank-usac-session');
    return null;
  }
}

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

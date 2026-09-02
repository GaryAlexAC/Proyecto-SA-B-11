import { useState, type FormEvent } from 'react';
import { ApiError, api } from '../api';
import type { Session } from '../types';

interface LoginPageProps {
  onLogin: (session: Session) => void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      onLogin(await api.login(username, password));
    } catch (cause) {
      const apiError = cause as ApiError;
      setError(apiError.code === 'CUSTOMER_INACTIVE' ? 'Tu cuenta aún no está activa. Revisa el enlace enviado a tu correo.' : apiError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-brand">
        <div className="brand-mark" aria-hidden="true"><span>B</span></div>
        <div className="login-brand-copy">
          <p className="eyebrow light">Banca universitaria desde 2026</p>
          <h1>Tu dinero,<br /><em>bien dirigido.</em></h1>
          <p>Una plataforma clara para cada movimiento, desde la apertura de una cuenta hasta el último centavo transferido.</p>
        </div>
        <div className="trust-row">
          <span>Sesión protegida</span>
          <span>Operaciones trazables</span>
          <span>Bank USAC</span>
        </div>
      </section>

      <section className="login-panel">
        <div className="login-form-wrap">
          <div className="mobile-brand"><div className="brand-mark small"><span>B</span></div><strong>Bank USAC</strong></div>
          <p className="eyebrow">Portal seguro</p>
          <h2>Bienvenido de vuelta</h2>
          <p className="muted">Ingresa con las credenciales asignadas a tu perfil.</p>

          <form onSubmit={submit} className="stack-form">
            <label>
              Usuario
              <input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="tu.usuario" required />
            </label>
            <label>
              Contraseña
              <input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" required />
            </label>
            {error && <div className="form-error" role="alert">{error}</div>}
            <button className="primary-button wide" disabled={loading}>{loading ? 'Verificando…' : 'Ingresar a mi banca'}</button>
          </form>
          <p className="login-help">Los clientes nuevos reciben su enlace de activación después del primer inicio de sesión válido.</p>
        </div>
      </section>
    </main>
  );
}

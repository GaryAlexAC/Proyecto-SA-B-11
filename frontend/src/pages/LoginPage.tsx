import { useState, type FormEvent } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { Alert, Brand, Button, Field, Icon } from "../ui";

export function LoginPage() {
  const { signIn } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      signIn(await api.login(username, password));
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No fue posible iniciar sesión",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-story">
        <Brand />
        <div className="login-story__content">
          <span className="overline">Banca universitaria</span>
          <h1>
            Tu dinero,
            <br />
            en movimiento.
          </h1>
          <p>
            Una plataforma segura para administrar clientes, cuentas y
            operaciones desde un solo lugar.
          </p>
        </div>
        <div className="login-story__footer">
          <Icon name="shield" />
          <span>Sesiones protegidas con autenticación JWT</span>
        </div>
      </section>

      <section className="login-panel">
        <form className="login-form" onSubmit={submit}>
          <div className="login-form__heading">
            <span className="overline">Acceso seguro</span>
            <h2>Bienvenido de vuelta</h2>
            <p>Ingresa tus credenciales para continuar.</p>
          </div>
          {error && <Alert>{error}</Alert>}
          <Field
            label="Usuario"
            name="username"
            autoComplete="username"
            minLength={1}
            maxLength={100}
            placeholder="nombre.apellido.0000"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
          />
          <Field
            label="Contraseña"
            name="password"
            type="password"
            autoComplete="current-password"
            minLength={8}
            maxLength={128}
            placeholder="Tu contraseña"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <Button type="submit" disabled={loading}>
            {loading ? "Validando acceso..." : "Ingresar a mi cuenta"}
            {!loading && <Icon name="arrow" />}
          </Button>
          <p className="login-form__help">
            Si tu cuenta aún no está activa, recibirás un enlace de activación
            en tu correo.
          </p>
        </form>
      </section>
    </main>
  );
}

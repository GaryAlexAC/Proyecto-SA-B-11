import { useEffect, useState } from "react";
import { api } from "../api";
import { Alert, Brand, Button, Icon, Loading } from "../ui";

export function ActivationPage({ token }: { token: string }) {
  const [state, setState] = useState<"loading" | "success" | "error">(
    "loading",
  );
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    api
      .activate(token)
      .then(() => {
        if (active) setState("success");
      })
      .catch((error: unknown) => {
        if (!active) return;
        setMessage(
          error instanceof Error
            ? error.message
            : "No fue posible activar la cuenta",
        );
        setState("error");
      });
    return () => {
      active = false;
    };
  }, [token]);

  function goToLogin() {
    window.history.replaceState({}, "", window.location.pathname);
    window.location.reload();
  }

  return (
    <main className="activation-page">
      <Brand />
      <section className="activation-card">
        {state === "loading" && <Loading label="Activando tu cuenta" />}
        {state === "success" && (
          <>
            <div className="activation-card__icon">
              <Icon name="shield" />
            </div>
            <span className="overline">Activación completada</span>
            <h1>Tu cuenta está lista</h1>
            <p>
              Ya puedes ingresar a Bank USAC con el usuario y contraseña
              asignados.
            </p>
            <Button onClick={goToLogin}>Ir al inicio de sesión</Button>
          </>
        )}
        {state === "error" && (
          <>
            <span className="overline">No se pudo activar</span>
            <h1>Revisa tu enlace</h1>
            <Alert>{message}</Alert>
            <Button variant="secondary" onClick={goToLogin}>
              Volver al inicio
            </Button>
          </>
        )}
      </section>
    </main>
  );
}

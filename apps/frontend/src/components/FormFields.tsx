export function PersonFields({ includePassword = true }: { includePassword?: boolean }) {
  return (
    <div className="form-grid">
      <label className="span-two">Nombre completo<input name="fullName" required maxLength={150} /></label>
      <label>Documento<input name="document" required maxLength={50} /></label>
      <label>Correo electrónico<input name="email" type="email" required maxLength={254} /></label>
      <label>Fecha de nacimiento<input name="birthDate" type="date" required /></label>
      <label>Dirección<input name="address" required maxLength={300} /></label>
      {includePassword && <label className="span-two">Contraseña temporal<input name="password" type="password" required minLength={8} maxLength={72} placeholder="Mayúscula, minúscula y número" /></label>}
    </div>
  );
}

export function SubmitButton({ busy, children }: { busy: boolean; children: string }) {
  return <button className="primary-button" disabled={busy}>{busy ? 'Procesando…' : children}</button>;
}

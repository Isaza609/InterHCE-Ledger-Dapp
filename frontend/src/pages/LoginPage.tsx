export function LoginPage() {
  return (
    <div className="container">
      <div className="card login-card card--elevated">
        <h1 className="page-title" id="login-title">
          Ingreso a InterHCE Ledger
        </h1>
        <p className="page-subtitle">
          Conecte su wallet y seleccione su rol (profesional de salud, administrador
          de IPS, paciente o auditor) para acceder al sistema.
        </p>
        <p className="page-subtitle" style={{ marginTop: "var(--space-4)" }}>
          Flujo de autenticación en desarrollo (conexión de wallet y selección de
          rol/IPS).
        </p>
      </div>
    </div>
  );
}

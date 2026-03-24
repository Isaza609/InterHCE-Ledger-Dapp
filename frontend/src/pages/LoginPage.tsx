import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSesion } from "@/shared/auth/SessionContext";
import { iniciarSesionDapp, cambiarPasswordPropia } from "@/shared/services/api";
import type { SesionUsuario } from "@/shared/auth/sessionStorage";
import heroImage from "../../images/greys Anatomy.jpg";

const DEMOS = [
  {
    title: "Super Administrador",
    context: "Crea IPS y administradores institucionales.",
    correo: "superadmin@interhce.local",
    password: "SuperAdmin001!"
  },
  {
    title: "Profesional de salud",
    context: "Consulta, registra y actualiza episodios de su IPS.",
    correo: "profesional.ips001@interhce.local",
    password: "Profesional001!"
  },
  {
    title: "Administrador IPS",
    context: "Gestiona usuarios y comparte acceso con otras IPS.",
    correo: "admin.ips001@interhce.local",
    password: "AdminIPS001!"
  },
  {
    title: "Auditor",
    context: "Revisa integridad, versiones y evidencia del episodio.",
    correo: "auditor@interhce.local",
    password: "Auditor001!"
  },
  {
    title: "Paciente",
    context: "Accede al entorno con el rol paciente dentro de la plataforma.",
    correo: "paciente@interhce.local",
    password: "Paciente001!"
  }
];

export function LoginPage() {
  const navigate = useNavigate();
  const { iniciarSesion } = useSesion();
  const [identificador, setIdentificador] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [pendienteCambio, setPendienteCambio] = useState(false);
  const [sesionTemporal, setSesionTemporal] = useState<SesionUsuario | null>(null);
  const [passwordUsada, setPasswordUsada] = useState("");
  const [nuevaPassword, setNuevaPassword] = useState("");
  const [confirmarPassword, setConfirmarPassword] = useState("");
  const [cambiandoPassword, setCambiandoPassword] = useState(false);
  const [exitoCambio, setExitoCambio] = useState(false);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!identificador.trim() || !password.trim()) {
      setError("Ingrese su identificación y contraseña para continuar.");
      return;
    }

    setLoading(true);
    setError(null);
    const result = await iniciarSesionDapp({
      correo: identificador.trim(),
      password
    });
    setLoading(false);

    if (!result.ok || !result.session) {
      setError(result.message);
      return;
    }

    if (result.requiereCambioPassword) {
      setSesionTemporal(result.session);
      setPasswordUsada(password);
      setPendienteCambio(true);
      setError(null);
      return;
    }

    iniciarSesion(result.session);
    navigate("/portal");
  };

  const onCambiarPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!nuevaPassword.trim() || nuevaPassword.length < 6) {
      setError("La nueva contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (nuevaPassword !== confirmarPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    if (nuevaPassword === passwordUsada) {
      setError("La nueva contraseña debe ser diferente a la actual.");
      return;
    }

    setCambiandoPassword(true);
    setError(null);
    const result = await cambiarPasswordPropia(passwordUsada, nuevaPassword, sesionTemporal);
    setCambiandoPassword(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    setExitoCambio(true);
  };

  const onContinuarDespuesDeCambio = () => {
    if (sesionTemporal) {
      iniciarSesion(sesionTemporal);
      navigate("/portal");
    }
  };

  const aplicarDemo = (correoDemo: string, passwordDemo: string) => {
    setIdentificador(correoDemo);
    setPassword(passwordDemo);
    setError(null);
    setPendienteCambio(false);
    setSesionTemporal(null);
    setExitoCambio(false);
  };

  if (pendienteCambio && !exitoCambio) {
    return (
      <div className="public-page public-page--narrow">
        <section className="login-page" aria-labelledby="change-pw-title">
          <div className="card card--elevated login-page__card" style={{ maxWidth: "520px", margin: "2rem auto" }}>
            <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
              <span style={{ fontSize: "2.5rem" }}>🔐</span>
            </div>
            <p className="eyebrow">Cambio de contraseña obligatorio</p>
            <h2 id="change-pw-title" className="section-title section-title--large">
              Actualice su contraseña
            </h2>
            <p className="section-copy">
              Su cuenta fue creada con una contraseña temporal. Por seguridad, debe establecer
              una nueva contraseña antes de continuar.
            </p>

            {error && <div className="alert alert--error">{error}</div>}

            <form onSubmit={onCambiarPassword} className="form-section form-section--stacked" noValidate>
              <div className="form-group">
                <label htmlFor="nueva-pw" className="form-label form-label--required">
                  Nueva contraseña
                </label>
                <input
                  id="nueva-pw"
                  className="form-input"
                  type="password"
                  value={nuevaPassword}
                  onChange={(e) => setNuevaPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  autoComplete="new-password"
                  required
                  minLength={6}
                />
              </div>

              <div className="form-group">
                <label htmlFor="confirmar-pw" className="form-label form-label--required">
                  Confirmar contraseña
                </label>
                <input
                  id="confirmar-pw"
                  className="form-input"
                  type="password"
                  value={confirmarPassword}
                  onChange={(e) => setConfirmarPassword(e.target.value)}
                  placeholder="Repita la nueva contraseña"
                  autoComplete="new-password"
                  required
                />
              </div>

              <button
                className="btn btn--primary btn--block"
                type="submit"
                disabled={cambiandoPassword}
              >
                {cambiandoPassword ? "Actualizando..." : "Establecer nueva contraseña"}
              </button>
            </form>
          </div>
        </section>
      </div>
    );
  }

  if (exitoCambio) {
    return (
      <div className="public-page public-page--narrow">
        <section className="login-page">
          <div className="card card--elevated" style={{ maxWidth: "520px", margin: "2rem auto", textAlign: "center" }}>
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>✅</div>
            <h2 className="section-title section-title--large">Contraseña actualizada</h2>
            <p className="section-copy">
              Su contraseña fue cambiada exitosamente. Ahora puede acceder a la plataforma
              con sus nuevas credenciales.
            </p>
            <button
              className="btn btn--primary btn--block"
              onClick={onContinuarDespuesDeCambio}
              style={{ marginTop: "1.5rem" }}
            >
              Continuar al portal
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="public-page public-page--narrow">
      <section className="login-page" aria-labelledby="login-title">
        <div className="login-page__intro">
          <div className="login-page__visual">
            <img
              src={heroImage}
              alt="Profesionales de salud coordinando la continuidad de la atención"
            />
          </div>
          <div className="login-page__copy">
            <p className="eyebrow">Acceso institucional</p>
            <h1 id="login-title" className="page-title">
              Ingreso seguro a la plataforma
            </h1>
            <p className="page-subtitle">
              Acceda con sus credenciales institucionales para entrar a una experiencia ajustada a
              su rol, su IPS y las tareas de su jornada clínica.
            </p>
            <div className="stack-list">
              <div className="stack-item">
                <strong>Ingreso flexible</strong>
                <span>Puede ingresar con su correo institucional, ID de usuario o documento de identidad.</span>
              </div>
              <div className="stack-item">
                <strong>Acceso controlado</strong>
                <span>La consulta de episodios y documentos sigue reglas de autorización trazables.</span>
              </div>
              <div className="stack-item">
                <strong>Soporte institucional</strong>
                <span>Si requiere acompañamiento, puede volver a la landing y revisar servicios o contacto.</span>
              </div>
            </div>
            <Link to="/" className="btn btn--ghost">
              Volver a la página principal
            </Link>
          </div>
        </div>

        <div className="card card--elevated login-page__card">
          <p className="eyebrow">Inicio de sesión</p>
          <h2 className="section-title section-title--large">Entrar a mi entorno de trabajo</h2>
          <p className="section-copy">
            Use su correo institucional, ID de usuario o documento de identidad para ingresar.
          </p>

          {error && <div className="alert alert--error">{error}</div>}

          <form onSubmit={onSubmit} className="form-section form-section--stacked" noValidate>
            <div className="form-group">
              <label htmlFor="identificador" className="form-label form-label--required">
                Correo, usuario o documento
              </label>
              <input
                id="identificador"
                className="form-input"
                type="text"
                value={identificador}
                onChange={(e) => setIdentificador(e.target.value)}
                placeholder="correo@interhce.local, usuario-id o documento"
                autoComplete="username"
                required
              />
              <span className="form-hint">
                Puede usar cualquiera de sus identificadores registrados.
              </span>
            </div>

            <div className="form-group">
              <label htmlFor="password" className="form-label form-label--required">
                Contraseña
              </label>
              <input
                id="password"
                className="form-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Ingrese su contraseña"
                autoComplete="current-password"
                required
              />
            </div>

            <button className="btn btn--primary btn--block" type="submit" disabled={loading}>
              {loading ? "Validando acceso..." : "Ingresar"}
            </button>
          </form>

          <div className="login-demo-panel">
            <div className="section-head section-head--tight">
              <div>
                <h3 className="section-title">Accesos de demostración</h3>
                <p className="section-copy">Disponibles para validación funcional del entorno.</p>
              </div>
            </div>
            <div className="role-preview-grid">
              {DEMOS.map((item) => (
                <article key={item.correo} className="role-preview-card">
                  <strong>{item.title}</strong>
                  <p>{item.context}</p>
                  <code>{item.correo}</code>
                  <code>{item.password}</code>
                  <button
                    type="button"
                    className="btn btn--secondary"
                    onClick={() => aplicarDemo(item.correo, item.password)}
                  >
                    Usar este acceso
                  </button>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

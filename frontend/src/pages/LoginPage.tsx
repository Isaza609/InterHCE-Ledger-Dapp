import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSesion } from "@/shared/auth/SessionContext";
import { iniciarSesionDapp } from "@/shared/services/api";
import heroImage from "../../images/greys Anatomy.jpg";

const DEMOS = [
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
  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [usuarioId, setUsuarioId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!correo.trim() || !password.trim()) {
      setError("Ingrese correo y contraseña para continuar.");
      return;
    }

    setLoading(true);
    setError(null);
    const result = await iniciarSesionDapp({
      correo: correo.trim(),
      password,
      usuarioId: usuarioId.trim() || undefined
    });
    setLoading(false);

    if (!result.ok || !result.session) {
      setError(result.message);
      return;
    }

    iniciarSesion(result.session);
    navigate("/portal");
  };

  const aplicarDemo = (correoDemo: string, passwordDemo: string) => {
    setCorreo(correoDemo);
    setPassword(passwordDemo);
    setUsuarioId("");
    setError(null);
  };

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
                <strong>Ingreso por perfil</strong>
                <span>La plataforma identifica permisos y capacidades después de autenticarse.</span>
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
            Use su correo institucional. Si su organización maneja un identificador interno, puede
            agregarlo como apoyo.
          </p>

          {error && <div className="alert alert--error">{error}</div>}

          <form onSubmit={onSubmit} className="form-section form-section--stacked" noValidate>
            <div className="form-group">
              <label htmlFor="correo" className="form-label form-label--required">
                Correo institucional
              </label>
              <input
                id="correo"
                className="form-input"
                type="email"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                placeholder="nombre@interhce.local"
                autoComplete="username"
                required
              />
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

            <div className="form-group">
              <label htmlFor="usuarioId" className="form-label">
                Usuario interno
              </label>
              <input
                id="usuarioId"
                className="form-input"
                type="text"
                value={usuarioId}
                onChange={(e) => setUsuarioId(e.target.value)}
                placeholder="Opcional"
              />
              <span className="form-hint">
                Úselo solo si su organización requiere un identificador adicional.
              </span>
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

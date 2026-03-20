import { Link } from "react-router-dom";
import heroImage from "../../images/greys Anatomy.jpg";

const FUNCTIONALITIES = [
  {
    title: "Continuidad clínica entre instituciones",
    description:
      "Consulte episodios, continúe la atención y reduzca reprocesos cuando un paciente se mueve entre IPS."
  },
  {
    title: "Control de accesos por episodio",
    description:
      "Otorgue o revoque acceso de forma puntual, con claridad sobre qué institución puede consultar cada caso."
  },
  {
    title: "Trazabilidad verificable",
    description:
      "Cada creación, actualización y cambio de permisos queda respaldado con evidencia auditable."
  },
  {
    title: "Integridad documental comprobable",
    description:
      "Compare el hash del documento con su evidencia registrada sin exponer datos clínicos sensibles."
  }
];

const SERVICES = [
  {
    title: "Portal clínico por rol",
    description:
      "La plataforma ajusta la experiencia según el perfil operativo para mostrar solo acciones relevantes."
  },
  {
    title: "Gestión de episodios de urgencias",
    description:
      "Cree, actualice y consulte episodios con estructura clara, formularios guiados y validación consistente."
  },
  {
    title: "Auditoría y verificación institucional",
    description:
      "Auditoría, integridad e historial de permisos disponibles en una vista comprensible para equipos no técnicos."
  }
];

const TRUST_SIGNALS = [
  "Modelo clínico validado y control de acceso por sesión autenticada.",
  "Trazabilidad respaldada por evidencia blockchain y almacenamiento clínico off-chain.",
  "Diseño orientado a confianza, claridad operativa y continuidad asistencial."
];

const PROFILE_ACCESS = [
  {
    title: "Profesional de salud",
    description: "Consulta, registra y actualiza episodios desde una jornada clínica simple."
  },
  {
    title: "Administrador IPS",
    description: "Gestiona usuarios, permisos interinstitucionales y continuidad del acceso."
  },
  {
    title: "Auditor",
    description: "Revisa integridad, historial de versiones y evidencia de trazabilidad."
  },
  {
    title: "Paciente o actor consultivo",
    description: "Accede a vistas controladas según el modelo de autorización definido."
  }
];

export function HomePage() {
  return (
    <div className="public-page" id="inicio">
      <section className="landing-hero" aria-labelledby="landing-hero-title">
        <div className="landing-hero__content">
          <p className="eyebrow">Plataforma institucional de interoperabilidad clínica</p>
          <h1 id="landing-hero-title" className="landing-hero__title">
            Información clínica conectada, segura y lista para continuar la atención
          </h1>
          <p className="landing-hero__description">
            InterHCE Clínica integra continuidad asistencial, trazabilidad y control de acceso
            en una experiencia confiable para instituciones de salud que necesitan compartir
            información sin perder contexto ni gobernanza.
          </p>
          <div className="landing-hero__actions">
            <a href="#servicios" className="btn btn--primary">
              Conocer servicios
            </a>
            <a href="#nosotros" className="btn btn--secondary">
              Ver enfoque institucional
            </a>
            <Link to="/login" className="btn btn--ghost">
              Iniciar sesión
            </Link>
          </div>
          <div className="landing-hero__metrics">
            <article className="landing-metric">
              <strong>Continuidad entre IPS</strong>
              <span>Acceso controlado a episodios y contexto clínico para atención oportuna.</span>
            </article>
            <article className="landing-metric">
              <strong>Seguridad y evidencia</strong>
              <span>Integridad verificable, permisos por episodio y trazabilidad completa.</span>
            </article>
            <article className="landing-metric">
              <strong>Experiencia operativa</strong>
              <span>Flujos claros para perfiles clínicos, administrativos y de auditoría.</span>
            </article>
          </div>
        </div>

        <div className="landing-hero__visual">
          <img
            src={heroImage}
            alt="Equipo clínico colaborando alrededor de la atención de un paciente"
          />
          <div className="landing-hero__panel">
            <p className="eyebrow">Preparada para operación real</p>
            <h2>Una sola plataforma para consultar, compartir y verificar información clínica</h2>
            <ul className="feature-list">
              <li>Acceso institucional por perfil y por IPS.</li>
              <li>Permisos específicos por episodio para continuidad asistencial.</li>
              <li>Auditoría clara de versiones, eventos y evidencia.</li>
            </ul>
          </div>
        </div>
      </section>

      <section id="servicios" className="landing-section">
        <div className="section-head">
          <div>
            <p className="eyebrow">Servicios</p>
            <h2 className="section-title section-title--large">
              Funcionalidades diseñadas para la operación clínica
            </h2>
            <p className="section-copy">
              La plataforma acompaña el ciclo completo del episodio clínico y la coordinación entre
              instituciones.
            </p>
          </div>
        </div>

        <div className="landing-grid landing-grid--four">
          {FUNCTIONALITIES.map((item) => (
            <article key={item.title} className="institution-card">
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>

        <div className="services__grid landing-grid--offset">
          {SERVICES.map((item) => (
            <article key={item.title} className="service-card service-card--featured">
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="nosotros" className="landing-section">
        <div className="institution-panel">
          <div className="institution-panel__copy">
            <p className="eyebrow">Nosotros</p>
            <h2 className="section-title section-title--large">
              Tecnología clínica pensada para confianza institucional
            </h2>
            <p className="section-copy">
              InterHCE Clínica fue planteada para entornos donde la interoperabilidad no solo debe
              funcionar, sino demostrar control, trazabilidad y claridad frente a múltiples actores.
            </p>
            <ul className="feature-list">
              {TRUST_SIGNALS.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="institution-panel__aside">
            <div className="trust-card">
              <strong>Confianza institucional</strong>
              <span>Accesibilidad, contraste, lenguaje claro y acciones distinguibles.</span>
            </div>
            <div className="trust-card">
              <strong>Gobernanza del dato</strong>
              <span>Documento off-chain y evidencia trazable sin exponer información sensible.</span>
            </div>
            <div className="trust-card">
              <strong>Preparación multirol</strong>
              <span>Experiencias diferenciadas para clínica, gestión operativa y auditoría.</span>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-section">
        <div className="section-head">
          <div>
            <p className="eyebrow">Acceso por perfiles</p>
            <h2 className="section-title section-title--large">
              Cada usuario encuentra una experiencia acorde a su responsabilidad
            </h2>
          </div>
        </div>
        <div className="profile-grid">
          {PROFILE_ACCESS.map((item) => (
            <article key={item.title} className="profile-card">
              <strong>{item.title}</strong>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="contacto" className="landing-section">
        <div className="contact-band">
          <div>
            <p className="eyebrow">Contacto</p>
            <h2 className="section-title section-title--large">
              Coordine una adopción institucional o ingrese a su entorno operativo
            </h2>
            <p className="section-copy">
              Equipos clínicos, administrativos y de auditoría pueden acceder con su perfil
              institucional y operar sobre una misma base de confianza.
            </p>
          </div>
          <div className="contact-band__actions">
            <a href="mailto:contacto@interhce.local" className="btn btn--secondary">
              contacto@interhce.local
            </a>
            <Link to="/login" className="btn btn--primary">
              Ir al acceso institucional
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

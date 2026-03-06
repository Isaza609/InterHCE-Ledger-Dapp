import { Link } from "react-router-dom";

export function HomePage() {
  return (
    <div className="container">
      <section className="hero" aria-labelledby="hero-title">
        <h1 id="hero-title" className="hero__title">
          InterHCE Ledger
        </h1>
        <p className="hero__description">
          Plataforma de interoperabilidad de Historias Clínicas Electrónicas (HCE)
          para el escenario de urgencias. Información trazable, segura y disponible
          entre Instituciones Prestadoras de Salud (IPS) cuando más se necesita.
        </p>
        <div className="hero__actions">
          <Link to="/episodios" className="btn btn--primary">
            Ver episodios
          </Link>
          <Link to="/episodios/crear" className="btn btn--secondary">
            Crear episodio clínico
          </Link>
          <Link to="/login" className="btn btn--secondary">
            Ingresar
          </Link>
        </div>
      </section>
    </div>
  );
}

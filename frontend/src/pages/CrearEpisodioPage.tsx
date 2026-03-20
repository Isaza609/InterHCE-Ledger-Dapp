import { Link } from "react-router-dom";
import { FormularioEpisodio } from "@/features/episodios/components/FormularioEpisodio";
import { useValidarEpisodio } from "@/features/episodios/hooks/useValidarEpisodio";
import { buildEpisodioPayload } from "@/shared/utils/episodioPayload";
import type { EpisodioPayload } from "@/shared/types/episodio";
import { useSesion } from "@/shared/auth/SessionContext";

export function CrearEpisodioPage() {
  const { sesion } = useSesion();
  const { result, loading, validar, registrar } = useValidarEpisodio();

  const safeValidar = (p: EpisodioPayload) => validar(buildEpisodioPayload(p));
  const safeRegistrar = (p: EpisodioPayload) => registrar(buildEpisodioPayload(p));

  return (
    <div className="container">
      <nav aria-label="Migas de pan" className="breadcrumb">
        <Link to="/">Inicio</Link>
        {" / "}
        <Link to="/episodios">Episodios</Link>
        {" / Crear"}
      </nav>
      <section className="page-banner page-banner--compact">
        <div>
          <p className="eyebrow">Nuevo episodio</p>
          <h1 className="page-title">Registrar atención de urgencias</h1>
          <p className="page-subtitle">
            Complete la información clínica esencial. El sistema validará la estructura, generará
            el documento off-chain y dejará trazabilidad verificable del registro.
          </p>
        </div>
        <div className="context-note">
          <strong>Sesión activa</strong>
          <span>{sesion?.nombre ?? "Sin sesión"}</span>
          <small>{sesion?.ipsId ?? "Debe autenticarse para registrar"}</small>
        </div>
      </section>

      <div className="card card--elevated">
        <FormularioEpisodio
          onValidar={safeValidar}
          onRegistrar={safeRegistrar}
          result={result}
          loading={loading}
        />
      </div>
    </div>
  );
}

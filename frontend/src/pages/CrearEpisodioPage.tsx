import { Link } from "react-router-dom";
import { FormularioEpisodio } from "@/features/episodios/components/FormularioEpisodio";
import { useValidarEpisodio } from "@/features/episodios/hooks/useValidarEpisodio";
import { buildEpisodioPayload } from "@/shared/utils/episodioPayload";
import type { EpisodioPayload } from "@/shared/types/episodio";

export function CrearEpisodioPage() {
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
      <h1 className="page-title">Crear episodio clínico (urgencias)</h1>
      <p className="page-subtitle">
        Complete los datos según el modelo mínimo de HCE para urgencias. Use
        &quot;Validar&quot; para comprobar contra el backend o &quot;Registrar&quot; para
        enviar el episodio.
      </p>

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

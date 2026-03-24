import { Link } from "react-router-dom";
import { FormularioEpisodio } from "@/features/episodios/components/FormularioEpisodio";
import { useValidarEpisodio } from "@/features/episodios/hooks/useValidarEpisodio";
import { buildEpisodioPayload } from "@/shared/utils/episodioPayload";
import type { EpisodioPayload } from "@/shared/types/episodio";
import { useSesion } from "@/shared/auth/SessionContext";

export function CrearEpisodioPage() {
  const { sesion } = useSesion();
  const { result, loading, validar, registrar } = useValidarEpisodio(sesion);

  const safeValidar = (p: EpisodioPayload) => validar(buildEpisodioPayload(p));
  const safeRegistrar = (p: EpisodioPayload) => registrar(buildEpisodioPayload(p));

  return (
    <>
      <nav aria-label="Migas de pan" className="breadcrumb">
        <Link to="/portal">Panel</Link>{" / "}
        <Link to="/episodios">Episodios</Link>{" / Crear"}
      </nav>

      <div className="page-header">
        <div className="page-header__row">
          <div>
            <h1 className="page-title">Registrar episodio</h1>
            <p className="page-subtitle">
              Complete la información clínica. El sistema validará la estructura y dejará trazabilidad verificable.
            </p>
          </div>
          <div className="context-note">
            <strong>{sesion?.nombre ?? "Sin sesión"}</strong>
            <small>{sesion?.ipsId ?? "Autentíquese para registrar"}</small>
          </div>
        </div>
      </div>

      <div className="card card--elevated">
        <FormularioEpisodio
          onValidar={safeValidar}
          onRegistrar={safeRegistrar}
          result={result}
          loading={loading}
        />
      </div>
    </>
  );
}

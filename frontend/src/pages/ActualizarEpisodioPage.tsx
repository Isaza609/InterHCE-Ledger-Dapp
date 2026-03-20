import { useState } from "react";
import { Link } from "react-router-dom";
import { FormularioEpisodio } from "@/features/episodios/components/FormularioEpisodio";
import { buildEpisodioPayload } from "@/shared/utils/episodioPayload";
import { actualizarEpisodio, validarEpisodio } from "@/shared/services/api";
import type { EpisodioPayload, ValidationResult } from "@/shared/types/episodio";
import { useSesion } from "@/shared/auth/SessionContext";

export function ActualizarEpisodioPage() {
  const { sesion } = useSesion();
  const [episodeId, setEpisodeId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ValidationResult | null>(null);

  const onValidar = async (payload: EpisodioPayload) => {
    setLoading(true);
    const valid = await validarEpisodio(buildEpisodioPayload(payload));
    setResult(valid);
    setLoading(false);
  };

  const onActualizar = async (payload: EpisodioPayload) => {
    const id = episodeId.trim();
    if (!id) {
      setResult({
        valid: false,
        message: "Debe indicar el ID del episodio a actualizar.",
        details: []
      });
      return;
    }
    setLoading(true);
    const updated = await actualizarEpisodio(id, buildEpisodioPayload(payload));
    setResult(updated);
    setLoading(false);
  };

  return (
    <div className="container">
      <nav aria-label="Migas de pan" className="breadcrumb">
        <Link to="/">Inicio</Link>
        {" / "}
        <Link to="/episodios">Episodios</Link>
        {" / Actualizar"}
      </nav>
      <section className="page-banner page-banner--compact">
        <div>
          <p className="eyebrow">Seguimiento clínico</p>
          <h1 className="page-title">Actualizar episodio</h1>
          <p className="page-subtitle">
            Registre cambios de evolución o cierre de atención. Cada actualización conserva el
            historial previo y genera nueva evidencia de trazabilidad.
          </p>
        </div>
        <div className="context-note">
          <strong>Sesión activa</strong>
          <span>{sesion?.nombre ?? "Sin sesión"}</span>
          <small>{sesion?.ipsId ?? "Debe autenticarse para actualizar"}</small>
        </div>
      </section>

      <div className="card card--elevated" style={{ marginBottom: "1rem" }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label htmlFor="episode-id" className="form-label form-label--required">
            ID del episodio a actualizar
          </label>
          <input
            id="episode-id"
            className="form-input"
            type="text"
            value={episodeId}
            onChange={(e) => setEpisodeId(e.target.value)}
            placeholder="UUID del episodio"
          />
          <span className="form-hint">
            Puede obtenerlo desde la lista de episodios o desde el resultado del registro inicial.
          </span>
        </div>
      </div>

      <div className="card card--elevated">
        <FormularioEpisodio
          onValidar={onValidar}
          onRegistrar={onActualizar}
          loading={loading}
          result={result}
          actionLabel="Actualizar episodio"
        />
      </div>
    </div>
  );
}

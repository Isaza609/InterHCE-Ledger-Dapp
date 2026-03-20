import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useSesion } from "@/shared/auth/SessionContext";
import { sesionTieneCapacidad } from "@/shared/auth/capabilities";
import { buscarEpisodiosPorPaciente, listarTodosLosEpisodios } from "@/shared/services/api";
import type { EpisodioResumen } from "@/shared/services/api";

function EpisodioList({
  episodios,
  titulo,
  description,
  emptyMessage,
  canViewDocument,
  canViewTrace,
  canUpdateEpisode
}: {
  episodios: EpisodioResumen[];
  titulo: string;
  description?: string;
  emptyMessage: string;
  canViewDocument: boolean;
  canViewTrace: boolean;
  canUpdateEpisode: boolean;
}) {
  return (
    <section className="card card--elevated">
      <div className="section-head section-head--tight">
        <div>
          <h2 className="section-title">{titulo}</h2>
          {description && <p className="section-copy">{description}</p>}
        </div>
      </div>
      {episodios.length === 0 ? (
        <p className="empty-state">{emptyMessage}</p>
      ) : (
        <div className="episode-list">
          {episodios.map((ep) => (
            <article key={ep.episodeId} className="episode-card">
              <div>
                <strong>{ep.patientName || "Paciente sin nombre"}</strong>
                <p>
                  <code>{ep.episodeId}</code>
                </p>
                <small>
                  {ep.patientIdentifier ?? "Documento no disponible"} · {ep.prestadorOrigenId ?? "IPS no disponible"}
                </small>
                {ep.documentHash && (
                  <small>
                    Hash actual: <code>{ep.documentHash}</code>
                  </small>
                )}
              </div>
              {(canViewDocument || canViewTrace || canUpdateEpisode) && (
                <div className="btn-group">
                  {canViewDocument && (
                    <Link to={`/episodios/ver/${ep.episodeId}`} className="btn btn--secondary">
                      Consultar
                    </Link>
                  )}
                  {canUpdateEpisode && (
                    <Link to="/episodios/actualizar" className="btn btn--ghost">
                      Actualizar
                    </Link>
                  )}
                  {canViewTrace && (
                    <Link to="/episodios/trazabilidad" className="btn btn--ghost">
                      Trazabilidad
                    </Link>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export function EpisodiosPage() {
  const { sesion } = useSesion();
  const [searchParams] = useSearchParams();
  const initialPatient = searchParams.get("patient") ?? "";
  const [documentoPaciente, setDocumentoPaciente] = useState(initialPatient);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingAll, setLoadingAll] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<EpisodioResumen[]>([]);
  const [allEpisodes, setAllEpisodes] = useState<EpisodioResumen[]>([]);
  const canCreateEpisode = sesionTieneCapacidad(sesion, "episodios.crear");
  const canUpdateEpisode = sesionTieneCapacidad(sesion, "episodios.actualizar");
  const canViewDocument = sesionTieneCapacidad(sesion, "episodios.documento.ver");
  const canViewTrace = sesionTieneCapacidad(sesion, "trazabilidad.consultar") || sesion?.rol === "admin_ips";

  const cargarTodos = async () => {
    setLoadingAll(true);
    try {
      const { episodes } = await listarTodosLosEpisodios(sesion);
      setAllEpisodes(episodes);
    } catch {
      setAllEpisodes([]);
    } finally {
      setLoadingAll(false);
    }
  };

  useEffect(() => {
    let active = true;

    listarTodosLosEpisodios(sesion)
      .then(({ episodes }) => {
        if (!active) return;
        setAllEpisodes(episodes);
      })
      .catch(() => {
        if (!active) return;
        setAllEpisodes([]);
      })
      .finally(() => {
        if (active) setLoadingAll(false);
      });

    return () => {
      active = false;
    };
  }, [sesion]);

  useEffect(() => {
    if (!initialPatient.trim()) return;
    setDocumentoPaciente(initialPatient);
    void (async () => {
      setLoadingSearch(true);
      const { episodes, message: backendMessage } = await buscarEpisodiosPorPaciente(initialPatient, sesion);
      setSearchResults(episodes);
      setMessage(backendMessage || null);
      setLoadingSearch(false);
    })();
  }, [initialPatient, sesion]);

  const handleBuscar = async () => {
    const value = documentoPaciente.trim();
    if (!value) {
      setMessage("Ingrese el documento del paciente para filtrar los episodios.");
      setSearchResults([]);
      return;
    }
    setLoadingSearch(true);
    setMessage(null);
    try {
      const { episodes, message: backendMessage } = await buscarEpisodiosPorPaciente(value, sesion);
      setSearchResults(episodes);
      setMessage(backendMessage || (episodes.length ? "Episodios encontrados." : "No se encontraron episodios."));
    } catch {
      setMessage("No fue posible buscar episodios en este momento.");
      setSearchResults([]);
    } finally {
      setLoadingSearch(false);
    }
  };

  return (
    <div className="container">
      <section className="page-banner">
        <div>
          <p className="eyebrow">Continuidad asistencial</p>
          <h1 className="page-title">Pacientes y episodios</h1>
          <p className="page-subtitle">
            Encuentre rápidamente el episodio correcto, consulte su documento y continúe el flujo
            de atención o auditoría.
          </p>
        </div>
        <div className="page-banner__actions">
          {canCreateEpisode && (
            <Link to="/episodios/crear" className="btn btn--primary">
              Nuevo episodio
            </Link>
          )}
          {canUpdateEpisode && (
            <Link to="/episodios/actualizar" className="btn btn--secondary">
              Actualizar episodio
            </Link>
          )}
        </div>
      </section>

      <section className="card card--elevated" style={{ marginBottom: "1rem" }}>
        <div className="section-head section-head--tight">
          <div>
            <h2 className="section-title">Buscar por documento del paciente</h2>
            <p className="section-copy">
              Use el mismo identificador con el que se registró el episodio clínico.
            </p>
          </div>
        </div>
        <div className="search-layout">
          <div className="form-group">
            <label htmlFor="buscar-cedula" className="form-label">
              Documento del paciente
            </label>
            <input
              id="buscar-cedula"
              type="text"
              className="form-input"
              placeholder="Ej. 12345678"
              value={documentoPaciente}
              onChange={(e) => setDocumentoPaciente(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void handleBuscar()}
            />
          </div>
          <div className="btn-group">
            <button type="button" className="btn btn--primary" onClick={handleBuscar} disabled={loadingSearch}>
              {loadingSearch ? "Buscando..." : "Buscar episodio"}
            </button>
            <button type="button" className="btn btn--ghost" onClick={cargarTodos} disabled={loadingAll}>
              {loadingAll ? "Actualizando..." : "Actualizar listado"}
            </button>
          </div>
        </div>
        {message && (
          <div className={searchResults.length ? "alert alert--success" : "alert alert--info"} style={{ marginTop: "1rem" }}>
            {message}
          </div>
        )}
      </section>

      {searchResults.length > 0 && (
        <div style={{ marginBottom: "1rem" }}>
          <EpisodioList
            episodios={searchResults}
            titulo="Resultado de búsqueda"
            description="Estos episodios coinciden con el documento ingresado."
            emptyMessage="No se encontraron episodios para este paciente."
            canViewDocument={canViewDocument}
            canViewTrace={canViewTrace}
            canUpdateEpisode={canUpdateEpisode}
          />
        </div>
      )}

      <EpisodioList
        episodios={allEpisodes}
        titulo={`Todos los episodios disponibles (${allEpisodes.length})`}
        description="Listado general visible según su sesión actual."
        emptyMessage={loadingAll ? "Cargando episodios..." : "Todavía no hay episodios registrados."}
        canViewDocument={canViewDocument}
        canViewTrace={canViewTrace}
        canUpdateEpisode={canUpdateEpisode}
      />
    </div>
  );
}

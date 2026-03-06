import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { buscarEpisodiosPorPaciente, listarTodosLosEpisodios } from "@/shared/services/api";
import type { EpisodioResumen } from "@/shared/services/api";

function ListaEpisodios({
  episodios,
  titulo,
  emptyMessage
}: {
  episodios: EpisodioResumen[];
  titulo: string;
  emptyMessage?: string;
}) {
  if (episodios.length === 0) {
    return (
      <section aria-label={titulo || "Lista de episodios"}>
        {titulo && <h2 style={{ fontSize: "1.1rem", marginBottom: "0.75rem" }}>{titulo}</h2>}
        <p style={{ margin: 0, color: "var(--text-2, #666)" }}>{emptyMessage ?? "Ningún episodio."}</p>
      </section>
    );
  }
  return (
    <section aria-label={titulo || "Lista de episodios"}>
      {titulo && <h2 style={{ fontSize: "1.1rem", marginBottom: "0.75rem" }}>{titulo}</h2>}
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {episodios.map((ep) => (
          <li
            key={ep.episodeId}
            style={{
              padding: "0.75rem",
              marginBottom: "0.5rem",
              background: "var(--surface-2, #f5f5f5)",
              borderRadius: "6px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "0.5rem"
            }}
          >
            <code style={{ wordBreak: "break-all", fontSize: "0.9rem" }}>{ep.episodeId}</code>
            <Link
              to={`/episodios/ver/${ep.episodeId}`}
              className="btn btn--secondary"
              style={{ flexShrink: 0 }}
            >
              Ver documento
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function EpisodiosPage() {
  const [cedula, setCedula] = useState("");
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingAll, setLoadingAll] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<EpisodioResumen[]>([]);
  const [todosLosEpisodios, setTodosLosEpisodios] = useState<EpisodioResumen[]>([]);

  useEffect(() => {
    let cancelled = false;
    listarTodosLosEpisodios()
      .then(({ episodes }) => {
        if (!cancelled) setTodosLosEpisodios(episodes);
      })
      .catch(() => {
        if (!cancelled) setTodosLosEpisodios([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingAll(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleBuscar = async () => {
    const value = cedula.trim();
    if (!value) {
      setMessage("Indique el número de documento (cédula) del paciente.");
      setSearchResults([]);
      return;
    }
    setLoadingSearch(true);
    setMessage(null);
    setSearchResults([]);
    try {
      const { episodes: list, message: msg } = await buscarEpisodiosPorPaciente(value);
      setSearchResults(list);
      setMessage(msg);
    } catch {
      setMessage("Error al buscar. Compruebe la conexión con el backend.");
    } finally {
      setLoadingSearch(false);
    }
  };

  const handleRefrescarTodos = async () => {
    setLoadingAll(true);
    try {
      const { episodes } = await listarTodosLosEpisodios();
      setTodosLosEpisodios(episodes);
    } catch {
      setTodosLosEpisodios([]);
    } finally {
      setLoadingAll(false);
    }
  };

  return (
    <div className="container">
      <h1 className="page-title">Episodios clínicos</h1>
      <p className="page-subtitle">
        Busque por documento del paciente, vea todos los episodios o cree uno nuevo.
      </p>

      <div className="episodios-actions" style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "flex-end", marginBottom: "1.5rem" }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label htmlFor="buscar-cedula" className="form-label">
            Documento del paciente (cédula)
          </label>
          <input
            id="buscar-cedula"
            type="text"
            className="form-input"
            placeholder="Ej. 12345678"
            value={cedula}
            onChange={(e) => setCedula(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleBuscar()}
            aria-describedby="buscar-ayuda"
          />
          <span id="buscar-ayuda" className="form-hint" style={{ fontSize: "0.85rem", marginTop: "0.25rem" }}>
            Mismo valor que el &quot;Identificador&quot; al registrar el episodio.
          </span>
        </div>
        <button
          type="button"
          className="btn btn--secondary"
          onClick={handleBuscar}
          disabled={loadingSearch}
          aria-busy={loadingSearch}
        >
          {loadingSearch ? "Buscando…" : "Buscar por cédula"}
        </button>
        <Link to="/episodios/crear" className="btn btn--primary">
          Crear nuevo episodio
        </Link>
      </div>

      {message != null && (
        <section
          role="status"
          className={searchResults.length ? "alert alert--success" : "alert alert--error"}
          style={{ marginBottom: "1rem" }}
        >
          <p style={{ margin: 0 }}>{message}</p>
        </section>
      )}

      {searchResults.length > 0 && (
        <div style={{ marginBottom: "1.5rem" }}>
          <ListaEpisodios
            episodios={searchResults}
            titulo="Episodios encontrados (por cédula)"
            emptyMessage="No hay episodios para este paciente."
          />
        </div>
      )}

      <div style={{ marginBottom: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.5rem" }}>
          <h2 style={{ fontSize: "1.1rem", margin: 0 }}>
            Todos los episodios ({todosLosEpisodios.length})
          </h2>
          <button
            type="button"
            className="btn btn--secondary"
            onClick={handleRefrescarTodos}
            disabled={loadingAll}
            aria-busy={loadingAll}
          >
            {loadingAll ? "Cargando…" : "Actualizar lista"}
          </button>
        </div>
        {loadingAll && todosLosEpisodios.length === 0 ? (
          <p style={{ margin: 0, color: "var(--text-2, #666)" }}>Cargando episodios…</p>
        ) : (
          <ListaEpisodios
            episodios={todosLosEpisodios}
            titulo=""
            emptyMessage="Aún no hay episodios registrados. Cree uno desde «Crear nuevo episodio»."
          />
        )}
      </div>
    </div>
  );
}

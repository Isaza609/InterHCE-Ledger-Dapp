import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useSesion } from "@/shared/auth/SessionContext";
import { sesionTieneCapacidad } from "@/shared/auth/capabilities";
import { listarTodosLosEpisodios, type EpisodioResumen } from "@/shared/services/api";

interface PacienteResumen {
  patientIdentifier: string;
  patientName: string;
  patientBirthDate?: string;
  prestadorOrigenId?: string;
  ultimoEncuentro?: string;
  totalEpisodios: number;
  ultimoEpisodioId: string;
  episodios: EpisodioResumen[];
}

function buildActualizarPacienteHref(patientIdentifier: string, episodeId: string): string {
  const params = new URLSearchParams();
  params.set("patient", patientIdentifier);
  params.set("episodeId", episodeId);
  return `/episodios/actualizar?${params.toString()}`;
}

function agruparPacientes(episodios: EpisodioResumen[]): PacienteResumen[] {
  const pacientes = new Map<string, PacienteResumen>();

  for (const episodio of episodios) {
    const identifier = episodio.patientIdentifier?.trim();
    if (!identifier) continue;

    const existing = pacientes.get(identifier);
    if (!existing) {
      pacientes.set(identifier, {
        patientIdentifier: identifier,
        patientName: episodio.patientName || "Paciente sin nombre",
        patientBirthDate: episodio.patientBirthDate,
        prestadorOrigenId: episodio.prestadorOrigenId,
        ultimoEncuentro: episodio.encounterStart,
        totalEpisodios: 1,
        ultimoEpisodioId: episodio.episodeId,
        episodios: [episodio]
      });
      continue;
    }

    existing.episodios.push(episodio);
    existing.totalEpisodios += 1;
    if ((episodio.encounterStart ?? "") > (existing.ultimoEncuentro ?? "")) {
      existing.ultimoEncuentro = episodio.encounterStart;
      existing.ultimoEpisodioId = episodio.episodeId;
      existing.prestadorOrigenId = episodio.prestadorOrigenId;
    }
  }

  return [...pacientes.values()].sort((a, b) =>
    (b.ultimoEncuentro ?? "").localeCompare(a.ultimoEncuentro ?? "")
  );
}

export function PacientesPage() {
  const { sesion } = useSesion();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [allEpisodes, setAllEpisodes] = useState<EpisodioResumen[]>([]);
  const [query, setQuery] = useState(searchParams.get("q") ?? "");

  const canCreateEpisode = sesionTieneCapacidad(sesion, "episodios.crear");
  const canUpdateEpisode = sesionTieneCapacidad(sesion, "episodios.actualizar");
  const canViewDocument = sesionTieneCapacidad(sesion, "episodios.documento.ver");

  useEffect(() => {
    let active = true;

    listarTodosLosEpisodios(sesion)
      .then(({ episodes, message: backendMessage }) => {
        if (!active) return;
        setAllEpisodes(episodes);
        setMessage(backendMessage || null);
      })
      .catch(() => {
        if (!active) return;
        setAllEpisodes([]);
        setMessage("No fue posible cargar el módulo de pacientes.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [sesion]);

  const pacientes = useMemo(() => agruparPacientes(allEpisodes), [allEpisodes]);
  const filtro = query.trim().toLowerCase();
  const pacientesFiltrados = useMemo(() => {
    if (!filtro) return pacientes;
    return pacientes.filter((item) =>
      [item.patientIdentifier, item.patientName, item.prestadorOrigenId ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(filtro)
    );
  }, [pacientes, filtro]);

  const selectedId = searchParams.get("patient");
  const pacienteSeleccionado =
    pacientes.find((item) => item.patientIdentifier === selectedId) ?? pacientesFiltrados[0] ?? null;

  const seleccionarPaciente = (patientIdentifier: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("patient", patientIdentifier);
    if (query.trim()) next.set("q", query.trim());
    setSearchParams(next);
  };

  const aplicarFiltro = () => {
    const next = new URLSearchParams(searchParams);
    if (query.trim()) next.set("q", query.trim());
    else next.delete("q");
    setSearchParams(next);
  };

  return (
    <>
      <div className="page-header">
        <div className="page-header__row">
          <div>
            <h1 className="page-title">Pacientes</h1>
            <p className="page-subtitle">
              Consulte y gestione la información clínica a partir de los episodios registrados.
            </p>
          </div>
          <div className="page-actions">
            {canCreateEpisode && (
              <Link to="/episodios/crear" className="btn btn--primary">Registrar episodio</Link>
            )}
            <Link to="/episodios" className="btn btn--secondary">Ir a episodios</Link>
          </div>
        </div>
      </div>

      <div className="stats-row">
        <div className="stat-card">
          <span className="stat-card__value">{pacientes.length}</span>
          <span className="stat-card__label">Pacientes</span>
        </div>
        <div className="stat-card">
          <span className="stat-card__value">{pacientesFiltrados.length}</span>
          <span className="stat-card__label">Resultados</span>
        </div>
        <div className="stat-card">
          <span className="stat-card__value">
            {[canViewDocument ? "Consultar" : null, canUpdateEpisode ? "Actualizar" : null, canCreateEpisode ? "Registrar" : null]
              .filter(Boolean).join(" · ") || "—"}
          </span>
          <span className="stat-card__label">Capacidades</span>
        </div>
      </div>

      <section className="card card--elevated" style={{ marginBottom: 16 }}>
        <div className="section-head section-head--tight">
          <div>
            <h2 className="section-title">Buscar paciente</h2>
            <p className="section-copy">
              Filtre por documento, nombre o IPS para localizar rápidamente el registro correcto.
            </p>
          </div>
        </div>
        <div className="search-layout">
          <div className="form-group" style={{ flex: "1 1 320px", marginBottom: 0 }}>
            <label htmlFor="patient-filter" className="form-label">
              Documento, nombre o IPS
            </label>
            <input
              id="patient-filter"
              className="form-input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && aplicarFiltro()}
              placeholder="Ej. 12345678 o María Pérez"
            />
          </div>
          <div className="btn-group">
            <button type="button" className="btn btn--primary" onClick={aplicarFiltro}>
              Filtrar
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                setQuery("");
                setSearchParams(new URLSearchParams());
              }}
            >
              Limpiar
            </button>
          </div>
        </div>
        {message && <div className="alert alert--info" style={{ marginTop: 12 }}>{message}</div>}
      </section>

      <div className="admin-grid">
        <section className="card card--elevated">
          <div className="section-head section-head--tight">
            <div>
              <h2 className="section-title">Listado de pacientes</h2>
              <p className="section-copy">Seleccione un paciente para ver todo lo gestionable desde este módulo.</p>
            </div>
          </div>
          {loading ? (
            <p className="empty-state">Cargando pacientes...</p>
          ) : pacientesFiltrados.length === 0 ? (
            <p className="empty-state">No hay pacientes que coincidan con el filtro actual.</p>
          ) : (
            <div className="stack-list">
              {pacientesFiltrados.map((item) => (
                <button
                  type="button"
                  key={item.patientIdentifier}
                  className={`admin-list-item${
                    pacienteSeleccionado?.patientIdentifier === item.patientIdentifier ? " admin-list-item--active" : ""
                  }`}
                  onClick={() => seleccionarPaciente(item.patientIdentifier)}
                >
                  <strong>{item.patientName}</strong>
                  <span>{item.patientIdentifier}</span>
                  <small>{item.totalEpisodios} episodio(s) · {item.prestadorOrigenId ?? "IPS no disponible"}</small>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="card card--elevated">
          <div className="section-head section-head--tight">
            <div>
              <h2 className="section-title">Gestión del paciente</h2>
              <p className="section-copy">
                Desde aquí puede consultar el historial clínico registrado y navegar a acciones permitidas.
              </p>
            </div>
          </div>

          {!pacienteSeleccionado ? (
            <p className="empty-state">Seleccione un paciente del listado para revisar su información.</p>
          ) : (
            <>
              <div className="key-value-grid" style={{ marginBottom: 16 }}>
                <div>
                  <strong>Paciente</strong>
                  <span>{pacienteSeleccionado.patientName}</span>
                </div>
                <div>
                  <strong>Documento</strong>
                  <span>{pacienteSeleccionado.patientIdentifier}</span>
                </div>
                <div>
                  <strong>Fecha de nacimiento</strong>
                  <span>{pacienteSeleccionado.patientBirthDate ?? "No disponible"}</span>
                </div>
              </div>

              <div className="module-action-grid" style={{ marginBottom: 16 }}>
                <button
                  type="button"
                  className="action-card action-card--button"
                  onClick={() => navigate(`/episodios?patient=${pacienteSeleccionado.patientIdentifier}`)}
                >
                  <strong>Consultar episodios</strong>
                  <p>Ver todos los episodios asociados a este paciente dentro del módulo de episodios.</p>
                  <span>Abrir módulo</span>
                </button>
                {canViewDocument && (
                  <Link
                    to={`/episodios/ver/${pacienteSeleccionado.ultimoEpisodioId}`}
                    className="action-card"
                  >
                    <strong>Consultar documento</strong>
                    <p>Acceder al documento del episodio más reciente si su perfil tiene autorización.</p>
                    <span>Ver episodio</span>
                  </Link>
                )}
                {canUpdateEpisode && (
                  <Link
                    to={buildActualizarPacienteHref(
                      pacienteSeleccionado.patientIdentifier,
                      pacienteSeleccionado.ultimoEpisodioId
                    )}
                    className="action-card"
                  >
                    <strong>Actualizar episodio</strong>
                    <p>Ir al formulario de actualización con el episodio más reciente ya precargado.</p>
                    <span>Actualizar</span>
                  </Link>
                )}
                {canCreateEpisode && (
                  <Link to="/episodios/crear" className="action-card">
                    <strong>Registrar nuevo episodio</strong>
                    <p>Crear un nuevo episodio clínico relacionado con este paciente.</p>
                    <span>Registrar</span>
                  </Link>
                )}
              </div>

              <div className="section-head section-head--tight">
                <div>
                  <h3 className="section-title">Episodios asociados</h3>
                  <p className="section-copy">Historial visible desde la sesión actual.</p>
                </div>
              </div>
              <div className="stack-list">
                {pacienteSeleccionado.episodios.map((episodio) => (
                  <article key={episodio.episodeId} className="stack-item">
                    <strong>{episodio.episodeId}</strong>
                    <span>
                      {episodio.encounterStart ?? "Sin fecha"} · {episodio.encounterStatus ?? "Estado no disponible"}
                    </span>
                    <small>{episodio.prestadorOrigenId ?? "IPS no disponible"}</small>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </>
  );
}

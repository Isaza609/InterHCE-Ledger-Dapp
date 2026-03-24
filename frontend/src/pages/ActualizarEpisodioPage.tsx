import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { FormularioEpisodio } from "@/features/episodios/components/FormularioEpisodio";
import { buildEpisodioPayload } from "@/shared/utils/episodioPayload";
import {
  actualizarEpisodio,
  listarTodosLosEpisodios,
  obtenerDocumentoEpisodio,
  validarEpisodio,
  type EpisodioResumen
} from "@/shared/services/api";
import type { EpisodioPayload, ValidationResult } from "@/shared/types/episodio";
import { useSesion } from "@/shared/auth/SessionContext";

interface PacienteResumen {
  patientIdentifier: string;
  patientName: string;
  patientBirthDate?: string;
  prestadorOrigenId?: string;
  ultimoEncuentro?: string;
  ultimoEpisodioId: string;
  episodios: EpisodioResumen[];
}

function agruparPacientes(episodios: EpisodioResumen[]): PacienteResumen[] {
  const pacientes = new Map<string, PacienteResumen>();

  for (const episodio of episodios) {
    const identifier = episodio.patientIdentifier?.trim();
    if (!identifier) continue;

    const existente = pacientes.get(identifier);
    if (!existente) {
      pacientes.set(identifier, {
        patientIdentifier: identifier,
        patientName: episodio.patientName || "Paciente sin nombre",
        patientBirthDate: episodio.patientBirthDate,
        prestadorOrigenId: episodio.prestadorOrigenId,
        ultimoEncuentro: episodio.encounterStart,
        ultimoEpisodioId: episodio.episodeId,
        episodios: [episodio]
      });
      continue;
    }

    existente.episodios.push(episodio);
    if ((episodio.encounterStart ?? "") > (existente.ultimoEncuentro ?? "")) {
      existente.ultimoEncuentro = episodio.encounterStart;
      existente.ultimoEpisodioId = episodio.episodeId;
      existente.prestadorOrigenId = episodio.prestadorOrigenId;
    }
  }

  return [...pacientes.values()].sort((a, b) =>
    (b.ultimoEncuentro ?? "").localeCompare(a.ultimoEncuentro ?? "")
  );
}

export function ActualizarEpisodioPage() {
  const { sesion } = useSesion();
  const [searchParams, setSearchParams] = useSearchParams();
  const [allEpisodes, setAllEpisodes] = useState<EpisodioResumen[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [loadingDocument, setLoadingDocument] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") ?? searchParams.get("patient") ?? "");
  const [selectedDocument, setSelectedDocument] = useState<EpisodioPayload | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<ValidationResult | null>(null);

  const patientParam = searchParams.get("patient")?.trim() ?? "";
  const episodeId = searchParams.get("episodeId")?.trim() ?? "";

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
        setMessage("No fue posible cargar los episodios disponibles para edición.");
      })
      .finally(() => {
        if (active) setLoadingCatalog(false);
      });

    return () => {
      active = false;
    };
  }, [sesion]);

  const pacientes = useMemo(() => agruparPacientes(allEpisodes), [allEpisodes]);
  const filtro = searchQuery.trim().toLowerCase();
  const pacientesFiltrados = useMemo(() => {
    if (!filtro) return pacientes;
    return pacientes.filter((item) =>
      [item.patientIdentifier, item.patientName, item.prestadorOrigenId ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(filtro)
    );
  }, [pacientes, filtro]);

  const pacienteSeleccionado = useMemo(() => {
    if (patientParam) {
      return pacientes.find((item) => item.patientIdentifier === patientParam) ?? null;
    }
    return pacientesFiltrados[0] ?? null;
  }, [patientParam, pacientes, pacientesFiltrados]);

  useEffect(() => {
    if (patientParam || !pacienteSeleccionado) {
      return;
    }
    const next = new URLSearchParams(searchParams);
    next.set("patient", pacienteSeleccionado.patientIdentifier);
    setSearchParams(next, { replace: true });
  }, [pacienteSeleccionado, patientParam, searchParams, setSearchParams]);

  useEffect(() => {
    let active = true;

    if (!episodeId) {
      setSelectedDocument(null);
      return;
    }

    setLoadingDocument(true);
    setResult(null);

    obtenerDocumentoEpisodio(episodeId, sesion)
      .then((documento) => {
        if (!active) return;
        if (!documento) {
          setSelectedDocument(null);
          setMessage("No fue posible cargar el documento del episodio seleccionado.");
          return;
        }
        setSelectedDocument(documento.document);
        setMessage(`Episodio ${episodeId} cargado. Puede editar solamente los campos necesarios.`);
      })
      .catch(() => {
        if (!active) return;
        setSelectedDocument(null);
        setMessage("Ocurrió un error al precargar el episodio para edición.");
      })
      .finally(() => {
        if (active) setLoadingDocument(false);
      });

    return () => {
      active = false;
    };
  }, [episodeId, sesion]);

  const seleccionarPaciente = (patientIdentifier: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("patient", patientIdentifier);
    if (searchQuery.trim()) next.set("q", searchQuery.trim());
    next.delete("episodeId");
    setSelectedDocument(null);
    setResult(null);
    setSearchParams(next);
  };

  const seleccionarEpisodio = (nextEpisodeId: string) => {
    const next = new URLSearchParams(searchParams);
    if (pacienteSeleccionado?.patientIdentifier) {
      next.set("patient", pacienteSeleccionado.patientIdentifier);
    }
    next.set("episodeId", nextEpisodeId);
    setSearchParams(next);
  };

  const aplicarFiltro = () => {
    const next = new URLSearchParams(searchParams);
    if (searchQuery.trim()) {
      next.set("q", searchQuery.trim());
    } else {
      next.delete("q");
    }
    next.delete("patient");
    next.delete("episodeId");
    setSelectedDocument(null);
    setResult(null);
    setSearchParams(next);
  };

  const onValidar = async (payload: EpisodioPayload) => {
    setLoadingAction(true);
    const valid = await validarEpisodio(buildEpisodioPayload(payload));
    setResult(valid);
    setLoadingAction(false);
  };

  const onActualizar = async (payload: EpisodioPayload) => {
    if (!episodeId) {
      setResult({
        valid: false,
        message: "Seleccione primero un episodio existente para poder actualizarlo.",
        details: []
      });
      return;
    }
    setLoadingAction(true);
    const updated = await actualizarEpisodio(episodeId, buildEpisodioPayload(payload), sesion);
    setResult(updated);
    setLoadingAction(false);
  };

  return (
    <>
      <nav aria-label="Migas de pan" className="breadcrumb">
        <Link to="/portal">Panel</Link>{" / "}
        <Link to="/episodios">Episodios</Link>{" / Actualizar"}
      </nav>

      <div className="page-header">
        <div className="page-header__row">
          <div>
            <h1 className="page-title">Actualizar episodio</h1>
            <p className="page-subtitle">
              Seleccione paciente y episodio. El formulario se precarga con la información actual.
            </p>
          </div>
          <div className="context-note">
            <strong>{sesion?.nombre ?? "Sin sesión"}</strong>
            <small>{sesion?.ipsId ?? "Autentíquese para actualizar"}</small>
          </div>
        </div>
      </div>

      <section className="card card--elevated" style={{ marginBottom: 16 }}>
        <div className="section-head section-head--tight">
          <div>
            <h2 className="section-title">Buscar paciente o documento</h2>
            <p className="section-copy">
              Use documento, nombre o IPS para ubicar el episodio correcto antes de editarlo.
            </p>
          </div>
        </div>
        <div className="search-layout">
          <div className="form-group" style={{ flex: "1 1 320px", marginBottom: 0 }}>
            <label htmlFor="actualizar-paciente" className="form-label">
              Paciente, documento o IPS
            </label>
            <input
              id="actualizar-paciente"
              className="form-input"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
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
                setSearchQuery("");
                setSelectedDocument(null);
                setResult(null);
                setSearchParams(new URLSearchParams());
              }}
            >
              Limpiar
            </button>
          </div>
        </div>
        {message && <div className="alert alert--info" style={{ marginTop: 12 }}>{message}</div>}
      </section>

      <div className="admin-grid" style={{ marginBottom: 16 }}>
        <section className="card card--elevated">
          <div className="section-head section-head--tight">
            <div>
              <h2 className="section-title">1. Seleccione el paciente</h2>
              <p className="section-copy">
                Esto evita buscar el `episodeId` manualmente y reduce errores al actualizar.
              </p>
            </div>
          </div>
          {loadingCatalog ? (
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
                    pacienteSeleccionado?.patientIdentifier === item.patientIdentifier
                      ? " admin-list-item--active"
                      : ""
                  }`}
                  onClick={() => seleccionarPaciente(item.patientIdentifier)}
                >
                  <strong>{item.patientName}</strong>
                  <span>{item.patientIdentifier}</span>
                  <small>
                    {item.episodios.length} episodio(s) · {item.prestadorOrigenId ?? "IPS no disponible"}
                  </small>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="card card--elevated">
          <div className="section-head section-head--tight">
            <div>
              <h2 className="section-title">2. Cargue el episodio a editar</h2>
              <p className="section-copy">
                Seleccione el episodio específico. El sistema traerá el documento actual al formulario.
              </p>
            </div>
          </div>

          {!pacienteSeleccionado ? (
            <p className="empty-state">Seleccione un paciente para listar sus episodios.</p>
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
                  <strong>Episodio seleccionado</strong>
                  <span>{episodeId || "Aún no seleccionado"}</span>
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
                    <div className="btn-group" style={{ marginTop: "0.75rem" }}>
                      <button
                        type="button"
                        className="btn btn--secondary"
                        onClick={() => seleccionarEpisodio(episodio.episodeId)}
                        disabled={loadingDocument && episodeId === episodio.episodeId}
                      >
                        {loadingDocument && episodeId === episodio.episodeId ? "Cargando..." : "Editar este episodio"}
                      </button>
                      <Link to={`/episodios/ver/${episodio.episodeId}`} className="btn btn--ghost">
                        Ver documento
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>
      </div>

      <div className="card card--elevated">
        {!episodeId ? (
          <p className="empty-state">
            Seleccione un episodio para precargar su información antes de editar.
          </p>
        ) : loadingDocument || !selectedDocument ? (
          <p className="empty-state">Cargando información clínica del episodio seleccionado...</p>
        ) : (
          <FormularioEpisodio
            initialData={selectedDocument}
            onValidar={onValidar}
            onRegistrar={onActualizar}
            loading={loadingAction}
            result={result}
            actionLabel="Guardar actualización"
          />
        )}
      </div>
    </>
  );
}

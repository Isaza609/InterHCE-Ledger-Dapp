import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useSesion } from "@/shared/auth/SessionContext";
import {
  buscarEventosTrazabilidad,
  consultarIntegridadEpisodio,
  consultarTrazabilidadEpisodio
} from "@/shared/services/api";
import type {
  EstadoPermisoEpisodio,
  TraceabilityEvent,
  VersionEpisodio
} from "@/shared/types/episodio";

const EVENT_LABELS: Record<TraceabilityEvent["eventType"], string> = {
  EPISODE_CREATED: "Creación del episodio",
  EPISODE_UPDATED: "Actualización clínica",
  PERMISSION_GRANTED: "Acceso compartido",
  PERMISSION_REVOKED: "Acceso revocado",
  AUDITABLE_ACCESS: "Consulta auditada",
  INTEGRITY_CHECK: "Verificación de integridad"
};

function formatDate(value?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function shortHash(value?: string) {
  if (!value) return "—";
  if (value.length <= 18) return value;
  return `${value.slice(0, 10)}...${value.slice(-8)}`;
}

function ledgerLabel(event: TraceabilityEvent) {
  return event.evidence.ledgerMode === "real" ? "Registrado en blockchain" : "Evidencia simulada";
}

function VersionesTable({ versions }: { versions: VersionEpisodio[] }) {
  if (!versions.length) {
    return <p className="empty-state">No hay versiones registradas para este episodio.</p>;
  }
  return (
    <table className="tabla-clinica">
      <thead>
        <tr>
          <th>Versión</th>
          <th>Fecha</th>
          <th>Rol</th>
          <th>IPS</th>
          <th>Hash documento</th>
        </tr>
      </thead>
      <tbody>
        {versions.map((item) => (
          <tr key={`${item.version}-${item.actualizadoEn}`}>
            <td>{item.version}</td>
            <td>{formatDate(item.actualizadoEn)}</td>
            <td>{item.actor.rol}</td>
            <td>{item.actor.ipsId ?? "—"}</td>
            <td>
              <code>{shortHash(item.documentHash)}</code>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PermisosTable({ estados }: { estados: EstadoPermisoEpisodio[] }) {
  if (!estados.length) {
    return <p className="empty-state">No hay permisos registrados para este episodio.</p>;
  }
  return (
    <table className="tabla-clinica">
      <thead>
        <tr>
          <th>IPS origen</th>
          <th>IPS receptora</th>
          <th>Estado</th>
          <th>Otorgado</th>
          <th>Revocado</th>
        </tr>
      </thead>
      <tbody>
        {estados.map((item) => (
          <tr key={`${item.targetIpsId}-${item.ultimoCambioEn}`}>
            <td>{item.sourceIpsId}</td>
            <td>{item.targetIpsId}</td>
            <td>{item.activo ? "Activo" : "Revocado"}</td>
            <td>{formatDate(item.grantedAt)}</td>
            <td>{formatDate(item.revokedAt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TraceEventsList({ events }: { events: TraceabilityEvent[] }) {
  if (!events.length) {
    return <p className="empty-state">No hay eventos de evidencia registrados.</p>;
  }
  return (
    <div className="trace-timeline">
      {events.map((item) => (
        <article key={item.traceId} className="trace-event-card">
          <div className="trace-event-card__head">
            <div>
              <strong>{EVENT_LABELS[item.eventType]}</strong>
              <span>{formatDate(item.recordedAt)}</span>
            </div>
            <div className={item.evidence.ledgerMode === "real" ? "status-chip status-chip--ready" : "status-chip status-chip--info"}>
              {ledgerLabel(item)}
            </div>
          </div>
          <div className="key-value-grid">
            <div>
              <strong>Actor</strong>
              <span>{item.actor.rol}</span>
            </div>
            <div>
              <strong>IPS</strong>
              <span>{item.actor.ipsId ?? "—"}</span>
            </div>
            <div>
              <strong>Tipo</strong>
              <span>{EVENT_LABELS[item.eventType]}</span>
            </div>
            <div>
              <strong>Transacción</strong>
              {item.evidence.explorerUrl ? (
                <a href={item.evidence.explorerUrl} target="_blank" rel="noreferrer" className="inline-code-link">
                  <code>{shortHash(item.evidence.transactionHash)}</code>
                </a>
              ) : (
                <code>{shortHash(item.evidence.transactionHash)}</code>
              )}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

export function TrazabilidadEpisodioPage() {
  const { sesion } = useSesion();
  const [searchParams, setSearchParams] = useSearchParams();
  const [episodeId, setEpisodeId] = useState(searchParams.get("episodeId") ?? "");
  const [eventType, setEventType] = useState<TraceabilityEvent["eventType"] | "">("");
  const [ipsFilter, setIpsFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [traceData, setTraceData] = useState<Awaited<ReturnType<typeof consultarTrazabilidadEpisodio>>["data"]>();
  const [integrityData, setIntegrityData] = useState<Awaited<ReturnType<typeof consultarIntegridadEpisodio>>["data"]>();
  const [eventSearch, setEventSearch] = useState<Awaited<ReturnType<typeof buscarEventosTrazabilidad>>["data"]>();

  const ultimoEvento = useMemo(
    () => (traceData?.traceEvents.length ? traceData.traceEvents[traceData.traceEvents.length - 1] : undefined),
    [traceData]
  );

  const consultar = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);

    const nextParams = new URLSearchParams();
    if (episodeId.trim()) nextParams.set("episodeId", episodeId.trim());
    setSearchParams(nextParams, { replace: true });

    if (episodeId.trim()) {
      const [traceRes, integrityRes, eventsRes] = await Promise.all([
        consultarTrazabilidadEpisodio(episodeId.trim(), sesion),
        consultarIntegridadEpisodio(episodeId.trim(), sesion),
        buscarEventosTrazabilidad(
          {
            episodeId: episodeId.trim(),
            eventType: eventType || undefined,
            ipsId: sesion?.rol === "auditor" ? ipsFilter.trim() || undefined : undefined
          },
          sesion
        )
      ]);

      setTraceData(traceRes.data);
      setIntegrityData(integrityRes.data);
      setEventSearch(eventsRes.data);

      if (!traceRes.ok) {
        setError(traceRes.message);
      } else {
        setMessage(traceRes.message);
      }
      if (traceRes.ok && !integrityRes.ok) {
        setError(integrityRes.message);
      }
      if (traceRes.ok && !eventsRes.ok) {
        setError(eventsRes.message);
      }
      setLoading(false);
      return;
    }

    const eventsRes = await buscarEventosTrazabilidad(
      {
        eventType: eventType || undefined,
        ipsId: sesion?.rol === "auditor" ? ipsFilter.trim() || undefined : undefined
      },
      sesion
    );
    setTraceData(undefined);
    setIntegrityData(undefined);
    setEventSearch(eventsRes.data);
    if (!eventsRes.ok) {
      setError(eventsRes.message);
    } else {
      setMessage(eventsRes.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!searchParams.get("episodeId")) return;
    void consultar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <nav aria-label="Migas de pan" className="breadcrumb">
        <Link to="/portal">Panel</Link>{" / "}
        <Link to="/episodios">Episodios</Link>{" / Trazabilidad"}
      </nav>

      <div className="page-header">
        <div className="page-header__row">
          <div>
            <h1 className="page-title">Trazabilidad clínica</h1>
            <p className="page-subtitle">
              Evidencia de creación, actualizaciones, accesos y permisos sin exponer datos clínicos.
            </p>
          </div>
          <div className="context-note">
            <strong>{episodeId.trim() || "Consulta general"}</strong>
            <span>{eventSearch?.total ?? 0} evento(s)</span>
            <small>{sesion?.rol ?? "Sin sesión"}{sesion?.ipsId ? ` · ${sesion.ipsId}` : ""}</small>
          </div>
        </div>
      </div>

      <section className="card card--elevated" style={{ marginBottom: 16 }}>
        <div className="section-head section-head--tight">
          <div>
            <h2 className="section-title">Filtros de trazabilidad</h2>
            <p className="section-copy">
              Puede consultar un episodio específico o revisar todos los eventos visibles para su alcance actual.
            </p>
          </div>
        </div>
        <div className="form-columns">
          <div className="form-group">
            <label htmlFor="episode-id-trace" className="form-label">
              ID de episodio
            </label>
            <input
              id="episode-id-trace"
              className="form-input"
              type="text"
              value={episodeId}
              onChange={(e) => setEpisodeId(e.target.value)}
              placeholder="Ej. 8f2c..."
            />
          </div>
          <div className="form-group">
            <label htmlFor="event-type-trace" className="form-label">
              Tipo de evento
            </label>
            <select
              id="event-type-trace"
              className="form-input"
              value={eventType}
              onChange={(e) => setEventType(e.target.value as TraceabilityEvent["eventType"] | "")}
            >
              <option value="">Todos</option>
              {Object.entries(EVENT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          {sesion?.rol === "auditor" && (
            <div className="form-group">
              <label htmlFor="ips-filter" className="form-label">
                IPS
              </label>
              <input
                id="ips-filter"
                className="form-input"
                value={ipsFilter}
                onChange={(e) => setIpsFilter(e.target.value)}
                placeholder="Ej. IPS-001"
              />
            </div>
          )}
        </div>
        <div className="btn-group">
          <button type="button" className="btn btn--primary" onClick={consultar} disabled={loading}>
            {loading ? "Consultando..." : "Consultar trazabilidad"}
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => {
              setEpisodeId("");
              setEventType("");
              setIpsFilter("");
              setTraceData(undefined);
              setIntegrityData(undefined);
              setEventSearch(undefined);
              setMessage(null);
              setError(null);
              setSearchParams(new URLSearchParams(), { replace: true });
            }}
          >
            Limpiar filtros
          </button>
        </div>
        {message && <div className="alert alert--info" style={{ marginTop: 12 }}>{message}</div>}
        {error && <div className="alert alert--error" style={{ marginTop: 12 }}>{error}</div>}
      </section>

      {traceData && (
        <div className="result-panel" style={{ marginBottom: 16 }}>
          <div>
            <strong>Evento clínico asociado</strong>
            <span>{traceData.event.eventoUrgenciasId}</span>
          </div>
          <div>
            <strong>Última evidencia</strong>
            <span>{ultimoEvento ? EVENT_LABELS[ultimoEvento.eventType] : "Sin eventos"}</span>
          </div>
          <div>
            <strong>Continuidad entre IPS</strong>
            <span>{traceData.continuidad?.ipsInvolucradas.join(", ") || traceData.event.ipsOrigenId}</span>
          </div>
        </div>
      )}

      {integrityData && (
        <section className="card card--elevated" style={{ marginBottom: 16 }}>
          <div className="section-head section-head--tight">
            <div>
              <h2 className="section-title">Estado de integridad</h2>
              <p className="section-copy">
                Comparación entre el hash vigente del documento off-chain y la evidencia registrada.
              </p>
            </div>
            <div className={integrityData.isIntegrityValid ? "status-chip status-chip--ready" : "status-chip status-chip--alert"}>
              {integrityData.isIntegrityValid ? "Documento íntegro" : "Revisión requerida"}
            </div>
          </div>
          <div className="key-value-grid">
            <div>
              <strong>Hash registrado</strong>
              <code>{shortHash(integrityData.onChainHash)}</code>
            </div>
            <div>
              <strong>Hash documento</strong>
              <code>{shortHash(integrityData.offChainHash)}</code>
            </div>
            <div>
              <strong>Evidencia</strong>
              <code>{shortHash(integrityData.evidence.sourceTransactionHash)}</code>
            </div>
          </div>
        </section>
      )}

      {traceData && (
        <section className="card card--elevated" style={{ marginBottom: 16 }}>
          <div className="section-head section-head--tight">
            <div>
              <h2 className="section-title">Continuidad asistencial</h2>
              <p className="section-copy">
                El episodio conserva el mismo identificador y refleja qué IPS participaron en su ciclo de vida.
              </p>
            </div>
          </div>
          <div className="key-value-grid">
            <div>
              <strong>IPS origen</strong>
              <span>{traceData.event.ipsOrigenId}</span>
            </div>
            <div>
              <strong>IPS propietaria</strong>
              <span>{traceData.continuidad?.ownerIpsId ?? traceData.event.ipsOrigenId}</span>
            </div>
            <div>
              <strong>IPS involucradas</strong>
              <span>{traceData.continuidad?.ipsInvolucradas.join(", ") || traceData.event.ipsOrigenId}</span>
            </div>
          </div>
        </section>
      )}

      {traceData && (
        <section className="card card--elevated" style={{ marginBottom: 16 }}>
          <div className="section-head section-head--tight">
            <div>
              <h2 className="section-title">Historial de versiones</h2>
              <p className="section-copy">Cada actualización conserva evidencia independiente y actor responsable.</p>
            </div>
          </div>
          <VersionesTable versions={traceData.versiones} />
        </section>
      )}

      {traceData && (
        <section className="card card--elevated" style={{ marginBottom: 16 }}>
          <div className="section-head section-head--tight">
            <div>
              <h2 className="section-title">Permisos entre IPS</h2>
              <p className="section-copy">Resumen de accesos otorgados o revocados sobre el episodio.</p>
            </div>
          </div>
          <PermisosTable estados={traceData.estadosPermisos} />
        </section>
      )}

      {eventSearch && (
        <section className="card card--elevated" style={{ marginBottom: 16 }}>
          <div className="section-head section-head--tight">
            <div>
              <h2 className="section-title">Eventos visibles</h2>
              <p className="section-copy">
                {episodeId.trim()
                  ? "Eventos asociados al episodio filtrado."
                  : "Eventos disponibles para su rol e institución en el alcance actual."}
              </p>
            </div>
          </div>
          <TraceEventsList events={eventSearch.events} />
        </section>
      )}
    </>
  );
}

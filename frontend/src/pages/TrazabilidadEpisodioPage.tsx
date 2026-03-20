import { useState } from "react";
import { Link } from "react-router-dom";
import {
  obtenerTrazabilidadEpisodio,
  verificarIntegridadEpisodio
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
            <div className={item.evidence.ledgerMode === "real" ? "status-chip status-chip--ready" : "status-chip"}>
              {item.evidence.ledgerMode === "real" ? "Registrado en testnet" : "Evidencia simulada"}
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
  const [episodeId, setEpisodeId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [traceData, setTraceData] = useState<Awaited<ReturnType<typeof obtenerTrazabilidadEpisodio>>>(null);
  const [integrityData, setIntegrityData] = useState<Awaited<ReturnType<typeof verificarIntegridadEpisodio>>>(null);
  const ultimoEvento =
    traceData && traceData.traceEvents.length > 0
      ? traceData.traceEvents[traceData.traceEvents.length - 1]
      : undefined;
  const permisosActivos = traceData?.estadosPermisos.filter((item) => item.activo).length ?? 0;
  const versionesRegistradas = traceData?.versiones.length ?? 0;

  const consultar = async () => {
    const id = episodeId.trim();
    if (!id) {
      setError("Debe indicar el ID del episodio.");
      return;
    }

    setLoading(true);
    setError(null);
    const [traceRes, integrityRes] = await Promise.all([
      obtenerTrazabilidadEpisodio(id),
      verificarIntegridadEpisodio(id)
    ]);
    setTraceData(traceRes);
    setIntegrityData(integrityRes);
    if (!traceRes) {
      setError("No se encontró trazabilidad autorizada para este episodio.");
    }
    setLoading(false);
  };

  return (
    <div className="container">
      <nav aria-label="Migas de pan" className="breadcrumb">
        <Link to="/">Inicio</Link>
        {" / "}
        <Link to="/episodios">Episodios</Link>
        {" / Trazabilidad"}
      </nav>
      <section className="page-banner">
        <div>
          <p className="eyebrow">Auditoría e integridad</p>
          <h1 className="page-title">Seguimiento claro del episodio</h1>
          <p className="page-subtitle">
            Consulte en un solo lugar el origen del caso, los cambios clínicos, los accesos
            compartidos y la evidencia que respalda la integridad del documento.
          </p>
        </div>
        <div className="context-note">
          <strong>{traceData?.episodeId ?? "Busque un episodio"}</strong>
          <span>{versionesRegistradas} versiones registradas</span>
          <small>{permisosActivos} permisos activos entre IPS</small>
        </div>
      </section>

      <section className="card card--elevated" style={{ marginBottom: "1rem" }}>
        <div className="section-head section-head--tight">
          <div>
            <h2 className="section-title">Buscar episodio</h2>
            <p className="section-copy">
              Pegue el identificador del episodio para revisar continuidad, integridad y evidencia.
            </p>
          </div>
        </div>
        <div className="search-layout">
          <div className="form-group" style={{ flex: "1 1 320px", marginBottom: 0 }}>
            <label htmlFor="episode-id-trace" className="form-label form-label--required">
              ID de episodio
            </label>
            <input
              id="episode-id-trace"
              className="form-input"
              type="text"
              value={episodeId}
              onChange={(e) => setEpisodeId(e.target.value)}
              placeholder="Ej. episode-1234"
            />
            <small className="form-hint">
              Puede copiarlo desde la ficha del episodio o desde la jornada clínica.
            </small>
          </div>
          <div className="form-group form-group--actions">
            <button type="button" className="btn btn--primary" onClick={consultar} disabled={loading}>
              {loading ? "Consultando..." : "Consultar trazabilidad"}
            </button>
          </div>
        </div>
        {error && (
          <div className="alert alert--error" style={{ marginTop: "1rem" }}>
            {error}
          </div>
        )}
      </section>

      {traceData && (
        <div className="result-panel" style={{ marginBottom: "1rem" }}>
          <div>
            <strong>Evento clínico asociado</strong>
            <span>{traceData.event.eventoUrgenciasId}</span>
          </div>
          <div>
            <strong>Inicio del caso</strong>
            <span>{formatDate(traceData.event.fechaHoraInicio)}</span>
          </div>
          <div>
            <strong>Última evidencia</strong>
            <span>{ultimoEvento ? EVENT_LABELS[ultimoEvento.eventType] : "Sin eventos"}</span>
          </div>
        </div>
      )}

      {integrityData && (
        <section className="card card--elevated" style={{ marginBottom: "1rem" }}>
          <div className="section-head section-head--tight">
            <div>
              <h2 className="section-title">Estado de integridad</h2>
              <p className="section-copy">
                Verificación entre el hash almacenado del documento y la evidencia registrada.
              </p>
            </div>
            <div
              className={
                integrityData.isIntegrityValid ? "status-chip status-chip--ready" : "status-chip status-chip--alert"
              }
            >
              {integrityData.isIntegrityValid ? "Documento íntegro" : "Revisión requerida"}
            </div>
          </div>
          <div className="key-value-grid">
            <div>
              <strong>Hash registrado</strong>
              <code>{shortHash(integrityData.onChainHash)}</code>
            </div>
            <div>
              <strong>Hash del documento</strong>
              <code>{shortHash(integrityData.offChainHash)}</code>
            </div>
            <div>
              <strong>Evidencia fuente</strong>
              <code>{shortHash(integrityData.evidence.sourceTransactionHash)}</code>
            </div>
          </div>
        </section>
      )}

      {traceData && (
        <section className="card card--elevated" style={{ marginBottom: "1rem" }}>
          <div className="section-head section-head--tight">
            <div>
              <h2 className="section-title">Resumen del caso</h2>
              <p className="section-copy">Datos clave para entender cómo evolucionó el episodio.</p>
            </div>
          </div>
          <div className="key-value-grid">
            <div>
              <strong>IPS origen</strong>
              <span>{traceData.event.ipsOrigenId}</span>
            </div>
            <div>
              <strong>Tipo de atención</strong>
              <span>{traceData.event.tipoAtencion}</span>
            </div>
            <div>
              <strong>IPS con acceso vigente</strong>
              <span>{traceData.permisosActivos.join(", ") || "Sin IPS adicionales"}</span>
            </div>
          </div>
        </section>
      )}

      {traceData && (
        <section className="card card--elevated" style={{ marginBottom: "1rem" }}>
          <div className="section-head section-head--tight">
            <div>
              <h2 className="section-title">Historial de versiones</h2>
              <p className="section-copy">
                Cada actualización conserva evidencia independiente para mantener trazabilidad clínica.
              </p>
            </div>
          </div>
          <VersionesTable versions={traceData.versiones} />
        </section>
      )}

      {traceData && (
        <section className="card card--elevated" style={{ marginBottom: "1rem" }}>
          <div className="section-head section-head--tight">
            <div>
              <h2 className="section-title">Accesos compartidos entre IPS</h2>
              <p className="section-copy">
                Estado histórico de permisos otorgados o revocados para continuidad asistencial.
              </p>
            </div>
          </div>
          <div className="pill-row" style={{ marginBottom: "1rem" }}>
            <span className={permisosActivos ? "status-chip status-chip--ready" : "status-chip"}>
              {permisosActivos ? `${permisosActivos} accesos activos` : "Sin accesos adicionales"}
            </span>
          </div>
          <PermisosTable estados={traceData.estadosPermisos} />
        </section>
      )}

      {traceData && (
        <section className="card card--elevated">
          <div className="section-head section-head--tight">
            <div>
              <h2 className="section-title">Evidencia y trazabilidad</h2>
              <p className="section-copy">
                Registro cronológico de acciones relevantes con su evidencia de backend y blockchain.
              </p>
            </div>
          </div>
          <TraceEventsList events={traceData.traceEvents} />
        </section>
      )}
    </div>
  );
}

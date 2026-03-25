import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useSesion } from "@/shared/auth/SessionContext";
import {
  obtenerDashboardEvaluacion,
  type DashboardEvaluacionPrototipo,
  type TimingOperationSummary
} from "@/shared/services/api";

const DOCUMENTACION_BASE = {
  resumenEjecutivo: [
    "El prototipo integra interoperabilidad clínica, almacenamiento off-chain y evidencia on-chain en un mismo flujo operativo.",
    "La auditoría consolida métricas de continuidad, integridad y cumplimiento sin depender de documentos externos cargados desde el sistema anfitrión.",
    "La documentación visible en esta vista se genera localmente en la DApp para evitar fallos por acceso a carpetas o rutas no disponibles en la máquina virtual."
  ],
  conclusiones: [
    "La arquitectura separa el documento clínico del rastro verificable, lo que reduce exposición de datos sensibles en la capa blockchain.",
    "La trazabilidad por evento, rol e IPS permite revisar el ciclo de vida del episodio con suficiente detalle para auditoría funcional.",
    "El tablero es útil como evidencia del prototipo incluso cuando el entorno virtual limita el acceso a archivos del host."
  ],
  aportes: [
    "Consolida en una sola vista resultados técnicos, métricos y de cumplimiento del modelo HCE.",
    "Evita dependencia de documentos manuales externos al generar el contenido base directamente desde la aplicación.",
    "Facilita la sustentación del prototipo con un resumen reproducible y consistente entre ejecuciones."
  ],
  limitaciones: [
    "Los resultados dependen de los episodios y trazas disponibles en el entorno actual.",
    "Las métricas de blockchain pueden variar según el modo de simulación o la red configurada.",
    "La evaluación no reemplaza pruebas formales de carga, seguridad o adopción clínica en producción."
  ],
  trabajoFuturo: [
    "Persistir históricos de evaluación para comparar resultados entre iteraciones y escenarios.",
    "Ampliar la cobertura de pruebas no funcionales y escenarios multiinstitución.",
    "Incorporar exportación del informe generado desde la propia DApp."
  ]
};

function formatDate(value?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function formatMs(value?: number) {
  if (typeof value !== "number") return "—";
  return `${value.toFixed(2)} ms`;
}

function formatCompactNumber(value?: number) {
  if (typeof value !== "number") return "—";
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 }).format(value);
}

function statusChipClass(status: string) {
  if (status === "cumple" || status === "consistente" || status === "integro") {
    return "status-chip status-chip--ready";
  }
  if (status === "parcial" || status === "revision_requerida" || status === "con_riesgos") {
    return "status-chip status-chip--alert";
  }
  return "status-chip";
}

function buildDocumentation(dashboard: DashboardEvaluacionPrototipo | null) {
  if (!dashboard) {
    return DOCUMENTACION_BASE;
  }

  const totalEpisodes = dashboard.overview.totalEpisodes ?? 0;
  const continuityEpisodes = dashboard.interoperability.summary.episodesWithContinuity ?? 0;
  const integrityEpisodes = dashboard.audit.integrityValidEpisodes ?? 0;
  const validHceEpisodes = dashboard.compliance.hceModel.validEpisodes ?? 0;
  const multiIpsActive = dashboard.interoperability.multipleIpsReady;

  return {
    resumenEjecutivo: [
      `Se evaluaron ${totalEpisodes} episodio(s), con ${continuityEpisodes} caso(s) que muestran continuidad asistencial entre actores e IPS.`,
      `La verificación de integridad reporta ${integrityEpisodes} episodio(s) íntegros y ${validHceEpisodes} validado(s) frente al modelo HCE.`,
      multiIpsActive
        ? "La simulación multi-IPS está activa, por lo que la documentación refleja escenarios interinstitucionales del prototipo."
        : "La documentación se generó sin depender de archivos externos, aunque el entorno todavía no completa todos los escenarios multi-IPS."
    ],
    conclusiones: [
      dashboard.interoperability.conclusion,
      dashboard.timings.conclusion,
      dashboard.blockchainPerformance.conclusion
    ],
    aportes: DOCUMENTACION_BASE.aportes,
    limitaciones: dashboard.compliance.limitations?.length
      ? dashboard.compliance.limitations
      : DOCUMENTACION_BASE.limitaciones,
    trabajoFuturo: DOCUMENTACION_BASE.trabajoFuturo
  };
}

/** Notas explicativas por métrica de timing — qué mide y cómo mejorarla */
const TIMING_NOTES: Record<string, string> = {
  "Consulta de metadatos on-chain":
    "Tiempo de leer el registro de trazabilidad (hash, eventId, versión) para el episodio. " +
    "En modo mock es una lectura de archivo local; en blockchain real incluye latencia RPC (~13 s/bloque). " +
    "Mejora: activar modo blockchain real y sembrar episodios con trazas (seed:eval-demo).",
  "Acceso a documento off-chain":
    "Tiempo de recuperar el documento clínico desde HAPI FHIR o el almacén en memoria del prototipo. " +
    "Sin FHIR real (docker compose up -d) los tiempos son sub-milisegundo pues se usa memoria. " +
    "Mejora: conectar HAPI FHIR y sembrar episodios con documentos reales.",
  "Verificación de integridad":
    "Tiempo de calcular el hash SHA-256 del documento off-chain y compararlo con el hash registrado en trazabilidad. " +
    "Siempre produce muestras porque el cálculo ocurre localmente. Si aparecen 0 muestras, " +
    "el episodio no tiene trazas; ejecute seed:eval-demo con SEED_ALL_TRACE_EVENTS=1."
};

function TimingCard({ title, summary }: { title: string; summary: TimingOperationSummary }) {
  const note = TIMING_NOTES[title];
  return (
    <article className="metric-card">
      <strong>{title}</strong>
      <span style={{ fontSize: "0.75rem", color: summary.samples > 0 ? "#555" : "#c00" }}>
        Muestras: {summary.samples > 0 ? summary.samples : "0 — sin datos (poblar episodios)"}
      </span>
      <span>Promedio: {formatMs(summary.averageMs)}</span>
      <span>Mín/Máx: {formatMs(summary.minMs)} / {formatMs(summary.maxMs)}</span>
      <span>Desviación: {formatMs(summary.standardDeviationMs)}</span>
      <div className={statusChipClass(summary.consistency === "alta" ? "cumple" : summary.consistency === "media" ? "parcial" : "pendiente")}>
        Consistencia {summary.consistency}
      </div>
      {note && (
        <p style={{ fontSize: "0.7rem", color: "#888", marginTop: 6, lineHeight: 1.5 }}>
          ℹ️ {note}
        </p>
      )}
    </article>
  );
}

export function EvaluacionPrototipoPage() {
  const { sesion } = useSesion();
  const [dashboard, setDashboard] = useState<DashboardEvaluacionPrototipo | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const documentation = buildDocumentation(dashboard);

  const cargar = async () => {
    setLoading(true);
    setError(null);
    const result = await obtenerDashboardEvaluacion(sesion, 3);
    if (!result.ok || !result.data) {
      setDashboard(null);
      setMessage("Mostrando documentación local sin depender del backend de evaluación.");
      setError(result.message);
      setLoading(false);
      return;
    }
    setDashboard(result.data);
    setMessage(result.message);
    setLoading(false);
  };

  useEffect(() => {
    void cargar();
  }, [sesion]);

  return (
    <>
      <nav aria-label="Migas de pan" className="breadcrumb">
        <Link to="/portal">Panel</Link>{" / Evaluación"}
      </nav>

      <div className="page-header">
        <div className="page-header__row">
          <div>
            <h1 className="page-title">Evaluación y documentación</h1>
            <p className="page-subtitle">
              Validación de interoperabilidad, tiempos, blockchain, integridad y cumplimiento HCE.
            </p>
          </div>
          <div className="context-note">
            <strong>{sesion?.nombre ?? "Auditoría"}</strong>
            <span>{dashboard?.overview.totalEpisodes ?? 0} episodio(s)</span>
            <small>{dashboard ? formatDate(dashboard.generatedAt) : "Cargando"}</small>
          </div>
        </div>
      </div>

      <section className="card card--elevated" style={{ marginBottom: 16 }}>
        <div className="btn-group audit-anchor-nav">
          <a href="#hu0-hu2" className="btn btn--ghost">Interoperabilidad y eficiencia</a>
          <a href="#hu3-hu4" className="btn btn--ghost">Integridad y cumplimiento</a>
          <a href="#hu5-documentacion" className="btn btn--primary">Documentación</a>
          <button type="button" className="btn btn--secondary" onClick={cargar} disabled={loading}>
            {loading ? "Actualizando..." : "Actualizar dashboard"}
          </button>
        </div>
      </section>

      {message && <div className="alert alert--info" style={{ marginBottom: 16 }}>{message}</div>}
      {error && <div className="alert alert--error" style={{ marginBottom: 16 }}>{error}</div>}

      {dashboard && (
        <>
          <div className="dashboard-grid" style={{ marginBottom: 16 }}>
            <article className="metric-card">
              <strong>HU0-E6</strong>
              <span>{dashboard.interoperability.summary.crossIpsScenarios} escenario(s) multi-IPS</span>
              <span>{dashboard.interoperability.summary.episodesWithContinuity} episodio(s) con continuidad</span>
            </article>
            <article className="metric-card">
              <strong>HU1-E6</strong>
              <span>{formatMs(dashboard.timings.operations.metadataOnChain.averageMs)} metadatos</span>
              <span>{formatMs(dashboard.timings.operations.integrityVerification.averageMs)} integridad</span>
            </article>
            <article className="metric-card">
              <strong>HU2-E6</strong>
              <span>Modo {dashboard.blockchainPerformance.mode}</span>
              <span>{dashboard.blockchainPerformance.mostExpensiveOperation ?? "Sin operación destacada"}</span>
            </article>
            <article className="metric-card">
              <strong>HU3-E6 / HU4-E6</strong>
              <span>{dashboard.audit.integrityValidEpisodes} episodio(s) íntegros</span>
              <span>{dashboard.compliance.hceModel.validEpisodes} episodio(s) válidos frente al modelo HCE</span>
            </article>
          </div>

          <section id="hu0-hu2" className="card card--elevated" style={{ marginBottom: 16 }}>
            <div className="section-head section-head--tight">
              <div>
                <h2 className="section-title">HU0-E6, HU1-E6 y HU2-E6</h2>
                <p className="section-copy">
                  Validación del flujo entre IPS, medición de acceso clínico y evaluación de costo/rendimiento blockchain.
                </p>
              </div>
            </div>

            <div className="result-panel" style={{ marginBottom: 16 }}>
              <div>
                <strong>Interoperabilidad</strong>
                <span>{dashboard.interoperability.conclusion}</span>
              </div>
              <div>
                <strong>Tiempos</strong>
                <span>{dashboard.timings.conclusion}</span>
              </div>
              <div>
                <strong>Blockchain</strong>
                <span>{dashboard.blockchainPerformance.conclusion}</span>
              </div>
            </div>

            <div className="dashboard-grid" style={{ marginBottom: 16 }}>
              <article className="metric-card">
                <strong>IPS simuladas</strong>
                <span>{dashboard.interoperability.simulatedIps.length} configurada(s)</span>
                <div className={dashboard.interoperability.multipleIpsReady ? "status-chip status-chip--ready" : "status-chip"}>
                  {dashboard.interoperability.multipleIpsReady ? "Modo multi-IPS activo" : "Pendiente de configurar"}
                </div>
              </article>
              <article className="metric-card">
                <strong>Permisos y continuidad</strong>
                <span>{dashboard.interoperability.summary.episodesWithPermissionFlow} episodio(s) con flujo de permisos</span>
                <span>{dashboard.interoperability.summary.consistentEpisodes} consistente(s)</span>
              </article>
              <article className="metric-card">
                <strong>Transacciones auditables</strong>
                <span>{dashboard.audit.totalEvents} evento(s) registrados</span>
                <span>{dashboard.blockchainPerformance.metricKind} como origen métrico</span>
              </article>
            </div>

            <div className="section-block">
              <h3 className="section-title">Tiempos medidos</h3>
              <div className="dashboard-grid" style={{ marginTop: "0.85rem", marginBottom: 16 }}>
                <TimingCard title="Consulta de metadatos on-chain" summary={dashboard.timings.operations.metadataOnChain} />
                <TimingCard title="Acceso a documento off-chain" summary={dashboard.timings.operations.documentOffChain} />
                <TimingCard title="Verificación de integridad" summary={dashboard.timings.operations.integrityVerification} />
              </div>
            </div>

            <div className="section-block">
              <h3 className="section-title">Escenarios de interoperabilidad observados</h3>
              <div className="table-wrapper" style={{ marginTop: "0.85rem" }}>
                <table className="tabla-clinica">
                  <thead>
                    <tr>
                      <th>Episodio</th>
                      <th>IPS involucradas</th>
                      <th>Versiones</th>
                      <th>Permisos activos</th>
                      <th>Integridad</th>
                      <th>Consistencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.interoperability.scenarios.map((item) => (
                      <tr key={item.episodeId}>
                        <td><code>{item.episodeId}</code></td>
                        <td>{item.ipsInvolucradas.join(", ") || item.ownerIpsId || "—"}</td>
                        <td>{item.versionCount}</td>
                        <td>{item.activePermissions}</td>
                        <td>{item.integrityStatus}</td>
                        <td>{item.consistencyStatus}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="section-block">
              <h3 className="section-title">Costo y rendimiento por tipo de transacción</h3>
              <div className="table-wrapper" style={{ marginTop: "0.85rem" }}>
                <table className="tabla-clinica">
                  <thead>
                    <tr>
                      <th>Operación</th>
                      <th>Cantidad</th>
                      <th>Confirmación promedio</th>
                      <th>Gas promedio</th>
                      <th>Costo promedio (wei)</th>
                      <th>Emisor técnico</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.blockchainPerformance.operations.map((item) => (
                      <tr key={item.eventType}>
                        <td>{item.label}</td>
                        <td>{item.count}</td>
                        <td>{formatMs(item.averageConfirmationMs)}</td>
                        <td>{formatCompactNumber(item.averageGasUsed)}</td>
                        <td>{formatCompactNumber(item.averageTransactionCostWei)}</td>
                        <td>{item.emitters.join(", ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section id="hu3-hu4" className="card card--elevated" style={{ marginBottom: 16 }}>
            <div className="section-head section-head--tight">
              <div>
                <h2 className="section-title">HU3-E6 y HU4-E6</h2>
                <p className="section-copy">
                  Integridad, trazabilidad, coherencia del historial y contraste del prototipo frente al modelo HCE y los requisitos del sistema.
                </p>
              </div>
            </div>

            <div className="dashboard-grid" style={{ marginBottom: 16 }}>
              <article className="metric-card">
                <strong>Trazabilidad extremo a extremo</strong>
                <span>{dashboard.audit.endToEndTraceability ? "Completa" : "Con vacíos"}</span>
                <div className={dashboard.audit.endToEndTraceability ? "status-chip status-chip--ready" : "status-chip status-chip--alert"}>
                  {dashboard.audit.totalEvents} evento(s)
                </div>
              </article>
              <article className="metric-card">
                <strong>Historial de versiones</strong>
                <span>{dashboard.audit.versionHistoryComplete ? "Completo" : "Incompleto"}</span>
                <span>{dashboard.audit.integrityValidEpisodes} episodio(s) íntegros</span>
              </article>
              <article className="metric-card">
                <strong>Modelo HCE</strong>
                <span>{dashboard.compliance.hceModel.validEpisodes} válido(s)</span>
                <span>{dashboard.compliance.hceModel.invalidEpisodes} con observaciones</span>
              </article>
            </div>

            <div className="section-block">
              <h3 className="section-title">Actores observados en la auditoría</h3>
              <div className="table-wrapper" style={{ marginTop: "0.85rem", marginBottom: 16 }}>
                <table className="tabla-clinica">
                  <thead>
                    <tr>
                      <th>Rol</th>
                      <th>Eventos</th>
                      <th>IPS observadas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.audit.observedActors.map((item) => (
                      <tr key={item.rol}>
                        <td>{item.rol}</td>
                        <td>{item.totalEventos}</td>
                        <td>{item.ipsIds.join(", ") || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="section-block">
              <h3 className="section-title">Requisitos validados</h3>
              <div className="stack-list" style={{ marginTop: "0.85rem" }}>
                {dashboard.compliance.requirements.map((item) => (
                  <article key={item.requirementId} className="stack-item">
                    <strong>{item.requirementId} · {item.label}</strong>
                    <span>{item.detail}</span>
                    <div className={statusChipClass(item.status)}>{item.status}</div>
                  </article>
                ))}
              </div>
            </div>

            {!!dashboard.audit.episodesWithIssues.length && (
              <div className="section-block">
                <h3 className="section-title">Hallazgos que requieren revisión</h3>
                <div className="stack-list" style={{ marginTop: "0.85rem" }}>
                  {dashboard.audit.episodesWithIssues.map((item) => (
                    <article key={`${item.episodeId}-${item.issue}`} className="stack-item">
                      <strong>{item.episodeId}</strong>
                      <span>{item.issue}</span>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </section>

        </>
      )}

          <section id="hu5-documentacion" className="card card--elevated" style={{ marginBottom: 16 }}>
            <div className="section-head section-head--tight">
              <div>
                <h2 className="section-title">HU5-E6. Documentación del prototipo</h2>
                <p className="section-copy">
                  Apartado de documentación disponible desde auditoría con resultados estructurados, conclusiones, aportes, limitaciones y trabajo futuro.
                </p>
              </div>
              <div className="status-chip status-chip--ready">Auditoría documental</div>
            </div>

            <div className="documentation-grid">
              <article className="documentation-block">
                <h3>Resumen ejecutivo</h3>
                <ul>
                  {documentation.resumenEjecutivo.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
              <article className="documentation-block">
                <h3>Conclusiones</h3>
                <ul>
                  {documentation.conclusiones.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
              <article className="documentation-block">
                <h3>Aportes del modelo</h3>
                <ul>
                  {documentation.aportes.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
              <article className="documentation-block">
                <h3>Limitaciones</h3>
                <ul>
                  {documentation.limitaciones.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
              <article className="documentation-block">
                <h3>Trabajo futuro</h3>
                <ul>
                  {documentation.trabajoFuturo.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            </div>
          </section>
    </>
  );
}

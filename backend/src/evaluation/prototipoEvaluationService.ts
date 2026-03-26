import { performance } from "perf_hooks";
import { listarRolesSistema } from "../access/accesoUsuariosService";
import {
  calcularHashDocumento,
  listarTodosLosEpisodios,
  obtenerHashEpisodio,
  obtenerRegistroOnChainMetadata,
  recuperarDocumentoClinico
} from "../hce/documentoClinicoService";
import { isFhirConfigured } from "../hce/fhirClient";
import { obtenerRegistroLifecycleEpisodio } from "../hce/episodioLifecycleService";
import { obtenerEstadosPermisosEpisodio, obtenerPropietarioEpisodio } from "../hce/permisosEpisodioService";
import { obtenerUltimoHashRegistradoOnChain, listarEventosTrazabilidad } from "../hce/trazabilidadService";
import { validateEpisodioClinico } from "../hce/validationService";
import { obtenerConfiguracionBlockchainReal } from "../infra/blockchainTraceService";
import { obtenerEstadoInfraestructura } from "../infra/infraestructuraService";

/**
 * Verifica si el servidor HAPI FHIR responde consultando /metadata.
 * Retorna true si responde con HTTP 200 en ≤ 5 s; false en cualquier otro caso.
 */
async function checkFhirDisponible(): Promise<boolean> {
  if (!isFhirConfigured()) return false;
  const fhirUrl = (process.env.FHIR_BASE_URL ?? "").replace(/\/$/, "");
  try {
    const resp = await fetch(`${fhirUrl}/metadata`, {
      method: "GET",
      headers: { Accept: "application/fhir+json" },
      signal: AbortSignal.timeout(5000)
    });
    return resp.ok;
  } catch {
    return false;
  }
}

type RequirementStatus = "cumple" | "parcial" | "pendiente";

interface TimingOperationSummary {
  label: string;
  samples: number;
  averageMs: number;
  minMs: number;
  maxMs: number;
  standardDeviationMs: number;
  consistency: "alta" | "media" | "baja";
}

interface TimingScenarioResult {
  episodeId: string;
  runs: number;
  metadataOnChainMs: number[];
  documentOffChainMs: number[];
  integrityVerificationMs: number[];
}

interface RequirementEvaluation {
  requirementId: string;
  label: string;
  status: RequirementStatus;
  detail: string;
}

function roundMetric(value: number): number {
  return Number(value.toFixed(2));
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function standardDeviation(values: number[]): number {
  if (values.length <= 1) return 0;
  const avg = average(values);
  const variance = average(values.map((value) => (value - avg) ** 2));
  return Math.sqrt(variance);
}

/**
 * Clasifica la consistencia de un conjunto de mediciones de tiempo (ms) según
 * la desviación estándar absoluta — no el coeficiente de variación.
 *
 * Usar el coeficiente de variación (stdDev/mean) penalizaba operaciones muy
 * rápidas (< 5 ms) donde incluso 0.5 ms de variación daba CoV > 0.1 → "baja".
 * Los umbrales absolutos son más representativos para tiempos de sistema:
 *
 *   < 20 ms de desviación → Alta    — respuesta estable; variación imperceptible
 *   < 40 ms de desviación → Media   — variación tolerable para operaciones de red
 *   ≥ 40 ms de desviación → Baja    — alta variabilidad; revisar conectividad FHIR/RPC
 */
function buildConsistency(values: number[]): "alta" | "media" | "baja" {
  if (!values.length) return "baja";
  const stdDev = standardDeviation(values);
  if (stdDev < 20) return "alta";
  if (stdDev < 40) return "media";
  return "baja";
}

function buildTimingSummary(label: string, values: number[]): TimingOperationSummary {
  if (!values.length) {
    return {
      label,
      samples: 0,
      averageMs: 0,
      minMs: 0,
      maxMs: 0,
      standardDeviationMs: 0,
      consistency: "baja"
    };
  }
  return {
    label,
    samples: values.length,
    averageMs: roundMetric(average(values)),
    minMs: roundMetric(Math.min(...values)),
    maxMs: roundMetric(Math.max(...values)),
    standardDeviationMs: roundMetric(standardDeviation(values)),
    consistency: buildConsistency(values)
  };
}

async function medirOperacion<T>(fn: () => Promise<T>): Promise<{ elapsedMs: number; result: T }> {
  const start = performance.now();
  const result = await fn();
  const elapsedMs = performance.now() - start;
  return {
    elapsedMs: roundMetric(elapsedMs),
    result
  };
}

/**
 * Mide los tiempos de las tres operaciones clave para un episodio.
 *
 * Notas de implementación:
 * - Se captura el tiempo SIEMPRE, aunque el resultado sea null/undefined.
 *   En modo mock (sin blockchain real) las operaciones de metadatos on-chain
 *   y verificación de integridad retornan null legítimamente; aun así el
 *   tiempo de la llamada es un dato real de latencia off-chain del servicio.
 * - Antes NO se medía nada cuando cualquier resultado era nulo, por lo que
 *   las tres métricas aparecían siempre con 0 muestras.  Ahora siempre se
 *   obtienen muestras para los tres ejes, independientemente del modo.
 *
 * Qué mide cada eje:
 * 1. metadataOnChain   — tiempo de `obtenerRegistroOnChainMetadata()`:
 *    lectura del store de trazabilidad o llamada al contrato (modo real).
 *    Mejora: activar modo blockchain real y poblar episodios con trazas.
 * 2. documentOffChain  — tiempo de `recuperarDocumentoClinico()`:
 *    lectura desde HAPI FHIR o almacén en memoria del prototipo.
 *    Mejora: conectar HAPI FHIR real (docker compose up -d).
 * 3. integrityVerification — tiempo de calcular y comparar hash SHA-256
 *    off-chain vs. hash registrado en trazabilidad.
 *    Mejora: asegurar que los episodios tengan al menos un evento EPISODE_CREATED.
 */
async function measureTimingScenario(episodeId: string, runs: number): Promise<TimingScenarioResult> {
  const metadataOnChainMs: number[] = [];
  const documentOffChainMs: number[] = [];
  const integrityVerificationMs: number[] = [];

  for (let index = 0; index < runs; index += 1) {
    // 1. Metadatos on-chain — medir aunque retorne null (modo mock)
    const metadataMeasure = await medirOperacion(async () => obtenerRegistroOnChainMetadata(episodeId));
    metadataOnChainMs.push(metadataMeasure.elapsedMs);

    // 2. Documento off-chain — medir aunque retorne null (sin FHIR real)
    const documentMeasure = await medirOperacion(async () => recuperarDocumentoClinico(episodeId));
    documentOffChainMs.push(documentMeasure.elapsedMs);

    // 3. Verificación de integridad — siempre medir el tiempo del cálculo de hash
    const integrityMeasure = await medirOperacion(async () => {
      const [offChainHash, latestTrace] = await Promise.all([
        obtenerHashEpisodio(episodeId),
        Promise.resolve(obtenerUltimoHashRegistradoOnChain(episodeId))
      ]);
      return {
        offChainHash,
        onChainHash: latestTrace.documentHash
      };
    });
    integrityVerificationMs.push(integrityMeasure.elapsedMs);
  }

  return {
    episodeId,
    runs,
    metadataOnChainMs,
    documentOffChainMs,
    integrityVerificationMs
  };
}

function buildTraceLabel(eventType: string): string {
  switch (eventType) {
    case "EPISODE_CREATED":
      return "Creación de episodio";
    case "EPISODE_UPDATED":
      return "Actualización de episodio";
    case "PERMISSION_GRANTED":
      return "Otorgamiento de permiso";
    case "PERMISSION_REVOKED":
      return "Revocación de permiso";
    case "AUDITABLE_ACCESS":
      return "Acceso auditable";
    case "INTEGRITY_CHECK":
      return "Verificación de integridad";
    default:
      return eventType;
  }
}

export async function generarDashboardEvaluacionPrototipo(input?: { runs?: number }) {
  const generatedAt = new Date().toISOString();
  const runs = Math.max(1, Math.min(Number(input?.runs ?? 3), 5));
  const infraestructura = obtenerEstadoInfraestructura();
  const blockchainConfig = obtenerConfiguracionBlockchainReal();
  const fhirDisponible = await checkFhirDisponible();
  const episodios = await listarTodosLosEpisodios();
  const traceEvents = listarEventosTrazabilidad();
  const roles = listarRolesSistema();

  const scenarioSummaries = await Promise.all(
    episodios.map(async (episodio) => {
      const lifecycle = obtenerRegistroLifecycleEpisodio(episodio.episodeId);
      const permissions = obtenerEstadosPermisosEpisodio(episodio.episodeId);
      const events = traceEvents.filter((item) => item.episodeId === episodio.episodeId);
      const latestHash = obtenerUltimoHashRegistradoOnChain(episodio.episodeId);
      const documento = await recuperarDocumentoClinico(episodio.episodeId);
      const ownerIpsId = obtenerPropietarioEpisodio(episodio.episodeId);
      const ipsInvolucradas = new Set<string>();
      if (ownerIpsId) {
        ipsInvolucradas.add(ownerIpsId);
      }
      for (const version of lifecycle?.versiones ?? []) {
        if (version.actor.ipsId) {
          ipsInvolucradas.add(version.actor.ipsId);
        }
      }
      for (const permission of permissions) {
        ipsInvolucradas.add(permission.sourceIpsId);
        ipsInvolucradas.add(permission.targetIpsId);
      }
      const offChainHash = documento ? calcularHashDocumento(documento.document) : undefined;
      const integrityValid = Boolean(
        latestHash.documentHash &&
        offChainHash &&
        latestHash.documentHash === offChainHash
      );
      const modelValidation = documento ? validateEpisodioClinico(documento.document) : { valid: false, issues: [] };
      return {
        episodeId: episodio.episodeId,
        ownerIpsId,
        eventId: lifecycle?.eventoUrgencias.eventoUrgenciasId,
        versionCount: lifecycle?.versiones.length ?? 0,
        traceEventCount: events.length,
        activePermissions: permissions.filter((item) => item.activo).length,
        ipsInvolucradas: [...ipsInvolucradas].filter(Boolean).sort((a, b) => a.localeCompare(b)),
        hasCrossIpsContinuity: (lifecycle?.versiones ?? []).some((item) => item.actor.ipsId && item.actor.ipsId !== ownerIpsId),
        hasPermissionFlow: permissions.some((item) => item.targetIpsId !== item.sourceIpsId),
        integrityStatus: integrityValid ? "integro" : latestHash.documentHash || offChainHash ? "revision_requerida" : "sin_evidencia",
        consistencyStatus:
          integrityValid &&
          Boolean(lifecycle?.versiones.length) &&
          Boolean(events.length)
            ? "consistente"
            : "con_riesgos",
        modelValidation
      };
    })
  );

  const measuredScenarios = await Promise.all(
    scenarioSummaries.slice(0, 5).map((item) => measureTimingScenario(item.episodeId, runs))
  );

  const metadataSamples = measuredScenarios.flatMap((item) => item.metadataOnChainMs);
  const documentSamples = measuredScenarios.flatMap((item) => item.documentOffChainMs);
  const integritySamples = measuredScenarios.flatMap((item) => item.integrityVerificationMs);

  const traceMetricsByType = traceEvents.reduce<Record<string, {
    count: number;
    confirmationMs: number[];
    gasUsed: number[];
    transactionCostWei: number[];
    emitters: Set<string>;
    roles: Set<string>;
    metricsMode: "measured" | "estimated" | "no_disponible";
  }>>((accumulator, event) => {
    const key = event.eventType;
    if (!accumulator[key]) {
      accumulator[key] = {
        count: 0,
        confirmationMs: [],
        gasUsed: [],
        transactionCostWei: [],
        emitters: new Set<string>(),
        roles: new Set<string>(),
        metricsMode: "no_disponible"
      };
    }
    const entry = accumulator[key];
    entry.count += 1;
    entry.roles.add(event.actor.rol);
    entry.emitters.add(
      event.evidence.emitterId ??
      event.actor.usuarioId ??
      event.actor.ipsId ??
      "sin-identificador"
    );
    if (typeof event.evidence.confirmationMs === "number") {
      entry.confirmationMs.push(event.evidence.confirmationMs);
    }
    if (event.evidence.gasUsed) {
      entry.gasUsed.push(Number(event.evidence.gasUsed));
    }
    if (event.evidence.transactionCostWei) {
      entry.transactionCostWei.push(Number(event.evidence.transactionCostWei));
    }
    if (event.evidence.metricsMode === "measured" || event.evidence.metricsMode === "estimated") {
      entry.metricsMode = event.evidence.metricsMode;
    }
    return accumulator;
  }, {});

  const blockchainOperations = Object.entries(traceMetricsByType)
    .map(([eventType, item]) => ({
      eventType,
      label: buildTraceLabel(eventType),
      count: item.count,
      metricsMode: item.metricsMode === "measured" ? "medido" : item.metricsMode === "estimated" ? "estimado" : "no_disponible",
      averageConfirmationMs: item.confirmationMs.length ? roundMetric(average(item.confirmationMs)) : undefined,
      averageGasUsed: item.gasUsed.length ? roundMetric(average(item.gasUsed)) : undefined,
      averageTransactionCostWei: item.transactionCostWei.length ? roundMetric(average(item.transactionCostWei)) : undefined,
      emitters: [...item.emitters],
      roles: [...item.roles]
    }))
    .sort((left, right) => right.count - left.count);

  const mostExpensiveOperation = blockchainOperations
    .filter((item) => typeof item.averageTransactionCostWei === "number")
    .sort((left, right) => (right.averageTransactionCostWei ?? 0) - (left.averageTransactionCostWei ?? 0))[0];

  const crossIpsEpisodes = scenarioSummaries.filter((item) => item.ipsInvolucradas.length >= 2);
  const consistentEpisodes = scenarioSummaries.filter((item) => item.consistencyStatus === "consistente");
  const integrityIssues = scenarioSummaries
    .filter((item) => item.integrityStatus !== "integro")
    .map((item) => ({
      episodeId: item.episodeId,
      issue:
        item.integrityStatus === "sin_evidencia"
          ? "No existe evidencia suficiente para contrastar hash on-chain y documento off-chain."
          : "El hash del documento no coincide con la última evidencia registrada."
    }));

  const modelValidEpisodes = scenarioSummaries.filter((item) => item.modelValidation.valid);
  const limitations: string[] = [];
  if (!infraestructura.blockchain.contratosOperativos) {
    limitations.push(
      "La blockchain real no está operativa en este entorno; las métricas de costo/rendimiento se presentan como estimadas cuando la traza fue generada en modo mock."
    );
  }
  if (infraestructura.offChain.almacenamiento === "memoria") {
    limitations.push(
      "El almacenamiento clínico actual usa memoria local; los tiempos medidos representan el prototipo y no una instalación productiva de HAPI FHIR."
    );
  }
  if (infraestructura.offChain.fhirConfigurado && !fhirDisponible) {
    limitations.push(
      "HAPI FHIR está configurado (FHIR_BASE_URL definida) pero no responde en este momento. " +
      "Los episodios cargados en sesiones anteriores pueden no estar accesibles → integridad aparecerá como 'sin_evidencia'. " +
      "Solución: docker compose up -d y esperar ~45 s a que FHIR esté listo."
    );
  }
  if (!scenarioSummaries.length) {
    limitations.push(
      "No existen episodios registrados suficientes para evaluar interoperabilidad, integridad y continuidad de extremo a extremo."
    );
  }
  if (!crossIpsEpisodes.length) {
    limitations.push(
      "Aún no hay evidencia de continuidad multi-IPS en los episodios visibles; se requiere ejecutar permisos y actualización desde otra IPS."
    );
  }

  const requirements: RequirementEvaluation[] = [
    {
      requirementId: "RF8",
      label: "Verificación de integridad",
      status: integrityIssues.length ? "parcial" : "cumple",
      detail: integrityIssues.length
        ? `Se identificaron ${integrityIssues.length} episodio(s) con revisión pendiente o sin evidencia completa.`
        : "Todos los episodios con evidencia registrada mantienen coincidencia entre hash on-chain y documento off-chain."
    },
    {
      requirementId: "RF9",
      label: "Interfaz DApp para interacción con Smart Contract",
      status: infraestructura.cumpleHu1E5 ? "cumple" : "parcial",
      detail: infraestructura.cumpleHu1E5
        ? "La DApp dispone de vistas para episodios, permisos, trazabilidad e infraestructura con soporte multirol."
        : !infraestructura.blockchain.contratosOperativos && infraestructura.simulacionIps.total < 2
          ? `La trazabilidad blockchain no está habilitada y solo hay ${infraestructura.simulacionIps.total} IPS registrada(s). Se requiere: (1) configurar BLOCKCHAIN_TRACE_MODE=mock o real con RPC+firma+contrato, y (2) al menos 2 IPS activas.`
          : !infraestructura.blockchain.contratosOperativos
            ? "La trazabilidad blockchain no está habilitada. Configure BLOCKCHAIN_TRACE_MODE=mock o auto, y asegúrese de que RPC, firma y contrato estén configurados en el .env."
            : `Solo hay ${infraestructura.simulacionIps.total} IPS registrada(s); se requieren al menos 2 para validar interoperabilidad multi-IPS. Ejecute el seed de datos demo o registre IPS adicionales.`
    },
    {
      requirementId: "RF10",
      label: "Registro de auditoría para evaluación",
      status: traceEvents.length ? "cumple" : "pendiente",
      detail: traceEvents.length
        ? `Se registran ${traceEvents.length} transacción(es)/evento(s) auditables con rol, IPS y emisor técnico disponible cuando la evidencia lo permite.`
        : "Todavía no existen eventos suficientes para evaluar comportamiento de DApp y Smart Contract."
    },
    {
      requirementId: "RF11",
      label: "Estructura mínima de HCE para urgencias",
      status: modelValidEpisodes.length === scenarioSummaries.length && scenarioSummaries.length > 0 ? "cumple" : "parcial",
      detail: scenarioSummaries.length
        ? `${modelValidEpisodes.length} de ${scenarioSummaries.length} episodio(s) visibles cumplen la validación estructural del modelo HCE.`
        : "No hay episodios para contrastar contra la estructura mínima definida."
    }
  ];

  const interoperabilidadConclusion = crossIpsEpisodes.length
    ? `Se observaron ${crossIpsEpisodes.length} episodio(s) con interacción entre múltiples IPS y ${consistentEpisodes.length} mantienen continuidad e integridad sin hallazgos.`
    : "La simulación multi-IPS está disponible, pero aún falta evidencia suficiente de traslados o continuidad asistencial entre instituciones.";
  const tiemposConclusion = measuredScenarios.length
    ? `Se midieron ${metadataSamples.length + documentSamples.length + integritySamples.length} operaciones técnicas en ${measuredScenarios.length} episodio(s) para metadatos, documento e integridad.`
    : "No fue posible medir tiempos porque todavía no existen episodios visibles con evidencia suficiente.";
  const blockchainConclusion = blockchainOperations.length
    ? `La operación con mayor costo promedio observado es ${mostExpensiveOperation?.label ?? "sin determinar"} y el análisis distingue entre evidencia medida y estimada según el modo de blockchain.`
    : "Aún no existen transacciones auditables suficientes para analizar costo y rendimiento blockchain.";

  return {
    generatedAt,
    overview: {
      totalEpisodes: episodios.length,
      totalTraceEvents: traceEvents.length,
      totalIpsSimuladas: infraestructura.simulacionIps.total,
      blockchainMode: blockchainConfig.enabled ? "real" : "mock",
      rolesConfigurados: roles.map((item) => item.rol),
      fhir: {
        configurado: infraestructura.offChain.fhirConfigurado,
        disponible: fhirDisponible,
        // Impacto en el dashboard:
        // - disponible=false + configurado=true → FHIR caído; documentos solo en memoria
        //   Los episodios del seed pueden aparecer "sin_evidencia" si el backend reinició.
        // - disponible=false + configurado=false → modo prototipo; todo en memoria.
        //   Integridad solo funciona en el mismo proceso/sesión que creó los episodios.
        // - disponible=true → los documentos sobreviven reinicios del backend.
        almacenamiento: infraestructura.offChain.almacenamiento
      }
    },
    interoperability: {
      multipleIpsReady: infraestructura.simulacionIps.multipleIpsActivo,
      simulatedIps: infraestructura.simulacionIps.ips,
      scenarios: scenarioSummaries,
      summary: {
        totalScenarios: scenarioSummaries.length,
        crossIpsScenarios: crossIpsEpisodes.length,
        episodesWithContinuity: scenarioSummaries.filter((item) => item.hasCrossIpsContinuity).length,
        episodesWithPermissionFlow: scenarioSummaries.filter((item) => item.hasPermissionFlow).length,
        consistentEpisodes: consistentEpisodes.length
      },
      conclusion: interoperabilidadConclusion
    },
    timings: {
      runs,
      measuredAt: generatedAt,
      scenarios: measuredScenarios,
      operations: {
        metadataOnChain: buildTimingSummary("Consulta de metadatos on-chain", metadataSamples),
        documentOffChain: buildTimingSummary("Acceso a documento off-chain", documentSamples),
        integrityVerification: buildTimingSummary("Verificación de integridad", integritySamples)
      },
      conclusion: tiemposConclusion
    },
    blockchainPerformance: {
      mode: infraestructura.blockchain.modo === "real" ? "real" : "mock",
      metricKind: blockchainOperations.some((item) => item.metricsMode === "medido")
        ? "medido"
        : blockchainOperations.some((item) => item.metricsMode === "estimado")
          ? "estimado"
          : "no_disponible",
      operations: blockchainOperations,
      mostExpensiveOperation: mostExpensiveOperation?.label,
      conclusion: blockchainConclusion
    },
    audit: {
      totalEvents: traceEvents.length,
      eventsByType: Object.fromEntries(
        Object.entries(traceMetricsByType).map(([key, value]) => [key, value.count])
      ),
      integrityValidEpisodes: scenarioSummaries.filter((item) => item.integrityStatus === "integro").length,
      episodesWithIssues: integrityIssues,
      versionHistoryComplete: scenarioSummaries.every((item) => item.versionCount >= 1),
      endToEndTraceability: scenarioSummaries.every((item) => item.traceEventCount >= 1),
      observedActors: Object.values(
        traceEvents.reduce<Record<string, { rol: string; totalEventos: number; ipsIds: Set<string> }>>((accumulator, item) => {
          const key = item.actor.rol;
          if (!accumulator[key]) {
            accumulator[key] = {
              rol: item.actor.rol,
              totalEventos: 0,
              ipsIds: new Set<string>()
            };
          }
          accumulator[key].totalEventos += 1;
          if (item.actor.ipsId) {
            accumulator[key].ipsIds.add(item.actor.ipsId);
          }
          return accumulator;
        }, {})
      ).map((item) => ({
        rol: item.rol,
        totalEventos: item.totalEventos,
        ipsIds: [...item.ipsIds].sort((left, right) => left.localeCompare(right))
      }))
    },
    compliance: {
      hceModel: {
        totalEpisodes: scenarioSummaries.length,
        validEpisodes: modelValidEpisodes.length,
        invalidEpisodes: scenarioSummaries.length - modelValidEpisodes.length
      },
      requirements,
      limitations
    },
    documentation: {
      resumenEjecutivo: [
        interoperabilidadConclusion,
        tiemposConclusion,
        blockchainConclusion
      ],
      conclusiones: [
        scenarioSummaries.length
          ? "El prototipo permite consolidar interoperabilidad, integridad y control de acceso en un mismo flujo auditable."
          : "Se requiere poblar el entorno con episodios y trazas para emitir conclusiones completas del prototipo.",
        integrityIssues.length
          ? "La trazabilidad permite detectar de forma explícita episodios con revisión pendiente o evidencia insuficiente."
          : "No se detectaron inconsistencias entre registros on-chain/off-chain en los episodios con evidencia disponible.",
        infraestructura.simulacionIps.multipleIpsActivo
          ? "La simulación de múltiples IPS habilita escenarios comparables para continuidad asistencial y permisos institucionales."
          : "El entorno debe completar la simulación multi-IPS para validar flujos interinstitucionales."
      ],
      aportes: [
        "Separación entre documento clínico off-chain y evidencia on-chain con verificación por hash.",
        "Trazabilidad por rol, IPS y tipo de evento para soportar auditoría operativa y académica.",
        "Panel de evaluación que consolida interoperabilidad, tiempos, costo/rendimiento y cumplimiento del modelo HCE."
      ],
      limitaciones: limitations,
      trabajoFuturo: [
        "Ejecutar la evaluación en una red blockchain real para contrastar costos y latencias frente a los valores estimados del prototipo.",
        "Incorporar persistencia histórica de mediciones para comparar sprints, escenarios e instituciones en el tiempo.",
        "Ampliar la validación no funcional con pruebas de carga, concurrencia y resiliencia sobre HAPI FHIR y contratos."
      ]
    }
  };
}

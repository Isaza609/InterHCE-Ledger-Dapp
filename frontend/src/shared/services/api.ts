import { API_BASE_URL } from "@/shared/utils/constants";
import {
  leerSesion,
  type SesionUsuario
} from "@/shared/auth/sessionStorage";
import type {
  BusquedaTrazabilidad,
  ContinuidadEpisodio,
  EpisodioPayload,
  EstadoPermisoEpisodio,
  EventoUrgencias,
  IntegridadEpisodio,
  OnChainMetadata,
  TraceabilityEvent,
  ValidationResult,
  VersionEpisodio
} from "@/shared/types/episodio";

const authBase = `${API_BASE_URL}/auth`;
const accessBase = `${API_BASE_URL}/access`;
const episodesBase = `${API_BASE_URL}/episodes`;
const infraBase = `${API_BASE_URL}/infra`;
const evaluationBase = `${API_BASE_URL}/evaluation`;
const ipsBase = `${API_BASE_URL}/ips`;

const CONNECTION_ERROR = `No se pudo conectar con el backend. Compruebe que esté en ejecución (puerto 3001) y que la URL sea correcta. URL actual: ${API_BASE_URL}`;

async function parseJson<T>(res: Response): Promise<T> {
  return res.json().catch(() => ({} as T));
}

function normalizeValidationDetails(
  details: unknown
): Array<{ field: string; issue: string }> {
  if (!Array.isArray(details)) {
    return [];
  }
  return details
    .filter((item): item is { field?: unknown; issue?: unknown } => Boolean(item && typeof item === "object"))
    .map((item) => ({
      field: typeof item.field === "string" ? item.field : "general",
      issue: typeof item.issue === "string" ? item.issue : "Error de validación."
    }));
}


function buildApiMessage(
  data: { message?: string; code?: string; details?: unknown } | undefined,
  fallback: string
): string {
  if (data?.message?.trim()) return data.message.trim();
  if (typeof data?.details === "string" && data.details.trim()) return data.details.trim();
  return fallback;
}

function getAlternativeApiUrl(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "http:") return null;
    if (parsed.hostname === "localhost") {
      parsed.hostname = "127.0.0.1";
      return parsed.toString();
    }
    if (parsed.hostname === "127.0.0.1") {
      parsed.hostname = "localhost";
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchApi(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const primaryUrl = typeof input === "string" || input instanceof URL ? String(input) : input.url;
  try {
    return await fetch(input, init);
  } catch (primaryError) {
    const fallbackUrl = getAlternativeApiUrl(primaryUrl);
    if (!fallbackUrl) throw primaryError;
    return fetch(fallbackUrl, init);
  }
}

function buildActorHeaders(sesion?: SesionUsuario | null): Record<string, string> {
  const current = sesion ?? leerSesion();
  if (!current) return {};
  return {
    Authorization: `Bearer ${current.token}`,
    "x-user-role": current.rol,
    "x-user-id": current.usuarioId,
    ...(current.ipsId ? { "x-ips-id": current.ipsId } : {})
  };
}

export async function iniciarSesionDapp(input: {
  correo: string;
  password: string;
  usuarioId?: string;
}): Promise<{ ok: boolean; message: string; session?: SesionUsuario; requiereCambioPassword?: boolean }> {
  try {
    const res = await fetchApi(`${authBase}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input)
    });
    const data = await parseJson<{
      code?: string;
      message?: string;
      session?: SesionUsuario;
      requiereCambioPassword?: boolean;
    }>(res);
    return {
      ok: res.ok,
      message: data.message ?? (res.ok ? "Sesión iniciada." : "No fue posible iniciar sesión."),
      session: data.session,
      requiereCambioPassword: data.requiereCambioPassword ?? false
    };
  } catch {
    return { ok: false, message: CONNECTION_ERROR };
  }
}

export async function obtenerSesionActual(
  sesion?: SesionUsuario | null
): Promise<SesionUsuario | null> {
  const current = sesion ?? leerSesion();
  if (!current) return null;
  try {
    const res = await fetchApi(`${authBase}/me`, {
      headers: buildActorHeaders(current)
    });
    if (!res.ok) return null;
    const data = await parseJson<{ session?: SesionUsuario }>(res);
    return data.session ?? null;
  } catch {
    return null;
  }
}

export async function cerrarSesionDapp(
  sesion?: SesionUsuario | null
): Promise<void> {
  const current = sesion ?? leerSesion();
  if (!current) return;
  try {
    await fetchApi(`${authBase}/logout`, {
      method: "POST",
      headers: buildActorHeaders(current)
    });
  } catch {
    // El frontend siempre debe poder limpiar la sesión local.
  }
}

export async function validarEpisodio(
  payload: EpisodioPayload
): Promise<ValidationResult> {
  try {
    const res = await fetchApi(`${episodesBase}/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await parseJson<{
      message?: string;
      details?: { field: string; issue: string }[];
      data?: EpisodioPayload;
    }>(res);
    if (res.ok) {
      return { valid: true, message: data.message, data: data.data };
    }
    return {
      valid: false,
      message: data.message ?? "Error de validación",
      details: normalizeValidationDetails(data.details)
    };
  } catch {
    return { valid: false, message: CONNECTION_ERROR, details: [] };
  }
}

export async function registrarEpisodio(
  payload: EpisodioPayload,
  sesion?: SesionUsuario | null
): Promise<ValidationResult> {
  try {
    const res = await fetchApi(episodesBase, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...buildActorHeaders(sesion)
      },
      body: JSON.stringify(payload)
    });
    const data = await parseJson<{
      message?: string;
      details?: { field: string; issue: string }[] | string;
      data?: EpisodioPayload;
      episodeId?: string;
      documentHash?: string;
      version?: number;
      event?: EventoUrgencias;
      onChainMetadata?: OnChainMetadata;
      traceEvent?: TraceabilityEvent;
      fhirPersistWarning?: string;
      pacienteAutoCreacionError?: string;
    }>(res);
    if (res.ok) {
      return {
        valid: true,
        message: data.message,
        data: data.data,
        episodeId: data.episodeId,
        documentHash: data.documentHash,
        version: data.version,
        event: data.event,
        onChainMetadata: data.onChainMetadata,
        traceEvent: data.traceEvent,
        fhirPersistWarning:
          typeof data.fhirPersistWarning === "string" ? data.fhirPersistWarning : undefined,
        pacienteAutoCreacionError:
          typeof data.pacienteAutoCreacionError === "string"
            ? data.pacienteAutoCreacionError
            : undefined
      };
    }
    return {
      valid: false,
      message: buildApiMessage(data, "Error al registrar"),
      details: normalizeValidationDetails(data.details)
    };
  } catch {
    return { valid: false, message: CONNECTION_ERROR, details: [] };
  }
}

export async function actualizarEpisodio(
  episodeId: string,
  payload: EpisodioPayload,
  sesion?: SesionUsuario | null
): Promise<ValidationResult> {
  try {
    const res = await fetchApi(`${episodesBase}/${encodeURIComponent(episodeId)}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...buildActorHeaders(sesion)
      },
      body: JSON.stringify(payload)
    });
    const data = await parseJson<{
      message?: string;
      details?: { field: string; issue: string }[] | string;
      data?: EpisodioPayload;
      episodeId?: string;
      documentHash?: string;
      version?: number;
      event?: EventoUrgencias;
      onChainMetadata?: OnChainMetadata;
      traceEvent?: TraceabilityEvent;
      fhirPersistWarning?: string;
    }>(res);
    if (res.ok) {
      return {
        valid: true,
        message: data.message,
        data: data.data,
        episodeId: data.episodeId,
        documentHash: data.documentHash,
        version: data.version,
        event: data.event,
        onChainMetadata: data.onChainMetadata,
        traceEvent: data.traceEvent,
        fhirPersistWarning:
          typeof data.fhirPersistWarning === "string" ? data.fhirPersistWarning : undefined
      };
    }
    return {
      valid: false,
      message: buildApiMessage(data, "Error al actualizar"),
      details: normalizeValidationDetails(data.details)
    };
  } catch {
    return { valid: false, message: CONNECTION_ERROR, details: [] };
  }
}

export interface EpisodioResumen {
  episodeId: string;
  documentHash?: string;
  patientIdentifier?: string;
  patientName?: string;
  patientBirthDate?: string;
  encounterStart?: string;
  encounterStatus?: string;
  prestadorOrigenId?: string;
  ownerIpsId?: string;
  accessScope?: "propio" | "autorizado" | "auditoria";
}

export async function listarTodosLosEpisodios(
  sesion?: SesionUsuario | null
): Promise<{ episodes: EpisodioResumen[]; message: string }> {
  const res = await fetchApi(`${episodesBase}/list`, {
    headers: buildActorHeaders(sesion)
  });
  const data = await parseJson<{
    message?: string;
    episodes?: EpisodioResumen[];
  }>(res);
  if (!res.ok) {
    return { episodes: [], message: data.message ?? "Error al listar" };
  }
  return {
    episodes: data.episodes ?? [],
    message: data.message ?? ""
  };
}

export async function buscarEpisodiosPorPaciente(
  patientIdentifier: string,
  sesion?: SesionUsuario | null
): Promise<{ episodes: EpisodioResumen[]; message: string }> {
  const res = await fetchApi(
    `${episodesBase}?${new URLSearchParams({ patientIdentifier: patientIdentifier.trim() })}`,
    { headers: buildActorHeaders(sesion) }
  );
  const data = await parseJson<{
    message?: string;
    episodes?: EpisodioResumen[];
  }>(res);
  if (!res.ok) {
    return { episodes: [], message: data.message ?? "Error al buscar" };
  }
  return {
    episodes: data.episodes ?? [],
    message: data.message ?? ""
  };
}

export async function obtenerDocumentoEpisodio(
  episodeId: string,
  sesion?: SesionUsuario | null
): Promise<{
  episodeId: string;
  hash: string;
  createdAt: string;
  document: EpisodioPayload;
  auditTrace?: TraceabilityEvent;
} | null> {
  const res = await fetchApi(`${episodesBase}/${encodeURIComponent(episodeId)}/document`, {
    headers: buildActorHeaders(sesion)
  });
  if (!res.ok) return null;
  return parseJson<{
    episodeId: string;
    hash: string;
    createdAt: string;
    document: EpisodioPayload;
    auditTrace?: TraceabilityEvent;
  }>(res);
}

export async function obtenerEventoEpisodio(
  episodeId: string,
  sesion?: SesionUsuario | null
): Promise<EventoUrgencias | null> {
  const res = await fetchApi(`${episodesBase}/${encodeURIComponent(episodeId)}/event`, {
    headers: buildActorHeaders(sesion)
  });
  if (!res.ok) return null;
  const data = await parseJson<{ data?: EventoUrgencias }>(res);
  return data.data ?? null;
}

export async function obtenerVersionesEpisodio(
  episodeId: string,
  sesion?: SesionUsuario | null
): Promise<VersionEpisodio[]> {
  const res = await fetchApi(`${episodesBase}/${encodeURIComponent(episodeId)}/versions`, {
    headers: buildActorHeaders(sesion)
  });
  if (!res.ok) return [];
  const data = await parseJson<{ versions?: VersionEpisodio[] }>(res);
  return data.versions ?? [];
}

export async function obtenerTrazabilidadEpisodio(
  episodeId: string,
  sesion?: SesionUsuario | null
): Promise<{
  episodeId: string;
  event: EventoUrgencias;
  versiones: VersionEpisodio[];
  permisosActivos: string[];
  estadosPermisos: EstadoPermisoEpisodio[];
  traceEvents: TraceabilityEvent[];
  continuidad?: ContinuidadEpisodio;
} | null> {
  const res = await fetchApi(`${episodesBase}/${encodeURIComponent(episodeId)}/traceability`, {
    headers: buildActorHeaders(sesion)
  });
  if (!res.ok) return null;
  const data = await parseJson<{
    data?: {
      episodeId: string;
      eventoUrgencias: EventoUrgencias;
      versiones: VersionEpisodio[];
      permisosActivos: string[];
      estadosPermisos: EstadoPermisoEpisodio[];
      traceEvents: TraceabilityEvent[];
      continuidad?: ContinuidadEpisodio;
    };
  }>(res);
  if (!data.data) return null;
  return {
    episodeId: data.data.episodeId,
    event: data.data.eventoUrgencias,
    versiones: data.data.versiones,
    permisosActivos: data.data.permisosActivos,
    estadosPermisos: data.data.estadosPermisos,
    traceEvents: data.data.traceEvents,
    continuidad: data.data.continuidad
  };
}

export async function verificarIntegridadEpisodio(
  episodeId: string,
  sesion?: SesionUsuario | null
): Promise<IntegridadEpisodio | null> {
  const res = await fetchApi(`${episodesBase}/${encodeURIComponent(episodeId)}/integrity`, {
    headers: buildActorHeaders(sesion)
  });
  if (!res.ok) return null;
  const data = await parseJson<{ data?: IntegridadEpisodio }>(res);
  return data.data ?? null;
}

export interface IpsSimulada {
  ipsId: string;
  nombre: string;
  repsCodigo: string;
}

export interface EstadoInfraestructura {
  backend: {
    status: "ok";
    timestamp: string;
  };
  blockchain: {
    red: string;
    chainId: number;
    contratosOperativos: boolean;
    modo: "no_disponible" | "real";
    contractAddress?: string;
    backendSignerConfigured: boolean;
    backendRpcConfigured: boolean;
    rpcReachable?: boolean;
    lastBlockNumber?: number;
    checkedAt?: string;
    healthMessage?: string;
  };
  offChain: {
    fhirConfigurado: boolean;
    almacenamiento: "hapi-fhir" | "memoria";
  };
  simulacionIps: {
    total: number;
    ips: IpsSimulada[];
    multipleIpsActivo: boolean;
  };
  cumpleHu1E5: boolean;
}

export interface TimingOperationSummary {
  label: string;
  samples: number;
  averageMs: number;
  minMs: number;
  maxMs: number;
  standardDeviationMs: number;
  consistency: "alta" | "media" | "baja";
}

export interface DashboardEvaluacionPrototipo {
  generatedAt: string;
  overview: {
    totalEpisodes: number;
    totalTraceEvents: number;
    totalIpsSimuladas: number;
    blockchainMode: "real" | "mock";
    rolesConfigurados: string[];
  };
  interoperability: {
    multipleIpsReady: boolean;
    simulatedIps: IpsSimulada[];
    scenarios: Array<{
      episodeId: string;
      ownerIpsId?: string;
      eventId?: string;
      versionCount: number;
      traceEventCount: number;
      activePermissions: number;
      ipsInvolucradas: string[];
      hasCrossIpsContinuity: boolean;
      hasPermissionFlow: boolean;
      integrityStatus: "integro" | "revision_requerida" | "sin_evidencia";
      consistencyStatus: "consistente" | "con_riesgos";
      modelValidation: {
        valid: boolean;
        issues?: Array<{ field: string; issue: string }>;
      };
    }>;
    summary: {
      totalScenarios: number;
      crossIpsScenarios: number;
      episodesWithContinuity: number;
      episodesWithPermissionFlow: number;
      consistentEpisodes: number;
    };
    conclusion: string;
  };
  timings: {
    runs: number;
    measuredAt: string;
    scenarios: Array<{
      episodeId: string;
      runs: number;
      metadataOnChainMs: number[];
      documentOffChainMs: number[];
      integrityVerificationMs: number[];
    }>;
    operations: {
      metadataOnChain: TimingOperationSummary;
      documentOffChain: TimingOperationSummary;
      integrityVerification: TimingOperationSummary;
    };
    conclusion: string;
  };
  blockchainPerformance: {
    mode: "real" | "mock";
    metricKind: "medido" | "estimado" | "no_disponible";
    operations: Array<{
      eventType: string;
      label: string;
      count: number;
      metricsMode: "medido" | "estimado" | "no_disponible";
      averageConfirmationMs?: number;
      averageGasUsed?: number;
      averageTransactionCostWei?: number;
      emitters: string[];
      roles: string[];
    }>;
    mostExpensiveOperation?: string;
    conclusion: string;
  };
  audit: {
    totalEvents: number;
    eventsByType: Record<string, number>;
    integrityValidEpisodes: number;
    episodesWithIssues: Array<{ episodeId: string; issue: string }>;
    versionHistoryComplete: boolean;
    endToEndTraceability: boolean;
    observedActors: Array<{
      rol: string;
      totalEventos: number;
      ipsIds: string[];
    }>;
  };
  compliance: {
    hceModel: {
      totalEpisodes: number;
      validEpisodes: number;
      invalidEpisodes: number;
    };
    requirements: Array<{
      requirementId: string;
      label: string;
      status: "cumple" | "parcial" | "pendiente";
      detail: string;
    }>;
    limitations: string[];
  };
  documentation: {
    resumenEjecutivo: string[];
    conclusiones: string[];
    aportes: string[];
    limitaciones: string[];
    trabajoFuturo: string[];
  };
}

export async function obtenerEstadoInfraestructura(
  sesion?: SesionUsuario | null
): Promise<EstadoInfraestructura | null> {
  const res = await fetchApi(`${infraBase}/status`, {
    headers: buildActorHeaders(sesion)
  });
  if (!res.ok) return null;
  const data = await parseJson<{ data?: EstadoInfraestructura }>(res);
  return data.data ?? null;
}

export async function obtenerDashboardEvaluacion(
  sesion?: SesionUsuario | null,
  runs = 3
): Promise<{ ok: boolean; message: string; data?: DashboardEvaluacionPrototipo }> {
  try {
    const params = new URLSearchParams();
    params.set("runs", String(runs));
    const res = await fetchApi(`${evaluationBase}/dashboard?${params.toString()}`, {
      headers: buildActorHeaders(sesion)
    });
    const data = await parseJson<{ code?: string; message?: string; details?: unknown; data?: DashboardEvaluacionPrototipo }>(res);
    if (!res.ok || !data.data) {
      return {
        ok: false,
        message: buildApiMessage(data, "No fue posible generar el dashboard de evaluación del prototipo.")
      };
    }
    return {
      ok: true,
      message: data.message ?? "Dashboard de evaluación recuperado.",
      data: data.data
    };
  } catch {
    return { ok: false, message: CONNECTION_ERROR };
  }
}

export async function configurarIpsInfra(
  ips: IpsSimulada[],
  sesion?: SesionUsuario | null
): Promise<{ ok: boolean; message: string }> {
  const res = await fetchApi(`${infraBase}/ips`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...buildActorHeaders(sesion)
    },
    body: JSON.stringify({ ips })
  });
  const data = await parseJson<{ message?: string }>(res);
  return {
    ok: res.ok,
    message: data.message ?? (res.ok ? "IPS configuradas." : "No fue posible configurar IPS.")
  };
}

export interface RolSistema {
  rol: string;
  capacidades: string[];
}

export async function listarRolesSistema(
  sesion?: SesionUsuario | null
): Promise<RolSistema[]> {
  const res = await fetchApi(`${accessBase}/roles`, {
    headers: buildActorHeaders(sesion)
  });
  if (!res.ok) return [];
  const data = await parseJson<{ roles?: RolSistema[] }>(res);
  return data.roles ?? [];
}

export async function obtenerCapacidadesActor(
  sesion?: SesionUsuario | null
): Promise<string[]> {
  const res = await fetchApi(`${accessBase}/capabilities`, {
    headers: buildActorHeaders(sesion)
  });
  if (!res.ok) return [];
  const data = await parseJson<{ capabilities?: string[] }>(res);
  return data.capabilities ?? [];
}

export interface UsuarioIps {
  usuarioId: string;
  nombre: string;
  correo?: string;
  rol: string;
  ipsId: string;
  activo: boolean;
  documentoIdentidad?: string;
  requiereCambioPassword?: boolean;
}

export async function listarUsuariosIps(
  sesion?: SesionUsuario | null
): Promise<UsuarioIps[]> {
  const res = await fetchApi(`${accessBase}/users`, {
    headers: buildActorHeaders(sesion)
  });
  if (!res.ok) return [];
  const data = await parseJson<{ users?: UsuarioIps[] }>(res);
  return data.users ?? [];
}

export async function crearUsuarioIps(
  input: {
    usuarioId: string;
    nombre: string;
    rol: string;
    correo?: string;
    password?: string;
    documentoIdentidad?: string;
    ipsId?: string;
  },
  sesion?: SesionUsuario | null
): Promise<{ ok: boolean; message: string }> {
  const res = await fetchApi(`${accessBase}/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...buildActorHeaders(sesion)
    },
    body: JSON.stringify(input)
  });
  const data = await parseJson<{ message?: string }>(res);
  return {
    ok: res.ok,
    message: data.message ?? (res.ok ? "Usuario creado." : "No fue posible crear el usuario.")
  };
}

export async function actualizarUsuarioIps(
  usuarioId: string,
  patch: { rol?: string; activo?: boolean; nombre?: string },
  sesion?: SesionUsuario | null
): Promise<{ ok: boolean; message: string }> {
  const res = await fetchApi(`${accessBase}/users/${encodeURIComponent(usuarioId)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...buildActorHeaders(sesion)
    },
    body: JSON.stringify(patch)
  });
  const data = await parseJson<{ message?: string }>(res);
  return {
    ok: res.ok,
    message: data.message ?? (res.ok ? "Usuario actualizado." : "No fue posible actualizar el usuario.")
  };
}

export interface ResultadoSyncPacientes {
  episodiosRevisados: number;
  usuariosCreados: number;
  yaTenianUsuario: number;
  sinDocumentoPaciente: number;
  detallesCreados: Array<{ episodeId: string; usuarioId: string; documento: string }>;
  errores: Array<{ episodeId: string; code: string; message: string }>;
}

/**
 * Crea usuarios paciente que falten, leyendo episodios ya guardados (no hace falta recrear episodios).
 */
export async function sincronizarPacientesDesdeEpisodios(
  sesion?: SesionUsuario | null,
  body?: { ipsId?: string }
): Promise<{ ok: boolean; message: string; data?: ResultadoSyncPacientes }> {
  try {
    const res = await fetchApi(`${accessBase}/patients/sync-from-episodes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...buildActorHeaders(sesion)
      },
      body: JSON.stringify(body ?? {})
    });
    const data = await parseJson<{
      message?: string;
      code?: string;
      details?: unknown;
      data?: ResultadoSyncPacientes;
    }>(res);

    if (res.status === 404) {
      return {
        ok: false,
        message:
          "El backend no reconoce la ruta de sincronización (404). Si usa `npm run start`, ejecute antes `npm run build` en la carpeta `backend/` y reinicie el servidor; con `npm run dev` en backend basta con reiniciar tras actualizar el código."
      };
    }

    const texto = buildApiMessage(
      data,
      res.ok ? "Sincronización completada." : `Error al sincronizar (HTTP ${res.status}).`
    );

    return {
      ok: res.ok,
      message: texto,
      data: data.data
    };
  } catch {
    return { ok: false, message: CONNECTION_ERROR };
  }
}

export async function listarPermisosDocumento(
  episodeId: string,
  sesion?: SesionUsuario | null
): Promise<string[]> {
  const res = await fetchApi(`${episodesBase}/${encodeURIComponent(episodeId)}/permissions`, {
    headers: buildActorHeaders(sesion)
  });
  if (!res.ok) return [];
  const data = await parseJson<{ permissions?: string[] }>(res);
  return data.permissions ?? [];
}

export async function otorgarPermisoDocumento(
  episodeId: string,
  targetIpsId: string,
  sesion?: SesionUsuario | null
): Promise<{ ok: boolean; message: string; traceEvent?: TraceabilityEvent }> {
  const res = await fetchApi(`${episodesBase}/${encodeURIComponent(episodeId)}/permissions/grant`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...buildActorHeaders(sesion)
    },
    body: JSON.stringify({ targetIpsId })
  });
  const data = await parseJson<{ message?: string; traceEvent?: TraceabilityEvent }>(res);
  return {
    ok: res.ok,
    message: data.message ?? (res.ok ? "Permiso otorgado." : "No fue posible otorgar permiso."),
    traceEvent: data.traceEvent
  };
}

export async function revocarPermisoDocumento(
  episodeId: string,
  targetIpsId: string,
  sesion?: SesionUsuario | null
): Promise<{ ok: boolean; message: string; traceEvent?: TraceabilityEvent }> {
  const res = await fetchApi(`${episodesBase}/${encodeURIComponent(episodeId)}/permissions/revoke`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...buildActorHeaders(sesion)
    },
    body: JSON.stringify({ targetIpsId })
  });
  const data = await parseJson<{ message?: string; traceEvent?: TraceabilityEvent }>(res);
  return {
    ok: res.ok,
    message: data.message ?? (res.ok ? "Permiso revocado." : "No fue posible revocar permiso."),
    traceEvent: data.traceEvent
  };
}


export async function consultarDocumentoEpisodio(
  episodeId: string,
  sesion?: SesionUsuario | null
): Promise<{
  ok: boolean;
  message: string;
  data?: {
    episodeId: string;
    hash: string;
    createdAt: string;
    document: EpisodioPayload;
    auditTrace?: TraceabilityEvent;
  };
}> {
  try {
    const res = await fetchApi(`${episodesBase}/${encodeURIComponent(episodeId)}/document`, {
      headers: buildActorHeaders(sesion)
    });
    const data = await parseJson<{
      code?: string;
      message?: string;
      details?: unknown;
      episodeId?: string;
      hash?: string;
      createdAt?: string;
      document?: EpisodioPayload;
      auditTrace?: TraceabilityEvent;
    }>(res);
    if (!res.ok || !data.document || !data.episodeId || !data.hash || !data.createdAt) {
      return {
        ok: false,
        message: buildApiMessage(data, "No fue posible recuperar el documento clínico.")
      };
    }
    return {
      ok: true,
      message: data.message ?? "Documento clínico recuperado.",
      data: {
        episodeId: data.episodeId,
        hash: data.hash,
        createdAt: data.createdAt,
        document: data.document,
        auditTrace: data.auditTrace
      }
    };
  } catch {
    return { ok: false, message: CONNECTION_ERROR };
  }
}

export async function consultarTrazabilidadEpisodio(
  episodeId: string,
  sesion?: SesionUsuario | null
): Promise<{
  ok: boolean;
  message: string;
  data?: Awaited<ReturnType<typeof obtenerTrazabilidadEpisodio>> extends infer T ? Exclude<T, null> : never;
}> {
  try {
    const res = await fetchApi(`${episodesBase}/${encodeURIComponent(episodeId)}/traceability`, {
      headers: buildActorHeaders(sesion)
    });
    const data = await parseJson<{
      code?: string;
      message?: string;
      details?: unknown;
      data?: {
        episodeId: string;
        eventoUrgencias: EventoUrgencias;
        versiones: VersionEpisodio[];
        permisosActivos: string[];
        estadosPermisos: EstadoPermisoEpisodio[];
        traceEvents: TraceabilityEvent[];
        continuidad?: ContinuidadEpisodio;
      };
    }>(res);
    if (!res.ok || !data.data) {
      return {
        ok: false,
        message: buildApiMessage(data, "No fue posible recuperar la trazabilidad del episodio.")
      };
    }
    return {
      ok: true,
      message: data.message ?? "Trazabilidad recuperada.",
      data: {
        episodeId: data.data.episodeId,
        event: data.data.eventoUrgencias,
        versiones: data.data.versiones,
        permisosActivos: data.data.permisosActivos,
        estadosPermisos: data.data.estadosPermisos,
        traceEvents: data.data.traceEvents,
        continuidad: data.data.continuidad
      }
    };
  } catch {
    return { ok: false, message: CONNECTION_ERROR };
  }
}

export async function consultarIntegridadEpisodio(
  episodeId: string,
  sesion?: SesionUsuario | null
): Promise<{ ok: boolean; message: string; data?: IntegridadEpisodio }> {
  try {
    const res = await fetchApi(`${episodesBase}/${encodeURIComponent(episodeId)}/integrity`, {
      headers: buildActorHeaders(sesion)
    });
    const data = await parseJson<{ code?: string; message?: string; details?: unknown; data?: IntegridadEpisodio }>(res);
    if (!res.ok || !data.data) {
      return {
        ok: false,
        message: buildApiMessage(data, "No fue posible verificar la integridad del episodio.")
      };
    }
    return {
      ok: true,
      message: data.message ?? "Integridad verificada.",
      data: data.data
    };
  } catch {
    return { ok: false, message: CONNECTION_ERROR };
  }
}

export async function buscarEventosTrazabilidad(
  filters: { episodeId?: string; eventType?: TraceabilityEvent["eventType"]; ipsId?: string },
  sesion?: SesionUsuario | null
): Promise<{ ok: boolean; message: string; data?: BusquedaTrazabilidad }> {
  try {
    const params = new URLSearchParams();
    if (filters.episodeId?.trim()) params.set("episodeId", filters.episodeId.trim());
    if (filters.eventType?.trim()) params.set("eventType", filters.eventType.trim());
    if (filters.ipsId?.trim()) params.set("ipsId", filters.ipsId.trim());
    const suffix = params.toString();
    const res = await fetchApi(`${episodesBase}/traceability/search${suffix ? `?${suffix}` : ""}`, {
      headers: buildActorHeaders(sesion)
    });
    const data = await parseJson<{
      code?: string;
      message?: string;
      details?: unknown;
      data?: BusquedaTrazabilidad;
    }>(res);
    if (!res.ok || !data.data) {
      return {
        ok: false,
        message: buildApiMessage(data, "No fue posible consultar la trazabilidad.")
      };
    }
    return {
      ok: true,
      message: data.message ?? "Trazabilidad consultada.",
      data: data.data
    };
  } catch {
    return { ok: false, message: CONNECTION_ERROR };
  }
}

export interface IpsEntidad {
  ipsId: string;
  nombre: string;
  repsCodigo: string;
  direccion: string;
  ciudad: string;
  departamento: string;
  telefono: string;
  correoContacto: string;
  activa: boolean;
  creadaEn: string;
  actualizadaEn: string;
}

export async function listarIpsEntidades(
  sesion?: SesionUsuario | null
): Promise<IpsEntidad[]> {
  try {
    const res = await fetchApi(`${ipsBase}`, {
      headers: buildActorHeaders(sesion)
    });
    if (!res.ok) return [];
    const data = await parseJson<{ ips?: IpsEntidad[] }>(res);
    return data.ips ?? [];
  } catch {
    return [];
  }
}

export async function obtenerIpsEntidad(
  ipsId: string,
  sesion?: SesionUsuario | null
): Promise<IpsEntidad | null> {
  try {
    const res = await fetchApi(`${ipsBase}/${encodeURIComponent(ipsId)}`, {
      headers: buildActorHeaders(sesion)
    });
    if (!res.ok) return null;
    const data = await parseJson<{ ips?: IpsEntidad }>(res);
    return data.ips ?? null;
  } catch {
    return null;
  }
}

export async function crearIpsEntidad(
  input: Partial<IpsEntidad> & { ipsId: string; nombre: string; repsCodigo: string },
  sesion?: SesionUsuario | null
): Promise<{ ok: boolean; message: string; ips?: IpsEntidad }> {
  try {
    const res = await fetchApi(`${ipsBase}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...buildActorHeaders(sesion)
      },
      body: JSON.stringify(input)
    });
    const data = await parseJson<{ message?: string; ips?: IpsEntidad }>(res);
    return {
      ok: res.ok,
      message: data.message ?? (res.ok ? "IPS creada." : "No fue posible crear la IPS."),
      ips: data.ips
    };
  } catch {
    return { ok: false, message: CONNECTION_ERROR };
  }
}

export async function actualizarIpsEntidad(
  ipsId: string,
  patch: Partial<IpsEntidad>,
  sesion?: SesionUsuario | null
): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetchApi(`${ipsBase}/${encodeURIComponent(ipsId)}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...buildActorHeaders(sesion)
      },
      body: JSON.stringify(patch)
    });
    const data = await parseJson<{ message?: string }>(res);
    return {
      ok: res.ok,
      message: data.message ?? (res.ok ? "IPS actualizada." : "No fue posible actualizar la IPS.")
    };
  } catch {
    return { ok: false, message: CONNECTION_ERROR };
  }
}

export async function resetearPasswordUsuario(
  usuarioId: string,
  password?: string,
  sesion?: SesionUsuario | null
): Promise<{ ok: boolean; message: string; passwordTemporal?: string }> {
  try {
    const res = await fetchApi(`${accessBase}/users/${encodeURIComponent(usuarioId)}/reset-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...buildActorHeaders(sesion)
      },
      body: JSON.stringify({ password })
    });
    const data = await parseJson<{ message?: string; passwordTemporal?: string }>(res);
    return {
      ok: res.ok,
      message: data.message ?? (res.ok ? "Contraseña reseteada." : "No fue posible resetear la contraseña."),
      passwordTemporal: data.passwordTemporal
    };
  } catch {
    return { ok: false, message: CONNECTION_ERROR };
  }
}

export async function cambiarPasswordPropia(
  passwordActual: string,
  passwordNueva: string,
  sesion?: SesionUsuario | null
): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetchApi(`${authBase}/password`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...buildActorHeaders(sesion)
      },
      body: JSON.stringify({ passwordActual, passwordNueva })
    });
    const data = await parseJson<{ message?: string }>(res);
    return {
      ok: res.ok,
      message: data.message ?? (res.ok ? "Contraseña actualizada." : "No fue posible cambiar la contraseña.")
    };
  } catch {
    return { ok: false, message: CONNECTION_ERROR };
  }
}

export async function obtenerRolesCreables(
  sesion?: SesionUsuario | null
): Promise<string[]> {
  try {
    const res = await fetchApi(`${accessBase}/roles-creables`, {
      headers: buildActorHeaders(sesion)
    });
    if (!res.ok) return [];
    const data = await parseJson<{ rolesCreables?: string[] }>(res);
    return data.rolesCreables ?? [];
  } catch {
    return [];
  }
}

export async function listarUsuariosPorIpsId(
  ipsId: string,
  sesion?: SesionUsuario | null
): Promise<UsuarioIps[]> {
  try {
    const params = new URLSearchParams({ ipsId });
    const res = await fetchApi(`${accessBase}/users?${params.toString()}`, {
      headers: buildActorHeaders(sesion)
    });
    if (!res.ok) return [];
    const data = await parseJson<{ users?: UsuarioIps[] }>(res);
    return data.users ?? [];
  } catch {
    return [];
  }
}

// ─── RF10: Auditoría de desempeño ─────────────────────────────────────────────

const auditBase = `${API_BASE_URL}/audit`;

export type ModoPrueba = "EOA" | "ERC20" | "ERC721";
export type SemaforoColor = "verde" | "amarillo" | "rojo";

export interface BlockSampleFrontend {
  block_number: number;
  timestamp: string;
  tx_count: number;
  gas_used: number;
  gas_limit: number;
  block_time_seconds: number;
  tps: number;
}

export interface AuditMetricResumen {
  id: string;
  timestamp: string;
  modo: ModoPrueba;
  rpcUrl: string;
  chainId: number;
  contractAddress?: string;
  tpsPico: number;
  tpsPromedio: number;
  totalTransacciones: number;
  transaccionesExitosas: number;
  transaccionesFallidas: number;
  tasaExito: number;
  latenciaPromedioMs: number;
  latenciaMinMs: number;
  latenciaMaxMs: number;
  latenciaP95Ms: number;
  blockTimePromedioSeg: number;
  bloquesObservados: number;
  gasUsadoPromedio: number;
  gasUsadoMax: number;
  gasLimit: number;
  gasUtilizacionPct: number;
  transaccionesRevertidas: number;
  transaccionesOutOfGas: number;
  tiempoRespuestaNodoMs: number;
  deployExitoso: boolean;
  llamadasERCExitosas: number;
  llamadasERCTotal: number;
  interoperabilityDetails?: {
    chainId: number;
    rpcUrl: string;
    nodoAccesible: boolean;
    contratoAccesible: boolean;
    readCallsOk: boolean;
    writeCallsOk: boolean;
    compatibilidadERC: string;
    nota: string;
  };
  semaforoEficiencia: SemaforoColor;
  semaforoLatencia: SemaforoColor;
  semaforoSeguridad: SemaforoColor;
  semaforoInteroperabilidad: SemaforoColor;
  fuente: "pandoras-box" | "simulacion";
}

export interface AuditMetricDetalle extends AuditMetricResumen {
  blockSamples: BlockSampleFrontend[];
  rawOutput: Record<string, unknown>;
}

export interface AuditRunConfigFrontend {
  rpcUrl: string;
  modo: ModoPrueba;
  totalTransacciones: number;
  numSubcuentas: number;
  contractAddress?: string;
  /** Mnemonic BIP-39 (12 palabras) para pandoras-box. Sin él se usa simulación. */
  mnemonic?: string;
  /** Tamaño de lote JSON-RPC (default 20) */
  batchSize?: number;
  umbralTpsVerde?: number;
  umbralTpsAmarillo?: number;
  umbralLatenciaVerdeMs?: number;
  umbralLatenciaAmarilloMs?: number;
  umbralTasaExitoVerde?: number;
}

export async function listarAuditMetricas(
  sesion?: SesionUsuario | null
): Promise<{ ok: boolean; message: string; data?: AuditMetricResumen[] }> {
  try {
    const res = await fetchApi(`${auditBase}/metrics`, {
      headers: buildActorHeaders(sesion)
    });
    const data = await parseJson<{ code?: string; message?: string; data?: AuditMetricResumen[] }>(res);
    if (!res.ok) {
      return { ok: false, message: buildApiMessage(data, "Error al listar métricas de auditoría.") };
    }
    return { ok: true, message: data.message ?? "Métricas obtenidas.", data: data.data ?? [] };
  } catch {
    return { ok: false, message: CONNECTION_ERROR };
  }
}

export async function obtenerAuditMetrica(
  id: string,
  sesion?: SesionUsuario | null
): Promise<{ ok: boolean; message: string; data?: AuditMetricDetalle }> {
  try {
    const res = await fetchApi(`${auditBase}/metrics/${encodeURIComponent(id)}`, {
      headers: buildActorHeaders(sesion)
    });
    const data = await parseJson<{ code?: string; message?: string; data?: AuditMetricDetalle }>(res);
    if (!res.ok || !data.data) {
      return { ok: false, message: buildApiMessage(data, "No se encontró la evaluación.") };
    }
    return { ok: true, message: data.message ?? "Evaluación obtenida.", data: data.data };
  } catch {
    return { ok: false, message: CONNECTION_ERROR };
  }
}

export async function ejecutarAuditRun(
  config: AuditRunConfigFrontend,
  sesion?: SesionUsuario | null
): Promise<{ ok: boolean; message: string; data?: AuditMetricDetalle; fuente?: string; advertencia?: string }> {
  try {
    const res = await fetchApi(`${auditBase}/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...buildActorHeaders(sesion)
      },
      body: JSON.stringify(config)
    });
    const data = await parseJson<{
      code?: string;
      message?: string;
      details?: unknown;
      data?: AuditMetricDetalle;
      fuente?: string;
      advertencia?: string | null;
    }>(res);
    if (!res.ok || !data.data) {
      return {
        ok: false,
        message: buildApiMessage(data, "Error al ejecutar la prueba de estrés.")
      };
    }
    return {
      ok: true,
      message: data.message ?? "Evaluación completada.",
      data: data.data,
      fuente: data.fuente,
      advertencia: data.advertencia ?? undefined
    };
  } catch {
    return { ok: false, message: CONNECTION_ERROR };
  }
}

// ─── Sesiones de evaluación ───────────────────────────────────────────────────

export interface EvaluacionSesion {
  id: string;
  startedAt: string;
  label: string;
  startBlockRef?: number;
  iniciadaPor?: string;
}

/** Inicia una nueva sesión de evaluación en el backend. */
export async function iniciarSesionEvaluacion(
  sesion?: SesionUsuario | null,
  opciones?: { label?: string; startBlockRef?: number }
): Promise<{ ok: boolean; message: string; data?: EvaluacionSesion }> {
  try {
    const res = await fetchApi(`${auditBase}/session/reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...buildActorHeaders(sesion) },
      body: JSON.stringify(opciones ?? {})
    });
    const data = await parseJson<{ code?: string; message?: string; data?: EvaluacionSesion }>(res);
    return {
      ok: res.ok,
      message: data.message ?? (res.ok ? "Sesión iniciada." : "No se pudo iniciar la sesión."),
      data: data.data
    };
  } catch {
    return { ok: false, message: CONNECTION_ERROR };
  }
}

/** Obtiene la sesión de evaluación activa (más reciente). */
export async function obtenerSesionEvaluacion(
  sesion?: SesionUsuario | null
): Promise<{ ok: boolean; message: string; data?: EvaluacionSesion | null }> {
  try {
    const res = await fetchApi(`${auditBase}/session/current`, {
      headers: buildActorHeaders(sesion)
    });
    const data = await parseJson<{ code?: string; message?: string; data?: EvaluacionSesion | null }>(res);
    return {
      ok: res.ok,
      message: data.message ?? "",
      data: data.data ?? null
    };
  } catch {
    return { ok: false, message: CONNECTION_ERROR };
  }
}

/** Lista todas las sesiones de evaluación. */
export async function listarSesionesEvaluacion(
  sesion?: SesionUsuario | null
): Promise<{ ok: boolean; message: string; data?: EvaluacionSesion[] }> {
  try {
    const res = await fetchApi(`${auditBase}/session/list`, {
      headers: buildActorHeaders(sesion)
    });
    const data = await parseJson<{ code?: string; message?: string; data?: EvaluacionSesion[] }>(res);
    return {
      ok: res.ok,
      message: data.message ?? "",
      data: data.data ?? []
    };
  } catch {
    return { ok: false, message: CONNECTION_ERROR };
  }
}

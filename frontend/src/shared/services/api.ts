import { API_BASE_URL } from "@/shared/utils/constants";
import {
  leerSesion,
  type SesionUsuario
} from "@/shared/auth/sessionStorage";
import type {
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

const CONNECTION_ERROR = `No se pudo conectar con el backend. Compruebe que esté en ejecución (puerto 3001) y que la URL sea correcta. URL actual: ${API_BASE_URL}`;

async function parseJson<T>(res: Response): Promise<T> {
  return res.json().catch(() => ({} as T));
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
}): Promise<{ ok: boolean; message: string; session?: SesionUsuario }> {
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
    }>(res);
    return {
      ok: res.ok,
      message: data.message ?? (res.ok ? "Sesión iniciada." : "No fue posible iniciar sesión."),
      session: data.session
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
      details: data.details ?? []
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
      details?: { field: string; issue: string }[];
      data?: EpisodioPayload;
      episodeId?: string;
      documentHash?: string;
      version?: number;
      event?: EventoUrgencias;
      onChainMetadata?: OnChainMetadata;
      traceEvent?: TraceabilityEvent;
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
        traceEvent: data.traceEvent
      };
    }
    return {
      valid: false,
      message: data.message ?? "Error al registrar",
      details: data.details ?? []
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
      details?: { field: string; issue: string }[];
      data?: EpisodioPayload;
      episodeId?: string;
      documentHash?: string;
      version?: number;
      event?: EventoUrgencias;
      onChainMetadata?: OnChainMetadata;
      traceEvent?: TraceabilityEvent;
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
        traceEvent: data.traceEvent
      };
    }
    return {
      valid: false,
      message: data.message ?? "Error al actualizar",
      details: data.details ?? []
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
    };
  }>(res);
  if (!data.data) return null;
  return {
    episodeId: data.data.episodeId,
    event: data.data.eventoUrgencias,
    versiones: data.data.versiones,
    permisosActivos: data.data.permisosActivos,
    estadosPermisos: data.data.estadosPermisos,
    traceEvents: data.data.traceEvents
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
    modo: "simulado" | "real";
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

export async function desplegarContratosMock(
  sesion?: SesionUsuario | null
): Promise<{ ok: boolean; message: string }> {
  const res = await fetchApi(`${infraBase}/contracts/mock-deploy`, {
    method: "POST",
    headers: buildActorHeaders(sesion)
  });
  const data = await parseJson<{ message?: string }>(res);
  return {
    ok: res.ok,
    message:
      data.message ??
      (res.ok ? "Contratos simulados operativos." : "No fue posible activar contratos simulados.")
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
  input: { usuarioId: string; nombre: string; rol: string },
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

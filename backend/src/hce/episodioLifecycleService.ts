import type { DocumentoClinicoOffChain, RegistroOnChainMetadata } from "./documentoClinicoService";
import { actorPuedeActualizarEpisodioConContinuidad } from "./permisosEpisodioService";
import { loadJsonFile, saveJsonFile } from "../shared/jsonFileStore";

export type RolUsuario =
  | "profesional_salud"
  | "admin_ips"
  | "paciente"
  | "auditor"
  | "super_admin";

export interface ActorContexto {
  rol: RolUsuario;
  ipsId?: string;
  usuarioId?: string;
}

export interface EventoUrgenciasMetadata {
  eventoUrgenciasId: string;
  fechaHoraInicio: string;
  ipsOrigenId: string;
  tipoAtencion: string;
}

export interface VersionEpisodio {
  version: number;
  actualizadoEn: string;
  actor: ActorContexto;
  documentHash: string;
  onChain: RegistroOnChainMetadata;
}

export interface EpisodioLifecycleRecord {
  episodeId: string;
  eventoUrgencias: EventoUrgenciasMetadata;
  creadoEn: string;
  creadoPor: ActorContexto;
  versionActual: number;
  versiones: VersionEpisodio[];
}

const LIFECYCLE_STORE_FILE = "episodio-lifecycle.json";
const lifecycleStore = new Map<string, EpisodioLifecycleRecord>(
  loadJsonFile<EpisodioLifecycleRecord[]>(LIFECYCLE_STORE_FILE, []).map((record) => [
    record.episodeId,
    record
  ])
);

function persistLifecycleStore(): void {
  saveJsonFile(LIFECYCLE_STORE_FILE, [...lifecycleStore.values()]);
}

function construirEventoUrgencias(
  episodeId: string,
  documento: DocumentoClinicoOffChain
): EventoUrgenciasMetadata {
  const fechaHoraInicio = documento.encounter.period.start;
  const ipsOrigenId = documento.prestadorOrigen.identifier[0]?.value ?? "";
  const tipoAtencion =
    documento.encounter.class.coding?.[0]?.code ??
    documento.encounter.class.text ??
    "urgencias";

  const eventoUrgenciasId = `${ipsOrigenId}:${fechaHoraInicio}:${episodeId}`;

  return {
    eventoUrgenciasId,
    fechaHoraInicio,
    ipsOrigenId,
    tipoAtencion
  };
}

function validarAsociacionEvento(
  existente: EventoUrgenciasMetadata,
  documento: DocumentoClinicoOffChain
): string | null {
  const fechaInicioActual = documento.encounter.period.start;
  const ipsOrigenActual = documento.prestadorOrigen.identifier[0]?.value ?? "";
  if (existente.fechaHoraInicio !== fechaInicioActual) {
    return "La fecha/hora de inicio del evento de urgencias no puede cambiar en actualizaciones.";
  }
  if (existente.ipsOrigenId !== ipsOrigenActual) {
    return "La IPS origen del evento de urgencias no puede cambiar en actualizaciones.";
  }
  return null;
}

export function prevalidarActualizacionLifecycleEpisodio(
  episodeId: string,
  documento: DocumentoClinicoOffChain,
  actor: ActorContexto
): { ok: true } | { ok: false; error: string; errorCode: string } {
  const existente = lifecycleStore.get(episodeId);
  if (!existente) {
    return {
      ok: false,
      error: "El episodio no existe en trazabilidad y no puede actualizarse.",
      errorCode: "EPISODE_NOT_FOUND"
    };
  }
  if (!actorPuedeActualizarEpisodioConContinuidad(episodeId, actor.ipsId, actor.rol)) {
    return {
      ok: false,
      error:
        "La IPS del actor no tiene permisos vigentes para continuar este episodio clínico.",
      errorCode: "FORBIDDEN_IPS_UPDATE"
    };
  }
  const conflict = validarAsociacionEvento(existente.eventoUrgencias, documento);
  if (conflict) {
    return { ok: false, error: conflict, errorCode: "EVENT_ASSOCIATION_CONFLICT" };
  }
  return { ok: true };
}

function pushVersion(
  base: Omit<EpisodioLifecycleRecord, "versionActual" | "versiones"> & {
    versionActual?: number;
    versiones?: VersionEpisodio[];
  },
  actor: ActorContexto,
  onChain: RegistroOnChainMetadata
): EpisodioLifecycleRecord {
  const siguienteVersion = (base.versionActual ?? 0) + 1;
  const version: VersionEpisodio = {
    version: siguienteVersion,
    actualizadoEn: new Date().toISOString(),
    actor,
    documentHash: onChain.documentHash,
    onChain
  };
  return {
    episodeId: base.episodeId,
    eventoUrgencias: base.eventoUrgencias,
    creadoEn: base.creadoEn,
    creadoPor: base.creadoPor,
    versionActual: siguienteVersion,
    versiones: [...(base.versiones ?? []), version]
  };
}

export function crearRegistroLifecycleEpisodio(
  episodeId: string,
  documento: DocumentoClinicoOffChain,
  actor: ActorContexto,
  onChain: RegistroOnChainMetadata
): EpisodioLifecycleRecord {
  const creadoEn = new Date().toISOString();
  const eventoUrgencias = construirEventoUrgencias(episodeId, documento);
  const record = pushVersion(
    {
      episodeId,
      eventoUrgencias,
      creadoEn,
      creadoPor: actor
    },
    actor,
    onChain
  );
  lifecycleStore.set(episodeId, record);
  persistLifecycleStore();
  return record;
}

export function actualizarRegistroLifecycleEpisodio(
  episodeId: string,
  documento: DocumentoClinicoOffChain,
  actor: ActorContexto,
  onChain: RegistroOnChainMetadata
): { record?: EpisodioLifecycleRecord; error?: string; errorCode?: string } {
  const validation = prevalidarActualizacionLifecycleEpisodio(episodeId, documento, actor);
  if (!validation.ok) {
    return {
      error: validation.error,
      errorCode: validation.errorCode
    };
  }
  const existente = lifecycleStore.get(episodeId)!;
  const actualizado = pushVersion(existente, actor, onChain);
  lifecycleStore.set(episodeId, actualizado);
  persistLifecycleStore();
  return { record: actualizado };
}

export function obtenerRegistroLifecycleEpisodio(
  episodeId: string
): EpisodioLifecycleRecord | undefined {
  return lifecycleStore.get(episodeId);
}

export function obtenerVersionesEpisodio(
  episodeId: string
): VersionEpisodio[] {
  return lifecycleStore.get(episodeId)?.versiones ?? [];
}

export function obtenerEventoUrgenciasEpisodio(
  episodeId: string
): EventoUrgenciasMetadata | undefined {
  return lifecycleStore.get(episodeId)?.eventoUrgencias;
}

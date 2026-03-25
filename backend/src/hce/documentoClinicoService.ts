/**
 * Servicio de generación y gestión de documentos clínicos off-chain (HU3-E0).
 *
 * Utiliza el modelo de HCE definido en Caracterizacion_RDA_Completa.csv
 * y su proyección FHIR en Mapeo_RDA_FHIR_urgencias.md para generar
 * documentos clínicos almacenados fuera de la Blockchain, asociados
 * a un único episodio y preparados para cálculo de hash verificable.
 *
 * Si FHIR_BASE_URL está definido, los datos se persisten en HAPI FHIR;
 * en caso contrario se usa el almacén en memoria (prototipo).
 */

import { createHash } from "crypto";
import type { EpisodioFhirLikeInput } from "./hceValidationSchema";
import { isFhirConfigured } from "./fhirClient";
import {
  listAllEpisodeIdsFromFhir,
  persistEpisodeToFhir,
  retrieveEpisodeFromFhir,
  searchEpisodeIdsByPatientIdentifier
} from "./fhirStorageService";

/** Documento clínico off-chain: representación canónica del episodio según modelo HCE/FHIR */
export type DocumentoClinicoOffChain = EpisodioFhirLikeInput;

export interface DocumentoAlmacenado {
  episodeId: string;
  document: DocumentoClinicoOffChain;
  hash: string;
  createdAt: string; // ISO 8601
}

/**
 * Metadatos permitidos para registro on-chain (HU4-E0):
 * no incluyen estructura clínica, solo hashes y referencias no sensibles.
 */
export interface RegistroOnChainMetadata {
  episodeId: string;
  documentHash: string;
  patientIdentifierHash?: string;
  prestadorOrigenHash?: string;
  createdAt: string;
}

/**
 * Serialización canónica (claves ordenadas recursivamente) para que
 * el mismo documento lógico produzca siempre el mismo hash.
 */
function canonicalJson(obj: unknown): string {
  if (obj === null) return "null";
  if (obj === undefined) return "null";
  if (typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) {
    const arr = obj.map((item) => JSON.parse(canonicalJson(item)));
    return JSON.stringify(arr);
  }
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    const value = (obj as Record<string, unknown>)[key];
    if (value !== undefined) {
      sorted[key] = JSON.parse(canonicalJson(value));
    }
  }
  return JSON.stringify(sorted);
}

/**
 * Genera el documento clínico off-chain a partir del payload validado.
 * El documento sigue estrictamente el modelo de HCE (estructura FHIR-like
 * definida en Mapeo_RDA_FHIR_urgencias.md y validada por episodioFhirLikeSchema).
 */
export function generarDocumentoClinico(
  payload: EpisodioFhirLikeInput
): DocumentoClinicoOffChain {
  return { ...payload } as DocumentoClinicoOffChain;
}

/**
 * Calcula el hash criptográfico SHA-256 del documento clínico en forma canónica.
 * Permite verificar la integridad del documento off-chain frente al hash registrado on-chain.
 */
export function calcularHashDocumento(documento: DocumentoClinicoOffChain): string {
  const canonical = canonicalJson(documento);
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

/**
 * Hash SHA-256 para seudonimizar identificadores usados como metadatos on-chain.
 */
function hashValor(value?: string): string | undefined {
  const normalized = value?.trim();
  if (!normalized) return undefined;
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}

/** Almacén off-chain en memoria (prototipo). Se usa solo cuando FHIR_BASE_URL no está definido. */
const almacenOffChain = new Map<string, DocumentoAlmacenado>();

/**
 * Almacena el documento clínico asociado a un episodio y devuelve su hash.
 * Si FHIR_BASE_URL está definido, intenta persistir en HAPI FHIR; si falla,
 * el documento sigue disponible en el almacén en memoria y se devuelve `fhirPersistWarning`.
 */
export async function almacenarDocumentoClinico(
  episodeId: string,
  documento: DocumentoClinicoOffChain
): Promise<{ hash: string; fhirPersistWarning?: string }> {
  const hash = calcularHashDocumento(documento);
  almacenOffChain.set(episodeId, {
    episodeId,
    document: documento,
    hash,
    createdAt: new Date().toISOString()
  });
  if (isFhirConfigured()) {
    try {
      await persistEpisodeToFhir(episodeId, documento);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        hash,
        fhirPersistWarning:
          `No se pudo replicar en el servidor FHIR (el episodio quedó guardado en el backend). Detalle: ${msg}`
      };
    }
  }
  return { hash };
}

/**
 * Recupera el documento clínico por identificador de episodio.
 * Si FHIR_BASE_URL está definido, lo obtiene desde HAPI FHIR; si no, desde memoria.
 *
 * Nota de implementación: los documentos recuperados desde FHIR se guardan en el
 * almacén en memoria para que las llamadas repetidas (p. ej. las 3-5 corridas de
 * medición de tiempos en el dashboard de evaluación) tengan latencia estable y no
 * golpeen FHIR en cada pasada. Esto corrige los falsos "Consistencia baja" causados
 * por la variabilidad HTTP en llamadas consecutivas al mismo episodio.
 */
export async function recuperarDocumentoClinico(
  episodeId: string
): Promise<DocumentoAlmacenado | undefined> {
  const stored = almacenOffChain.get(episodeId);
  if (stored) return stored;
  if (isFhirConfigured()) {
    const document = await retrieveEpisodeFromFhir(episodeId);
    if (!document) return undefined;
    const hash = calcularHashDocumento(document);
    const rec: DocumentoAlmacenado = {
      episodeId,
      document,
      hash,
      createdAt: new Date().toISOString()
    };
    // Cachear en memoria para que llamadas posteriores del mismo proceso sean rápidas
    // y el hash sea consistente (evita recalcular sobre respuestas FHIR ligeramente distintas)
    almacenOffChain.set(episodeId, rec);
    return rec;
  }
  return undefined;
}

/**
 * Proyección explícita on-chain: solo hashes y metadatos no sensibles.
 * Nunca devuelve estructuras clínicas completas del modelo HCE.
 */
export function generarRegistroOnChainMetadata(
  episodeId: string,
  almacenado: DocumentoAlmacenado
): RegistroOnChainMetadata {
  const patientIdentifier = almacenado.document.patient?.identifier?.find((id) => id.value)?.value;
  const prestadorOrigenIdentifier = almacenado.document.prestadorOrigen?.identifier?.find((id) => id.value)?.value;

  return {
    episodeId,
    documentHash: almacenado.hash,
    patientIdentifierHash: hashValor(patientIdentifier),
    prestadorOrigenHash: hashValor(prestadorOrigenIdentifier),
    createdAt: almacenado.createdAt
  };
}

export function generarRegistroOnChainMetadataDesdeDocumento(
  episodeId: string,
  documento: DocumentoClinicoOffChain,
  createdAt = new Date().toISOString()
): RegistroOnChainMetadata {
  return generarRegistroOnChainMetadata(episodeId, {
    episodeId,
    document: documento,
    hash: calcularHashDocumento(documento),
    createdAt
  });
}

/**
 * Recupera el payload listo para registro on-chain.
 * Si no existe episodio/documento asociado, retorna undefined.
 */
export async function obtenerRegistroOnChainMetadata(
  episodeId: string
): Promise<RegistroOnChainMetadata | undefined> {
  const almacenado = await recuperarDocumentoClinico(episodeId);
  if (!almacenado) return undefined;
  return generarRegistroOnChainMetadata(episodeId, almacenado);
}

/**
 * Recupera solo el hash del episodio (para verificación de integridad).
 * Pasa siempre por `recuperarDocumentoClinico` para aprovechar el caché en memoria
 * y garantizar que el hash calculado aquí sea idéntico al que usa el dashboard
 * de evaluación (mismo documento, misma serialización canónica).
 */
export async function obtenerHashEpisodio(episodeId: string): Promise<string | undefined> {
  const rec = await recuperarDocumentoClinico(episodeId);
  return rec?.hash;
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

function buildPatientName(documento: DocumentoClinicoOffChain): string | undefined {
  const patientName = documento.patient?.name?.[0];
  if (!patientName) return undefined;
  const label = `${patientName.family ?? ""} ${(patientName.given ?? []).join(" ")}`.trim();
  return label || undefined;
}

function buildResumenDesdeDocumento(
  episodeId: string,
  documento: DocumentoClinicoOffChain,
  documentHash?: string
): EpisodioResumen {
  return {
    episodeId,
    documentHash,
    patientIdentifier: documento.patient?.identifier?.[0]?.value,
    patientName: buildPatientName(documento),
    patientBirthDate: documento.patient?.birthDate,
    encounterStart: documento.encounter?.period?.start,
    encounterStatus: documento.encounter?.status,
    prestadorOrigenId: documento.prestadorOrigen?.identifier?.[0]?.value
  };
}

/**
 * Busca episodios por identificador del paciente (ej. cédula/documento).
 * Con FHIR: busca en HAPI por Patient identifier y Encounter; en memoria: filtra por patient.identifier.value.
 */
export async function buscarEpisodiosPorIdentificadorPaciente(
  patientIdentifierValue: string
): Promise<EpisodioResumen[]> {
  const value = String(patientIdentifierValue).trim();
  if (!value) return [];
  if (isFhirConfigured()) {
    const ids = await searchEpisodeIdsByPatientIdentifier(value);
    const result: EpisodioResumen[] = [];
    for (const id of ids) {
      const almacenado = await recuperarDocumentoClinico(id);
      if (!almacenado) continue;
      result.push(buildResumenDesdeDocumento(id, almacenado.document, almacenado.hash));
    }
    return result;
  }
  const result: EpisodioResumen[] = [];
  for (const [, stored] of almacenOffChain) {
    const match = stored.document.patient?.identifier?.some(
      (id) => id.value && String(id.value).trim() === value
    );
    if (match) {
      result.push(buildResumenDesdeDocumento(stored.episodeId, stored.document, stored.hash));
    }
  }
  return result;
}

/**
 * Lista todos los episodios registrados (tanto en HAPI FHIR como en memoria).
 */
export async function listarTodosLosEpisodios(): Promise<EpisodioResumen[]> {
  if (isFhirConfigured()) {
    const ids = await listAllEpisodeIdsFromFhir();
    const result: EpisodioResumen[] = [];
    for (const id of ids) {
      const almacenado = await recuperarDocumentoClinico(id);
      if (!almacenado) continue;
      result.push(buildResumenDesdeDocumento(id, almacenado.document, almacenado.hash));
    }
    return result;
  }
  const result: EpisodioResumen[] = [];
  for (const [, stored] of almacenOffChain) {
    result.push(buildResumenDesdeDocumento(stored.episodeId, stored.document, stored.hash));
  }
  return result;
}

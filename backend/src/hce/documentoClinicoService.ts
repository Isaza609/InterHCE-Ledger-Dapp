/**
 * Servicio de generación y gestión de documentos clínicos off-chain (HU3-E0).
 *
 * Utiliza el modelo de HCE definido en Caracterizacion HCE_sinmapear.csv
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

/** Almacén off-chain en memoria (prototipo). Se usa solo cuando FHIR_BASE_URL no está definido. */
const almacenOffChain = new Map<string, DocumentoAlmacenado>();

/**
 * Almacena el documento clínico asociado a un episodio y devuelve su hash.
 * Si FHIR_BASE_URL está definido, persiste en HAPI FHIR; si no, en memoria.
 */
export async function almacenarDocumentoClinico(
  episodeId: string,
  documento: DocumentoClinicoOffChain
): Promise<{ hash: string }> {
  const hash = calcularHashDocumento(documento);
  if (isFhirConfigured()) {
    await persistEpisodeToFhir(episodeId, documento);
    return { hash };
  }
  almacenOffChain.set(episodeId, {
    episodeId,
    document: documento,
    hash,
    createdAt: new Date().toISOString()
  });
  return { hash };
}

/**
 * Recupera el documento clínico por identificador de episodio.
 * Si FHIR_BASE_URL está definido, lo obtiene desde HAPI FHIR; si no, desde memoria.
 */
export async function recuperarDocumentoClinico(
  episodeId: string
): Promise<DocumentoAlmacenado | undefined> {
  if (isFhirConfigured()) {
    const document = await retrieveEpisodeFromFhir(episodeId);
    if (!document) return undefined;
    const hash = calcularHashDocumento(document);
    return {
      episodeId,
      document,
      hash,
      createdAt: new Date().toISOString()
    };
  }
  return almacenOffChain.get(episodeId);
}

/**
 * Recupera solo el hash del episodio (para verificación de integridad).
 * Con HAPI FHIR se recalcula a partir del documento recuperado.
 */
export async function obtenerHashEpisodio(episodeId: string): Promise<string | undefined> {
  if (isFhirConfigured()) {
    const document = await retrieveEpisodeFromFhir(episodeId);
    return document ? calcularHashDocumento(document) : undefined;
  }
  return almacenOffChain.get(episodeId)?.hash;
}

export interface EpisodioResumen {
  episodeId: string;
  documentHash?: string;
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
      const hash = await obtenerHashEpisodio(id);
      result.push({ episodeId: id, documentHash: hash });
    }
    return result;
  }
  const result: EpisodioResumen[] = [];
  for (const [, stored] of almacenOffChain) {
    const match = stored.document.patient?.identifier?.some(
      (id) => id.value && String(id.value).trim() === value
    );
    if (match) result.push({ episodeId: stored.episodeId, documentHash: stored.hash });
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
      const hash = await obtenerHashEpisodio(id);
      result.push({ episodeId: id, documentHash: hash });
    }
    return result;
  }
  const result: EpisodioResumen[] = [];
  for (const [, stored] of almacenOffChain) {
    result.push({ episodeId: stored.episodeId, documentHash: stored.hash });
  }
  return result;
}

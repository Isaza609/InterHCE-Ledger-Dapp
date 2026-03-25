"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.generarDocumentoClinico = generarDocumentoClinico;
exports.calcularHashDocumento = calcularHashDocumento;
exports.almacenarDocumentoClinico = almacenarDocumentoClinico;
exports.recuperarDocumentoClinico = recuperarDocumentoClinico;
exports.generarRegistroOnChainMetadata = generarRegistroOnChainMetadata;
exports.generarRegistroOnChainMetadataDesdeDocumento = generarRegistroOnChainMetadataDesdeDocumento;
exports.obtenerRegistroOnChainMetadata = obtenerRegistroOnChainMetadata;
exports.obtenerHashEpisodio = obtenerHashEpisodio;
exports.buscarEpisodiosPorIdentificadorPaciente = buscarEpisodiosPorIdentificadorPaciente;
exports.listarTodosLosEpisodios = listarTodosLosEpisodios;
const crypto_1 = require("crypto");
const fhirClient_1 = require("./fhirClient");
const fhirStorageService_1 = require("./fhirStorageService");
/**
 * Serialización canónica (claves ordenadas recursivamente) para que
 * el mismo documento lógico produzca siempre el mismo hash.
 */
function canonicalJson(obj) {
    if (obj === null)
        return "null";
    if (obj === undefined)
        return "null";
    if (typeof obj !== "object")
        return JSON.stringify(obj);
    if (Array.isArray(obj)) {
        const arr = obj.map((item) => JSON.parse(canonicalJson(item)));
        return JSON.stringify(arr);
    }
    const sorted = {};
    for (const key of Object.keys(obj).sort()) {
        const value = obj[key];
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
function generarDocumentoClinico(payload) {
    return { ...payload };
}
/**
 * Calcula el hash criptográfico SHA-256 del documento clínico en forma canónica.
 * Permite verificar la integridad del documento off-chain frente al hash registrado on-chain.
 */
function calcularHashDocumento(documento) {
    const canonical = canonicalJson(documento);
    return (0, crypto_1.createHash)("sha256").update(canonical, "utf8").digest("hex");
}
/**
 * Hash SHA-256 para seudonimizar identificadores usados como metadatos on-chain.
 */
function hashValor(value) {
    const normalized = value?.trim();
    if (!normalized)
        return undefined;
    return (0, crypto_1.createHash)("sha256").update(normalized, "utf8").digest("hex");
}
/** Almacén off-chain en memoria (prototipo). Se usa solo cuando FHIR_BASE_URL no está definido. */
const almacenOffChain = new Map();
/**
 * Almacena el documento clínico asociado a un episodio y devuelve su hash.
 * Si FHIR_BASE_URL está definido, intenta persistir en HAPI FHIR; si falla,
 * el documento sigue disponible en el almacén en memoria y se devuelve `fhirPersistWarning`.
 */
async function almacenarDocumentoClinico(episodeId, documento) {
    const hash = calcularHashDocumento(documento);
    almacenOffChain.set(episodeId, {
        episodeId,
        document: documento,
        hash,
        createdAt: new Date().toISOString()
    });
    if ((0, fhirClient_1.isFhirConfigured)()) {
        try {
            await (0, fhirStorageService_1.persistEpisodeToFhir)(episodeId, documento);
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return {
                hash,
                fhirPersistWarning: `No se pudo replicar en el servidor FHIR (el episodio quedó guardado en el backend). Detalle: ${msg}`
            };
        }
    }
    return { hash };
}
/**
 * Recupera el documento clínico por identificador de episodio.
 * Si FHIR_BASE_URL está definido, lo obtiene desde HAPI FHIR; si no, desde memoria.
 */
async function recuperarDocumentoClinico(episodeId) {
    const stored = almacenOffChain.get(episodeId);
    if (stored)
        return stored;
    if ((0, fhirClient_1.isFhirConfigured)()) {
        const document = await (0, fhirStorageService_1.retrieveEpisodeFromFhir)(episodeId);
        if (!document)
            return undefined;
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
 * Proyección explícita on-chain: solo hashes y metadatos no sensibles.
 * Nunca devuelve estructuras clínicas completas del modelo HCE.
 */
function generarRegistroOnChainMetadata(episodeId, almacenado) {
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
function generarRegistroOnChainMetadataDesdeDocumento(episodeId, documento, createdAt = new Date().toISOString()) {
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
async function obtenerRegistroOnChainMetadata(episodeId) {
    const almacenado = await recuperarDocumentoClinico(episodeId);
    if (!almacenado)
        return undefined;
    return generarRegistroOnChainMetadata(episodeId, almacenado);
}
/**
 * Recupera solo el hash del episodio (para verificación de integridad).
 * Con HAPI FHIR se recalcula a partir del documento recuperado.
 */
async function obtenerHashEpisodio(episodeId) {
    if ((0, fhirClient_1.isFhirConfigured)()) {
        const document = await (0, fhirStorageService_1.retrieveEpisodeFromFhir)(episodeId);
        return document ? calcularHashDocumento(document) : undefined;
    }
    return almacenOffChain.get(episodeId)?.hash;
}
function buildPatientName(documento) {
    const patientName = documento.patient?.name?.[0];
    if (!patientName)
        return undefined;
    const label = `${patientName.family ?? ""} ${(patientName.given ?? []).join(" ")}`.trim();
    return label || undefined;
}
function buildResumenDesdeDocumento(episodeId, documento, documentHash) {
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
async function buscarEpisodiosPorIdentificadorPaciente(patientIdentifierValue) {
    const value = String(patientIdentifierValue).trim();
    if (!value)
        return [];
    if ((0, fhirClient_1.isFhirConfigured)()) {
        const ids = await (0, fhirStorageService_1.searchEpisodeIdsByPatientIdentifier)(value);
        const result = [];
        for (const id of ids) {
            const almacenado = await recuperarDocumentoClinico(id);
            if (!almacenado)
                continue;
            result.push(buildResumenDesdeDocumento(id, almacenado.document, almacenado.hash));
        }
        return result;
    }
    const result = [];
    for (const [, stored] of almacenOffChain) {
        const match = stored.document.patient?.identifier?.some((id) => id.value && String(id.value).trim() === value);
        if (match) {
            result.push(buildResumenDesdeDocumento(stored.episodeId, stored.document, stored.hash));
        }
    }
    return result;
}
/**
 * Lista todos los episodios registrados (tanto en HAPI FHIR como en memoria).
 */
async function listarTodosLosEpisodios() {
    if ((0, fhirClient_1.isFhirConfigured)()) {
        const ids = await (0, fhirStorageService_1.listAllEpisodeIdsFromFhir)();
        const result = [];
        for (const id of ids) {
            const almacenado = await recuperarDocumentoClinico(id);
            if (!almacenado)
                continue;
            result.push(buildResumenDesdeDocumento(id, almacenado.document, almacenado.hash));
        }
        return result;
    }
    const result = [];
    for (const [, stored] of almacenOffChain) {
        result.push(buildResumenDesdeDocumento(stored.episodeId, stored.document, stored.hash));
    }
    return result;
}

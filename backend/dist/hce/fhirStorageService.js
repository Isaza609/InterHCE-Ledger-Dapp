"use strict";
/**
 * Servicio de persistencia en HAPI FHIR.
 * Convierte el payload del episodio (EpisodioFhirLikeInput) en recursos FHIR,
 * los envía a HAPI y permite recuperar el documento por episodeId.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.persistEpisodeToFhir = persistEpisodeToFhir;
exports.retrieveEpisodeFromFhir = retrieveEpisodeFromFhir;
exports.searchEpisodeIdsByPatientIdentifier = searchEpisodeIdsByPatientIdentifier;
exports.listAllEpisodeIdsFromFhir = listAllEpisodeIdsFromFhir;
const fhirClient_1 = require("./fhirClient");
const EPISODE_IDENTIFIER_SYSTEM = "urn:interhce:episode";
/**
 * Persiste el episodio en HAPI FHIR (crear o actualizar).
 * Orden: Patient → Organization(s) → Encounter (con identifier episodeId) → Conditions.
 * Devuelve el payload tal cual para que el hash se calcule igual que antes.
 */
async function persistEpisodeToFhir(episodeId, payload) {
    const { patient, encounter, prestadorOrigen, prestadorDestino, diagnosticoIngreso, diagnosticoEgreso, otrosDiagnosticos } = payload;
    // 1. Patient (sin id para crear; con id para actualizar)
    const existing = await findEncounterByEpisodeId(episodeId);
    let patientId;
    let orgId;
    let encounterId;
    if (existing) {
        patientId = existing.patientId;
        orgId = existing.orgId;
        encounterId = existing.encounterId;
        await (0, fhirClient_1.putResource)({ ...patient, id: patientId });
        await (0, fhirClient_1.putResource)({ ...prestadorOrigen, id: orgId });
        if (prestadorDestino && existing.orgDestinoId) {
            await (0, fhirClient_1.putResource)({ ...prestadorDestino, id: existing.orgDestinoId });
        }
        const encounterBody = {
            ...encounter,
            id: encounterId,
            subject: { reference: `Patient/${patientId}` },
            serviceProvider: { reference: `Organization/${orgId}` },
            identifier: [{ system: EPISODE_IDENTIFIER_SYSTEM, value: episodeId }]
        };
        await (0, fhirClient_1.putResource)(encounterBody);
    }
    else {
        const createdPatient = await (0, fhirClient_1.postResource)({ ...patient });
        patientId = createdPatient.id;
        const createdOrg = await (0, fhirClient_1.postResource)({ ...prestadorOrigen });
        orgId = createdOrg.id;
        if (prestadorDestino) {
            await (0, fhirClient_1.postResource)({ ...prestadorDestino });
        }
        const encounterBody = {
            ...encounter,
            subject: { reference: `Patient/${patientId}` },
            serviceProvider: { reference: `Organization/${orgId}` },
            identifier: [{ system: EPISODE_IDENTIFIER_SYSTEM, value: episodeId }]
        };
        const createdEncounter = await (0, fhirClient_1.postResource)(encounterBody);
        encounterId = createdEncounter.id;
    }
    // Conditions: en update borramos las existentes y creamos de nuevo
    if (existing) {
        const conds = await (0, fhirClient_1.searchResources)("Condition", { encounter: `Encounter/${encounterId}` });
        const entries = conds.entry ?? [];
        for (const e of entries) {
            const res = e.resource;
            if (res.id)
                await (0, fhirClient_1.deleteResource)("Condition", res.id);
        }
    }
    const conditions = [
        diagnosticoIngreso,
        ...(diagnosticoEgreso ? [diagnosticoEgreso] : []),
        ...(otrosDiagnosticos ?? [])
    ].filter(Boolean);
    for (const cond of conditions) {
        await (0, fhirClient_1.postResource)({
            ...cond,
            subject: { reference: `Patient/${patientId}` },
            encounter: { reference: `Encounter/${encounterId}` }
        });
    }
}
/**
 * Busca el Encounter por identifier (episodeId) y devuelve los ids de recursos.
 */
async function findEncounterByEpisodeId(episodeId) {
    const bundle = await (0, fhirClient_1.searchResources)("Encounter", {
        identifier: `${EPISODE_IDENTIFIER_SYSTEM}|${episodeId}`
    });
    const entry = bundle.entry?.[0];
    if (!entry?.resource?.id)
        return null;
    const enc = entry.resource;
    const subjectRef = enc.subject?.reference;
    const serviceProviderRef = enc.serviceProvider?.reference;
    if (!subjectRef?.startsWith("Patient/") || !serviceProviderRef?.startsWith("Organization/"))
        return null;
    const patientId = subjectRef.replace("Patient/", "");
    const orgId = serviceProviderRef.replace("Organization/", "");
    return { patientId, orgId, encounterId: enc.id, orgDestinoId: undefined };
}
/**
 * Recupera el documento del episodio desde HAPI FHIR y lo reensambla como EpisodioFhirLikeInput.
 */
async function retrieveEpisodeFromFhir(episodeId) {
    const existing = await findEncounterByEpisodeId(episodeId);
    if (!existing)
        return null;
    const [patient, encounter, prestadorOrigen, conditionBundle] = await Promise.all([
        (0, fhirClient_1.getResource)("Patient", existing.patientId),
        (0, fhirClient_1.getResource)("Encounter", existing.encounterId),
        (0, fhirClient_1.getResource)("Organization", existing.orgId),
        (0, fhirClient_1.searchResources)("Condition", { encounter: `Encounter/${existing.encounterId}` })
    ]);
    const conditions = (conditionBundle.entry ?? []).map((e) => e.resource);
    const diagnosticoIngreso = conditions[0] ?? null;
    const diagnosticoEgreso = conditions[1] ?? null;
    const otrosDiagnosticos = conditions.length > 2 ? conditions.slice(2) : undefined;
    const document = {
        patient: patient,
        encounter: encounter,
        prestadorOrigen: prestadorOrigen,
        prestadorDestino: undefined,
        diagnosticoIngreso: diagnosticoIngreso,
        diagnosticoEgreso: diagnosticoEgreso,
        otrosDiagnosticos: otrosDiagnosticos?.length
            ? otrosDiagnosticos
            : undefined
    };
    return document;
}
/**
 * Busca los episodeId de todos los episodios asociados a un paciente por su identificador (ej. cédula).
 * En FHIR: busca Patient por identifier, luego Encounter por subject=Patient/id y extrae el episodeId.
 */
async function searchEpisodeIdsByPatientIdentifier(patientIdentifierValue) {
    const patientBundle = await (0, fhirClient_1.searchResources)("Patient", {
        identifier: patientIdentifierValue
    });
    const entries = patientBundle.entry ?? [];
    const episodeIds = [];
    for (const e of entries) {
        const patient = e.resource;
        const id = patient.id;
        if (!id)
            continue;
        const encounterBundle = await (0, fhirClient_1.searchResources)("Encounter", {
            subject: `Patient/${id}`
        });
        const encEntries = encounterBundle.entry ?? [];
        for (const encE of encEntries) {
            const enc = encE.resource;
            const episodeId = enc.identifier?.find((i) => i.system === EPISODE_IDENTIFIER_SYSTEM && i.value)?.value;
            if (episodeId)
                episodeIds.push(episodeId);
        }
    }
    return episodeIds;
}
/**
 * Lista los episodeId de todos los episodios almacenados en HAPI FHIR.
 * Busca todos los Encounter que tengan el identificador urn:interhce:episode.
 */
async function listAllEpisodeIdsFromFhir() {
    const bundle = await (0, fhirClient_1.searchResources)("Encounter", { _count: "1000" });
    const entries = bundle.entry ?? [];
    const episodeIds = [];
    for (const e of entries) {
        const enc = e.resource;
        const episodeId = enc.identifier?.find((i) => i.system === EPISODE_IDENTIFIER_SYSTEM && i.value)?.value;
        if (episodeId)
            episodeIds.push(episodeId);
    }
    return episodeIds;
}

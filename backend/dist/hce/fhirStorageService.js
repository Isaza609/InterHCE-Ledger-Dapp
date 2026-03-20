"use strict";
/**
 * Servicio de persistencia en HAPI FHIR.
 * Persiste recursos FHIR indexables para consulta y adicionalmente
 * un DocumentReference canónico con el episodio completo serializado.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.persistEpisodeToFhir = persistEpisodeToFhir;
exports.retrieveEpisodeFromFhir = retrieveEpisodeFromFhir;
exports.searchEpisodeIdsByPatientIdentifier = searchEpisodeIdsByPatientIdentifier;
exports.listAllEpisodeIdsFromFhir = listAllEpisodeIdsFromFhir;
const fhirClient_1 = require("./fhirClient");
const EPISODE_IDENTIFIER_SYSTEM = "urn:interhce:episode";
const EPISODE_SNAPSHOT_SYSTEM = "urn:interhce:episode:snapshot";
const SNAPSHOT_CONTENT_TYPE = "application/interhce-episode+json";
function encodeSnapshot(payload) {
    return Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
}
function decodeSnapshot(data) {
    if (!data)
        return null;
    const json = Buffer.from(data, "base64").toString("utf8");
    return JSON.parse(json);
}
async function searchSingleResource(resourceType, params) {
    const bundle = await (0, fhirClient_1.searchResources)(resourceType, params);
    return bundle.entry?.[0]?.resource ?? null;
}
async function findEncounterByEpisodeId(episodeId) {
    const enc = await searchSingleResource("Encounter", {
        identifier: `${EPISODE_IDENTIFIER_SYSTEM}|${episodeId}`
    });
    if (!enc?.id)
        return null;
    const subjectRef = enc.subject?.reference;
    const serviceProviderRef = enc.serviceProvider?.reference;
    if (!subjectRef?.startsWith("Patient/") || !serviceProviderRef?.startsWith("Organization/")) {
        return null;
    }
    return {
        patientId: subjectRef.replace("Patient/", ""),
        orgId: serviceProviderRef.replace("Organization/", ""),
        encounterId: enc.id
    };
}
async function findSnapshotByEpisodeId(episodeId) {
    return searchSingleResource("DocumentReference", {
        identifier: `${EPISODE_SNAPSHOT_SYSTEM}|${episodeId}`
    });
}
async function upsertSnapshotDocumentReference(episodeId, payload, patientId) {
    const existing = await findSnapshotByEpisodeId(episodeId);
    const snapshotBody = {
        resourceType: "DocumentReference",
        status: "current",
        type: {
            text: "InterHCE Episode Snapshot"
        },
        identifier: [
            {
                system: EPISODE_SNAPSHOT_SYSTEM,
                value: episodeId
            }
        ],
        subject: patientId ? { reference: `Patient/${patientId}` } : undefined,
        content: [
            {
                attachment: {
                    contentType: SNAPSHOT_CONTENT_TYPE,
                    title: `episode-${episodeId}.json`,
                    data: encodeSnapshot(payload)
                }
            }
        ]
    };
    if (existing?.id) {
        await (0, fhirClient_1.putResource)({
            ...snapshotBody,
            id: existing.id
        });
        return;
    }
    await (0, fhirClient_1.postResource)(snapshotBody);
}
async function replaceEncounterConditions(encounterId, patientId, conditions) {
    const conditionBundle = await (0, fhirClient_1.searchResources)("Condition", {
        encounter: `Encounter/${encounterId}`
    });
    for (const entry of conditionBundle.entry ?? []) {
        const resource = entry.resource;
        if (resource.id) {
            await (0, fhirClient_1.deleteResource)("Condition", resource.id);
        }
    }
    for (const condition of conditions) {
        await (0, fhirClient_1.postResource)({
            ...condition,
            subject: { reference: `Patient/${patientId}` },
            encounter: { reference: `Encounter/${encounterId}` }
        });
    }
}
async function persistEpisodeToFhir(episodeId, payload) {
    const { patient, coverage, cobertura, encounter, prestadorOrigen, prestadorDestino, diagnosticoIngreso, diagnosticoEgreso, diagnosticosRelacionados, diagnosticosComplicacion, causaBasicaMuerte } = payload;
    const coverageResource = cobertura ?? coverage;
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
        patientId = String(createdPatient.id);
        const createdOrg = await (0, fhirClient_1.postResource)({ ...prestadorOrigen });
        orgId = String(createdOrg.id);
        const createdEncounter = await (0, fhirClient_1.postResource)({
            ...encounter,
            subject: { reference: `Patient/${patientId}` },
            serviceProvider: { reference: `Organization/${orgId}` },
            identifier: [{ system: EPISODE_IDENTIFIER_SYSTEM, value: episodeId }]
        });
        encounterId = String(createdEncounter.id);
    }
    if (coverageResource) {
        const existingCoverage = await searchSingleResource("Coverage", {
            identifier: `${EPISODE_IDENTIFIER_SYSTEM}|${episodeId}`
        });
        const coverageBody = {
            ...coverageResource,
            beneficiary: { reference: `Patient/${patientId}` },
            identifier: [{ system: EPISODE_IDENTIFIER_SYSTEM, value: episodeId }]
        };
        if (existingCoverage?.id) {
            await (0, fhirClient_1.putResource)({ ...coverageBody, id: existingCoverage.id });
        }
        else {
            await (0, fhirClient_1.postResource)(coverageBody);
        }
    }
    if (prestadorDestino) {
        const existingDestino = await searchSingleResource("Organization", {
            identifier: prestadorDestino.identifier?.[0]?.value ?? ""
        });
        if (existingDestino?.id) {
            await (0, fhirClient_1.putResource)({ ...prestadorDestino, id: existingDestino.id });
        }
        else {
            await (0, fhirClient_1.postResource)({ ...prestadorDestino });
        }
    }
    const allConditions = [
        diagnosticoIngreso,
        ...(diagnosticoEgreso ? [diagnosticoEgreso] : []),
        ...(diagnosticosRelacionados ?? []),
        ...(diagnosticosComplicacion ?? []),
        ...(causaBasicaMuerte ? [causaBasicaMuerte] : [])
    ].filter(Boolean);
    await replaceEncounterConditions(encounterId, patientId, allConditions);
    await upsertSnapshotDocumentReference(episodeId, payload, patientId);
}
async function retrieveEpisodeFromFhir(episodeId) {
    const snapshot = await findSnapshotByEpisodeId(episodeId);
    const snapshotData = snapshot?.content?.[0]?.attachment?.data;
    const snapshotPayload = decodeSnapshot(snapshotData);
    if (snapshotPayload) {
        return snapshotPayload;
    }
    const existing = await findEncounterByEpisodeId(episodeId);
    if (!existing)
        return null;
    const [patient, encounter, prestadorOrigen, conditionBundle] = await Promise.all([
        (0, fhirClient_1.getResource)("Patient", existing.patientId),
        (0, fhirClient_1.getResource)("Encounter", existing.encounterId),
        (0, fhirClient_1.getResource)("Organization", existing.orgId),
        (0, fhirClient_1.searchResources)("Condition", { encounter: `Encounter/${existing.encounterId}` })
    ]);
    const conditions = (conditionBundle.entry ?? []).map((entry) => entry.resource);
    return {
        patient: patient,
        cobertura: {
            resourceType: "Coverage",
            beneficiary: { reference: `Patient/${existing.patientId}` },
            payor: [{ identifier: { value: "NO_DISPONIBLE" }, display: "No reconstruido desde FHIR" }]
        },
        encounter: encounter,
        prestadorOrigen: prestadorOrigen,
        diagnosticoIngreso: conditions[0],
        diagnosticoEgreso: conditions[1],
        diagnosticosRelacionados: conditions.length > 2
            ? conditions.slice(2)
            : undefined
    };
}
async function searchEpisodeIdsByPatientIdentifier(patientIdentifierValue) {
    const patientBundle = await (0, fhirClient_1.searchResources)("Patient", {
        identifier: patientIdentifierValue
    });
    const entries = patientBundle.entry ?? [];
    const episodeIds = new Set();
    for (const entry of entries) {
        const patient = entry.resource;
        if (!patient.id)
            continue;
        const encounterBundle = await (0, fhirClient_1.searchResources)("Encounter", {
            subject: `Patient/${patient.id}`
        });
        for (const encounterEntry of encounterBundle.entry ?? []) {
            const enc = encounterEntry.resource;
            const episodeId = enc.identifier?.find((identifier) => identifier.system === EPISODE_IDENTIFIER_SYSTEM && identifier.value)?.value;
            if (episodeId) {
                episodeIds.add(episodeId);
            }
        }
    }
    return [...episodeIds];
}
async function listAllEpisodeIdsFromFhir() {
    const bundle = await (0, fhirClient_1.searchResources)("Encounter", { _count: "1000" });
    const episodeIds = new Set();
    for (const entry of bundle.entry ?? []) {
        const enc = entry.resource;
        const episodeId = enc.identifier?.find((identifier) => identifier.system === EPISODE_IDENTIFIER_SYSTEM && identifier.value)?.value;
        if (episodeId) {
            episodeIds.add(episodeId);
        }
    }
    return [...episodeIds];
}

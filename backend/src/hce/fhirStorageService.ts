/**
 * Servicio de persistencia en HAPI FHIR.
 * Persiste recursos FHIR indexables para consulta y adicionalmente
 * un DocumentReference canónico con el episodio completo serializado.
 */

import type { EpisodioFhirLikeInput } from "./hceValidationSchema";
import {
  deleteResource,
  getResource,
  postResource,
  putResource,
  searchResources
} from "./fhirClient";

const EPISODE_IDENTIFIER_SYSTEM = "urn:interhce:episode";
const EPISODE_SNAPSHOT_SYSTEM = "urn:interhce:episode:snapshot";
const SNAPSHOT_CONTENT_TYPE = "application/interhce-episode+json";

interface FhirResourceLike {
  resourceType: string;
  id?: string;
  [key: string]: unknown;
}

function encodeSnapshot(payload: EpisodioFhirLikeInput): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
}

function decodeSnapshot(data?: string): EpisodioFhirLikeInput | null {
  if (!data) return null;
  const json = Buffer.from(data, "base64").toString("utf8");
  return JSON.parse(json) as EpisodioFhirLikeInput;
}

async function searchSingleResource(
  resourceType: string,
  params: Record<string, string>
): Promise<FhirResourceLike | null> {
  const bundle = await searchResources(resourceType, params);
  return (bundle.entry?.[0]?.resource as FhirResourceLike | undefined) ?? null;
}

async function findEncounterByEpisodeId(episodeId: string): Promise<{
  patientId: string;
  orgId: string;
  encounterId: string;
  orgDestinoId?: string;
} | null> {
  const enc = await searchSingleResource("Encounter", {
    identifier: `${EPISODE_IDENTIFIER_SYSTEM}|${episodeId}`
  });
  if (!enc?.id) return null;
  const subjectRef = (enc.subject as { reference?: string } | undefined)?.reference;
  const serviceProviderRef = (enc.serviceProvider as { reference?: string } | undefined)?.reference;
  if (!subjectRef?.startsWith("Patient/") || !serviceProviderRef?.startsWith("Organization/")) {
    return null;
  }
  return {
    patientId: subjectRef.replace("Patient/", ""),
    orgId: serviceProviderRef.replace("Organization/", ""),
    encounterId: enc.id
  };
}

/**
 * Busca el snapshot más reciente del episodio. Usa `_sort=-_lastUpdated` para
 * obtener el más nuevo primero, lo que corrige el caso donde HAPI FHIR creó
 * snapshots duplicados por indexación asíncrona (upsert rápido durante el seed).
 */
async function findSnapshotByEpisodeId(
  episodeId: string
): Promise<FhirResourceLike | null> {
  const bundle = await searchResources("DocumentReference", {
    identifier: `${EPISODE_SNAPSHOT_SYSTEM}|${episodeId}`,
    _sort: "-_lastUpdated",
    _count: "1"
  });
  return (bundle.entry?.[0]?.resource as FhirResourceLike | undefined) ?? null;
}

/**
 * Crea o actualiza el snapshot del episodio. Si existen duplicados (causados por
 * la indexación asíncrona de HAPI FHIR durante inserciones rápidas), actualiza
 * el más reciente y elimina los obsoletos para prevenir lecturas inconsistentes.
 */
async function upsertSnapshotDocumentReference(
  episodeId: string,
  payload: EpisodioFhirLikeInput,
  patientId?: string
): Promise<void> {
  const snapshotBody: FhirResourceLike = {
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

  // Buscar TODOS los snapshots existentes (puede haber duplicados por race condition)
  const allSnapshots = await searchResources("DocumentReference", {
    identifier: `${EPISODE_SNAPSHOT_SYSTEM}|${episodeId}`,
    _sort: "-_lastUpdated"
  });
  const entries = (allSnapshots.entry ?? []).map((e) => e.resource as FhirResourceLike);

  if (entries.length > 0) {
    // Actualizar el más reciente
    await putResource({ ...snapshotBody, id: entries[0].id });
    // Eliminar duplicados obsoletos
    for (const dup of entries.slice(1)) {
      if (dup.id) {
        try { await deleteResource("DocumentReference", dup.id); } catch { /* best effort */ }
      }
    }
    return;
  }

  await postResource(snapshotBody);
}

async function replaceEncounterConditions(
  encounterId: string,
  patientId: string,
  conditions: Array<EpisodioFhirLikeInput["diagnosticoIngreso"]>
): Promise<void> {
  const conditionBundle = await searchResources("Condition", {
    encounter: `Encounter/${encounterId}`
  });
  for (const entry of conditionBundle.entry ?? []) {
    const resource = entry.resource as { id?: string };
    if (resource.id) {
      await deleteResource("Condition", resource.id);
    }
  }

  for (const condition of conditions) {
    await postResource({
      ...condition,
      subject: { reference: `Patient/${patientId}` },
      encounter: { reference: `Encounter/${encounterId}` }
    } as FhirResourceLike);
  }
}

export async function persistEpisodeToFhir(
  episodeId: string,
  payload: EpisodioFhirLikeInput
): Promise<void> {
  const {
    patient,
    coverage,
    cobertura,
    encounter,
    prestadorOrigen,
    prestadorDestino,
    diagnosticoIngreso,
    diagnosticoEgreso,
    diagnosticosRelacionados,
    diagnosticosComplicacion,
    causaBasicaMuerte
  } = payload as EpisodioFhirLikeInput & { coverage?: EpisodioFhirLikeInput["cobertura"] };
  const coverageResource = cobertura ?? coverage;

  const existing = await findEncounterByEpisodeId(episodeId);
  let patientId: string;
  let orgId: string;
  let encounterId: string;

  if (existing) {
    patientId = existing.patientId;
    orgId = existing.orgId;
    encounterId = existing.encounterId;

    await putResource({ ...patient, id: patientId } as FhirResourceLike);
    await putResource({ ...prestadorOrigen, id: orgId } as FhirResourceLike);

    const encounterBody: FhirResourceLike = {
      ...encounter,
      id: encounterId,
      subject: { reference: `Patient/${patientId}` },
      serviceProvider: { reference: `Organization/${orgId}` },
      identifier: [{ system: EPISODE_IDENTIFIER_SYSTEM, value: episodeId }]
    };
    await putResource(encounterBody);
  } else {
    const createdPatient = await postResource({ ...patient } as FhirResourceLike);
    patientId = String(createdPatient.id);
    const createdOrg = await postResource({ ...prestadorOrigen } as FhirResourceLike);
    orgId = String(createdOrg.id);

    const createdEncounter = await postResource({
      ...encounter,
      subject: { reference: `Patient/${patientId}` },
      serviceProvider: { reference: `Organization/${orgId}` },
      identifier: [{ system: EPISODE_IDENTIFIER_SYSTEM, value: episodeId }]
    } as FhirResourceLike);
    encounterId = String(createdEncounter.id);
  }

  if (coverageResource) {
    const existingCoverage = await searchSingleResource("Coverage", {
      identifier: `${EPISODE_IDENTIFIER_SYSTEM}|${episodeId}`
    });
    const coverageBody: FhirResourceLike = {
      ...coverageResource,
      beneficiary: { reference: `Patient/${patientId}` },
      identifier: [{ system: EPISODE_IDENTIFIER_SYSTEM, value: episodeId }]
    };
    if (existingCoverage?.id) {
      await putResource({ ...coverageBody, id: existingCoverage.id });
    } else {
      await postResource(coverageBody);
    }
  }

  if (prestadorDestino) {
    const existingDestino = await searchSingleResource("Organization", {
      identifier: prestadorDestino.identifier?.[0]?.value ?? ""
    });
    if (existingDestino?.id) {
      await putResource({ ...prestadorDestino, id: existingDestino.id } as FhirResourceLike);
    } else {
      await postResource({ ...prestadorDestino } as FhirResourceLike);
    }
  }

  const allConditions = [
    diagnosticoIngreso,
    ...(diagnosticoEgreso ? [diagnosticoEgreso] : []),
    ...(diagnosticosRelacionados ?? []),
    ...(diagnosticosComplicacion ?? []),
    ...(causaBasicaMuerte ? [causaBasicaMuerte] : [])
  ].filter(Boolean) as Array<EpisodioFhirLikeInput["diagnosticoIngreso"]>;

  await replaceEncounterConditions(encounterId, patientId, allConditions);
  await upsertSnapshotDocumentReference(episodeId, payload, patientId);
}

export async function retrieveEpisodeFromFhir(
  episodeId: string
): Promise<EpisodioFhirLikeInput | null> {
  const snapshot = await findSnapshotByEpisodeId(episodeId);
  const snapshotData = (snapshot?.content as Array<{ attachment?: { data?: string } }> | undefined)
    ?.[0]?.attachment?.data;
  const snapshotPayload = decodeSnapshot(snapshotData);
  if (snapshotPayload) {
    return snapshotPayload;
  }

  const existing = await findEncounterByEpisodeId(episodeId);
  if (!existing) return null;

  const [patient, encounter, prestadorOrigen, conditionBundle] = await Promise.all([
    getResource("Patient", existing.patientId),
    getResource("Encounter", existing.encounterId),
    getResource("Organization", existing.orgId),
    searchResources("Condition", { encounter: `Encounter/${existing.encounterId}` })
  ]);

  const conditions = (conditionBundle.entry ?? []).map((entry) => entry.resource);
  return {
    patient: patient as EpisodioFhirLikeInput["patient"],
    cobertura: {
      resourceType: "Coverage",
      beneficiary: { reference: `Patient/${existing.patientId}` },
      payor: [{ identifier: { value: "NO_DISPONIBLE" }, display: "No reconstruido desde FHIR" }]
    },
    encounter: encounter as EpisodioFhirLikeInput["encounter"],
    prestadorOrigen: prestadorOrigen as EpisodioFhirLikeInput["prestadorOrigen"],
    diagnosticoIngreso: conditions[0] as EpisodioFhirLikeInput["diagnosticoIngreso"],
    diagnosticoEgreso: conditions[1] as EpisodioFhirLikeInput["diagnosticoEgreso"] | undefined,
    diagnosticosRelacionados:
      conditions.length > 2
        ? (conditions.slice(2) as EpisodioFhirLikeInput["diagnosticosRelacionados"])
        : undefined
  };
}

export async function searchEpisodeIdsByPatientIdentifier(
  patientIdentifierValue: string
): Promise<string[]> {
  const patientBundle = await searchResources("Patient", {
    identifier: patientIdentifierValue
  });
  const entries = patientBundle.entry ?? [];
  const episodeIds = new Set<string>();

  for (const entry of entries) {
    const patient = entry.resource as { id?: string };
    if (!patient.id) continue;
    const encounterBundle = await searchResources("Encounter", {
      subject: `Patient/${patient.id}`
    });
    for (const encounterEntry of encounterBundle.entry ?? []) {
      const enc = encounterEntry.resource as {
        identifier?: Array<{ system?: string; value?: string }>;
      };
      const episodeId = enc.identifier?.find(
        (identifier) =>
          identifier.system === EPISODE_IDENTIFIER_SYSTEM && identifier.value
      )?.value;
      if (episodeId) {
        episodeIds.add(episodeId);
      }
    }
  }

  return [...episodeIds];
}

export async function listAllEpisodeIdsFromFhir(): Promise<string[]> {
  const bundle = await searchResources("Encounter", { _count: "1000" });
  const episodeIds = new Set<string>();

  for (const entry of bundle.entry ?? []) {
    const enc = entry.resource as {
      identifier?: Array<{ system?: string; value?: string }>;
    };
    const episodeId = enc.identifier?.find(
      (identifier) =>
        identifier.system === EPISODE_IDENTIFIER_SYSTEM && identifier.value
    )?.value;
    if (episodeId) {
      episodeIds.add(episodeId);
    }
  }

  return [...episodeIds];
}

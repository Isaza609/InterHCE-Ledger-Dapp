/**
 * Servicio de persistencia en HAPI FHIR.
 * Convierte el payload del episodio (EpisodioFhirLikeInput) en recursos FHIR,
 * los envía a HAPI y permite recuperar el documento por episodeId.
 */

import type { EpisodioFhirLikeInput } from "./hceValidationSchema";
import {
  postResource,
  getResource,
  putResource,
  searchResources,
  deleteResource
} from "./fhirClient";

const EPISODE_IDENTIFIER_SYSTEM = "urn:interhce:episode";

/**
 * Persiste el episodio en HAPI FHIR (crear o actualizar).
 * Orden: Patient → Organization(s) → Encounter (con identifier episodeId) → Conditions.
 * Devuelve el payload tal cual para que el hash se calcule igual que antes.
 */
export async function persistEpisodeToFhir(
  episodeId: string,
  payload: EpisodioFhirLikeInput
): Promise<void> {
  const { patient, encounter, prestadorOrigen, prestadorDestino, diagnosticoIngreso, diagnosticoEgreso, otrosDiagnosticos } = payload;

  // 1. Patient (sin id para crear; con id para actualizar)
  const existing = await findEncounterByEpisodeId(episodeId);
  let patientId: string;
  let orgId: string;
  let encounterId: string;

  if (existing) {
    patientId = existing.patientId;
    orgId = existing.orgId;
    encounterId = existing.encounterId;
    await putResource({ ...patient, id: patientId } as Parameters<typeof putResource>[0]);
    await putResource({ ...prestadorOrigen, id: orgId } as Parameters<typeof putResource>[0]);
    if (prestadorDestino && existing.orgDestinoId) {
      await putResource({ ...prestadorDestino, id: existing.orgDestinoId } as Parameters<typeof putResource>[0]);
    }
    const encounterBody = {
      ...encounter,
      id: encounterId,
      subject: { reference: `Patient/${patientId}` },
      serviceProvider: { reference: `Organization/${orgId}` },
      identifier: [{ system: EPISODE_IDENTIFIER_SYSTEM, value: episodeId }]
    };
    await putResource(encounterBody as Parameters<typeof putResource>[0]);
  } else {
    const createdPatient = await postResource({ ...patient } as Parameters<typeof postResource>[0]);
    patientId = createdPatient.id!;
    const createdOrg = await postResource({ ...prestadorOrigen } as Parameters<typeof postResource>[0]);
    orgId = createdOrg.id!;
    if (prestadorDestino) {
      await postResource({ ...prestadorDestino } as Parameters<typeof postResource>[0]);
    }
    const encounterBody = {
      ...encounter,
      subject: { reference: `Patient/${patientId}` },
      serviceProvider: { reference: `Organization/${orgId}` },
      identifier: [{ system: EPISODE_IDENTIFIER_SYSTEM, value: episodeId }]
    };
    const createdEncounter = await postResource(encounterBody as Parameters<typeof postResource>[0]);
    encounterId = createdEncounter.id!;
  }

  // Conditions: en update borramos las existentes y creamos de nuevo
  if (existing) {
    const conds = await searchResources("Condition", { encounter: `Encounter/${encounterId}` });
    const entries = conds.entry ?? [];
    for (const e of entries) {
      const res = e.resource;
      if (res.id) await deleteResource("Condition", res.id);
    }
  }

  const conditions = [
    diagnosticoIngreso,
    ...(diagnosticoEgreso ? [diagnosticoEgreso] : []),
    ...(otrosDiagnosticos ?? [])
  ].filter(Boolean);

  for (const cond of conditions) {
    await postResource({
      ...cond,
      subject: { reference: `Patient/${patientId}` },
      encounter: { reference: `Encounter/${encounterId}` }
    } as Parameters<typeof postResource>[0]);
  }
}

/**
 * Busca el Encounter por identifier (episodeId) y devuelve los ids de recursos.
 */
async function findEncounterByEpisodeId(episodeId: string): Promise<{
  patientId: string;
  orgId: string;
  encounterId: string;
  orgDestinoId?: string;
} | null> {
  const bundle = await searchResources("Encounter", {
    identifier: `${EPISODE_IDENTIFIER_SYSTEM}|${episodeId}`
  });
  const entry = bundle.entry?.[0];
  if (!entry?.resource?.id) return null;
  const enc = entry.resource;
  const subjectRef = (enc as { subject?: { reference?: string } }).subject?.reference;
  const serviceProviderRef = (enc as { serviceProvider?: { reference?: string } }).serviceProvider?.reference;
  if (!subjectRef?.startsWith("Patient/") || !serviceProviderRef?.startsWith("Organization/"))
    return null;
  const patientId = subjectRef.replace("Patient/", "");
  const orgId = serviceProviderRef.replace("Organization/", "");
  return { patientId, orgId, encounterId: enc.id!, orgDestinoId: undefined };
}

/**
 * Recupera el documento del episodio desde HAPI FHIR y lo reensambla como EpisodioFhirLikeInput.
 */
export async function retrieveEpisodeFromFhir(
  episodeId: string
): Promise<EpisodioFhirLikeInput | null> {
  const existing = await findEncounterByEpisodeId(episodeId);
  if (!existing) return null;

  const [patient, encounter, prestadorOrigen, conditionBundle] = await Promise.all([
    getResource("Patient", existing.patientId),
    getResource("Encounter", existing.encounterId),
    getResource("Organization", existing.orgId),
    searchResources("Condition", { encounter: `Encounter/${existing.encounterId}` })
  ]);

  const conditions = (conditionBundle.entry ?? []).map((e) => e.resource);
  const diagnosticoIngreso = conditions[0] ?? null;
  const diagnosticoEgreso = conditions[1] ?? null;
  const otrosDiagnosticos = conditions.length > 2 ? conditions.slice(2) : undefined;

  const document: EpisodioFhirLikeInput = {
    patient: patient as EpisodioFhirLikeInput["patient"],
    encounter: encounter as EpisodioFhirLikeInput["encounter"],
    prestadorOrigen: prestadorOrigen as EpisodioFhirLikeInput["prestadorOrigen"],
    prestadorDestino: undefined,
    diagnosticoIngreso: diagnosticoIngreso as EpisodioFhirLikeInput["diagnosticoIngreso"],
    diagnosticoEgreso: diagnosticoEgreso as EpisodioFhirLikeInput["diagnosticoEgreso"] | undefined,
    otrosDiagnosticos: otrosDiagnosticos?.length
      ? (otrosDiagnosticos as EpisodioFhirLikeInput["otrosDiagnosticos"])
      : undefined
  };

  return document;
}

/**
 * Busca los episodeId de todos los episodios asociados a un paciente por su identificador (ej. cédula).
 * En FHIR: busca Patient por identifier, luego Encounter por subject=Patient/id y extrae el episodeId.
 */
export async function searchEpisodeIdsByPatientIdentifier(
  patientIdentifierValue: string
): Promise<string[]> {
  const patientBundle = await searchResources("Patient", {
    identifier: patientIdentifierValue
  });
  const entries = patientBundle.entry ?? [];
  const episodeIds: string[] = [];
  for (const e of entries) {
    const patient = e.resource;
    const id = patient.id;
    if (!id) continue;
    const encounterBundle = await searchResources("Encounter", {
      subject: `Patient/${id}`
    });
    const encEntries = encounterBundle.entry ?? [];
    for (const encE of encEntries) {
      const enc = encE.resource as { identifier?: Array<{ system?: string; value?: string }> };
      const episodeId = enc.identifier?.find(
        (i) => i.system === EPISODE_IDENTIFIER_SYSTEM && i.value
      )?.value;
      if (episodeId) episodeIds.push(episodeId);
    }
  }
  return episodeIds;
}

/**
 * Lista los episodeId de todos los episodios almacenados en HAPI FHIR.
 * Busca todos los Encounter que tengan el identificador urn:interhce:episode.
 */
export async function listAllEpisodeIdsFromFhir(): Promise<string[]> {
  const bundle = await searchResources("Encounter", { _count: "1000" });
  const entries = bundle.entry ?? [];
  const episodeIds: string[] = [];
  for (const e of entries) {
    const enc = e.resource as { identifier?: Array<{ system?: string; value?: string }> };
    const episodeId = enc.identifier?.find(
      (i) => i.system === EPISODE_IDENTIFIER_SYSTEM && i.value
    )?.value;
    if (episodeId) episodeIds.push(episodeId);
  }
  return episodeIds;
}

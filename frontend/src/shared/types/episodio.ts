/**
 * Tipos del episodio clínico de urgencias.
 * Alineados con backend (hceModel / episodioFhirLikeSchema) para validación y registro.
 */

export interface FhirIdentifier {
  system?: string;
  value: string;
}

export interface FhirCoding {
  system?: string;
  code: string;
  display?: string;
}

export interface FhirCodeableConcept {
  coding?: FhirCoding[];
  text?: string;
}

export interface FhirReference {
  reference?: string;
  display?: string;
}

export interface FhirPeriod {
  start: string; // ISO datetime sin offset, ej. 2025-03-01T10:00:00
  end?: string;
}

export interface EpisodioPatient {
  resourceType: "Patient";
  identifier: FhirIdentifier[];
  name: Array<{ family: string; given: string[] }>;
  birthDate: string; // YYYY-MM-DD
  gender?: "male" | "female" | "other" | "unknown";
}

export interface EpisodioOrganization {
  resourceType: "Organization";
  identifier: FhirIdentifier[];
  name?: string;
}

export interface EpisodioEncounter {
  resourceType: "Encounter";
  status: "planned" | "in-progress" | "finished";
  class: FhirCodeableConcept;
  type?: FhirCodeableConcept[];
  subject: FhirReference;
  serviceProvider: FhirReference;
  period: FhirPeriod;
  reasonCode?: FhirCodeableConcept[];
  priority?: FhirCodeableConcept;
}

export interface EpisodioCondition {
  resourceType: "Condition";
  code: FhirCodeableConcept;
  subject: FhirReference;
  encounter?: FhirReference;
  category?: FhirCodeableConcept[];
}

/** Payload que acepta el backend en POST /episodes/validate y POST /episodes */
export interface EpisodioPayload {
  patient: EpisodioPatient;
  encounter: EpisodioEncounter;
  prestadorOrigen: EpisodioOrganization;
  prestadorDestino?: EpisodioOrganization;
  diagnosticoIngreso: EpisodioCondition;
  diagnosticoEgreso?: EpisodioCondition;
  otrosDiagnosticos?: EpisodioCondition[];
}

export interface ValidationIssue {
  field: string;
  issue: string;
}

export interface ValidationResult {
  valid: boolean;
  message?: string;
  details?: ValidationIssue[];
  data?: EpisodioPayload;
  /** Solo presente cuando el resultado viene de un registro exitoso (POST /episodes). */
  episodeId?: string;
  /** Hash del documento off-chain, para registro on-chain. */
  documentHash?: string;
}

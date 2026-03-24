/**
 * Tipos del episodio clinico de urgencias.
 * Alineados con backend (hceModel / episodioFhirLikeSchema) para validacion y registro.
 */

export interface FhirIdentifier {
  system?: string;
  value: string;
  type?: FhirCodeableConcept;
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

export interface FhirExtension {
  url: string;
  valueString?: string;
  valueCode?: string;
  valueInteger?: number;
  valueDateTime?: string;
  valueCodeableConcept?: FhirCodeableConcept;
}

export interface FhirReference {
  reference?: string;
  display?: string;
  identifier?: FhirIdentifier;
}

export interface FhirAddress {
  country?: string;
  text?: string;
  extension?: FhirExtension[];
}

export interface FhirPeriod {
  start: string;
  end?: string;
}

export interface FhirTiming {
  repeat?: {
    frequency?: number;
    period?: number;
    periodUnit?: string;
    count?: number;
    duration?: number;
    durationUnit?: string;
  };
}

export interface EpisodioPatient {
  resourceType: "Patient";
  identifier: FhirIdentifier[];
  name: Array<{ family: string; given: string[] }>;
  birthDate: string;
  gender?: "male" | "female" | "other" | "unknown";
  extension?: FhirExtension[];
  address?: FhirAddress[];
}

export interface EpisodioOrganization {
  resourceType: "Organization";
  identifier: FhirIdentifier[];
  name?: string;
}

export interface EpisodioCoverage {
  resourceType: "Coverage";
  beneficiary: FhirReference;
  payor: Array<{
    reference?: string;
    display?: string;
    identifier: FhirIdentifier;
  }>;
}

export interface EpisodioEncounter {
  resourceType: "Encounter";
  status: "planned" | "in-progress" | "finished";
  class: FhirCodeableConcept;
  type?: FhirCodeableConcept[];
  serviceType?: FhirCodeableConcept;
  subject: FhirReference;
  serviceProvider: FhirReference;
  period: FhirPeriod;
  reasonCode?: FhirCodeableConcept[];
  priority?: FhirCodeableConcept;
  hospitalization?: {
    dischargeDisposition?: FhirCodeableConcept;
  };
  participant?: Array<{
    individual: FhirReference;
  }>;
  extension?: FhirExtension[];
}

export interface EpisodioCondition {
  resourceType: "Condition";
  code: FhirCodeableConcept;
  subject: FhirReference;
  encounter?: FhirReference;
  category?: FhirCodeableConcept[];
}

export interface EpisodioPractitioner {
  resourceType: "Practitioner";
  identifier: FhirIdentifier[];
  name?: Array<{
    family?: string;
    given?: string[];
  }>;
}

export interface EpisodioObservation {
  resourceType: "Observation";
  code: FhirCodeableConcept;
  subject: FhirReference;
  encounter?: FhirReference;
  effectiveDateTime?: string;
  valueString?: string;
  valueQuantity?: {
    value: number;
    unit?: string;
    system?: string;
    code?: string;
  };
  method?: FhirCodeableConcept;
}

export interface EpisodioProcedure {
  resourceType: "Procedure";
  code: FhirCodeableConcept;
  subject: FhirReference;
  encounter?: FhirReference;
  performedDateTime?: string;
  category?: FhirCodeableConcept;
  reasonCode?: FhirCodeableConcept[];
  performer?: Array<{
    actor: FhirReference;
  }>;
}

export interface EpisodioMedication {
  resourceType: "Medication";
  code: FhirCodeableConcept;
}

export interface EpisodioDosage {
  text?: string;
  route?: FhirCodeableConcept;
  doseAndRate?: Array<{
    doseQuantity?: {
      value: number;
      unit?: string;
      system?: string;
      code?: string;
    };
  }>;
  timing?: FhirTiming;
}

export interface EpisodioMedicationRequest {
  resourceType: "MedicationRequest";
  medicationCodeableConcept?: FhirCodeableConcept;
  subject: FhirReference;
  encounter?: FhirReference;
  authoredOn?: string;
  dosageInstruction?: EpisodioDosage[];
  reasonCode?: FhirCodeableConcept[];
  category?: FhirCodeableConcept[];
}

export interface EpisodioMedicationAdministration {
  resourceType: "MedicationAdministration";
  medicationCodeableConcept?: FhirCodeableConcept;
  subject: FhirReference;
  encounter?: FhirReference;
  effectiveDateTime?: string;
  route?: FhirCodeableConcept;
  dosage?: {
    dose?: {
      value: number;
      unit?: string;
      system?: string;
      code?: string;
    };
  };
  performer?: Array<{
    actor: FhirReference;
  }>;
  category?: FhirCodeableConcept;
}

export interface EpisodioServiceRequest {
  resourceType: "ServiceRequest";
  code: FhirCodeableConcept;
  subject: FhirReference;
  encounter?: FhirReference;
  authoredOn?: string;
  reasonCode?: FhirCodeableConcept[];
  category?: FhirCodeableConcept[];
}

export interface EpisodioDocumentReference {
  resourceType: "DocumentReference";
  subject?: FhirReference;
  content: Array<{
    attachment: {
      url?: string;
      title?: string;
      contentType?: string;
      hash?: string;
    };
  }>;
}

export interface EpisodioAllergyIntolerance {
  resourceType: "AllergyIntolerance";
  code: FhirCodeableConcept;
  patient: FhirReference;
}

export interface EpisodioFamilyMemberHistory {
  resourceType: "FamilyMemberHistory";
  relationship: FhirCodeableConcept;
  condition?: Array<{
    code: FhirCodeableConcept;
  }>;
}

export interface EpisodioPayload {
  patient: EpisodioPatient;
  cobertura: EpisodioCoverage;
  encounter: EpisodioEncounter;
  prestadorOrigen: EpisodioOrganization;
  prestadorDestino?: EpisodioOrganization;
  diagnosticoIngreso: EpisodioCondition;
  diagnosticoEgreso?: EpisodioCondition;
  diagnosticosRelacionados?: EpisodioCondition[];
  diagnosticosComplicacion?: EpisodioCondition[];
  causaBasicaMuerte?: EpisodioCondition;
  antecedentes?: {
    alergias?: EpisodioAllergyIntolerance[];
    antecedentesFamiliares?: EpisodioFamilyMemberHistory[];
    factoresRiesgo?: EpisodioObservation[];
  };
  procedimientosRealizados?: Array<
    EpisodioProcedure & {
      resultados?: EpisodioObservation[];
      profesionalResponsable?: EpisodioPractitioner;
    }
  >;
  tecnologiasAdministradas?: Array<
    EpisodioProcedure & {
      profesionalResponsable?: EpisodioPractitioner;
    }
  >;
  medicamentosAdministrados?: Array<
    EpisodioMedicationAdministration & {
      medication?: EpisodioMedication;
      prescripcion?: EpisodioMedicationRequest;
      profesionalResponsable?: EpisodioPractitioner;
    }
  >;
  medicamentosEgreso?: Array<
    EpisodioMedicationRequest & {
      medication?: EpisodioMedication;
    }
  >;
  procedimientosOrdenadosEgreso?: EpisodioServiceRequest[];
  tecnologiasOrdenadasEgreso?: EpisodioServiceRequest[];
  incapacidad?: EpisodioObservation;
  profesionalAlta?: EpisodioPractitioner;
  documentoSoporte?: EpisodioDocumentReference;
}

export interface EventoUrgencias {
  eventoUrgenciasId: string;
  fechaHoraInicio: string;
  ipsOrigenId: string;
  tipoAtencion: string;
}

export interface OnChainMetadata {
  episodeId: string;
  documentHash: string;
  patientIdentifierHash?: string;
  prestadorOrigenHash?: string;
  createdAt: string;
}

export interface VersionEpisodio {
  version: number;
  actualizadoEn: string;
  actor: {
    rol: string;
    ipsId?: string;
    usuarioId?: string;
  };
  documentHash: string;
  onChain: OnChainMetadata;
}

export interface TraceabilityEvent {
  traceId: string;
  episodeId: string;
  eventType:
    | "EPISODE_CREATED"
    | "EPISODE_UPDATED"
    | "PERMISSION_GRANTED"
    | "PERMISSION_REVOKED"
    | "AUDITABLE_ACCESS"
    | "INTEGRITY_CHECK";
  recordedAt: string;
  actor: {
    rol: string;
    ipsId?: string;
    usuarioId?: string;
  };
  metadata: Record<string, string | number | boolean | null | undefined>;
  evidence: {
    ledgerMode: "simulado" | "real";
    network: string;
    chainId: number;
    contractAddress?: string;
    transactionHash: string;
    explorerUrl?: string;
    emitterId?: string;
    metricsMode?: "measured" | "estimated";
    submittedAt?: string;
    confirmedAt?: string;
    confirmationMs?: number;
    gasUsed?: string;
    gasPriceWei?: string;
    transactionCostWei?: string;
    blockNumber?: number;
  };
}

export interface EstadoPermisoEpisodio {
  episodeId: string;
  sourceIpsId: string;
  targetIpsId: string;
  activo: boolean;
  grantedAt?: string;
  revokedAt?: string;
  ultimoCambioEn: string;
}


export interface ContinuidadEpisodio {
  ownerIpsId?: string;
  ipsInvolucradas: string[];
}

export interface BusquedaTrazabilidad {
  total: number;
  events: TraceabilityEvent[];
  filters: {
    episodeId?: string;
    eventType?: TraceabilityEvent["eventType"];
    ipsId?: string;
  };
}

export interface IntegridadEpisodio {
  episodeId: string;
  onChainHash: string;
  offChainHash: string;
  isIntegrityValid: boolean;
  checkedAt: string;
  evidence: {
    sourceTraceId: string;
    sourceTransactionHash: string;
    contractAddress?: string;
    network: string;
    auditTrace: TraceabilityEvent;
  };
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
  episodeId?: string;
  documentHash?: string;
  event?: EventoUrgencias;
  version?: number;
  onChainMetadata?: OnChainMetadata;
  traceEvent?: TraceabilityEvent;
}

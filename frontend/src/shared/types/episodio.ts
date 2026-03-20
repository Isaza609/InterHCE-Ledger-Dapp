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
  /** Solo presente cuando el resultado viene de un registro exitoso (POST /episodes). */
  episodeId?: string;
  /** Hash del documento off-chain, para registro on-chain. */
  documentHash?: string;
  event?: EventoUrgencias;
  version?: number;
  onChainMetadata?: OnChainMetadata;
  traceEvent?: TraceabilityEvent;
}

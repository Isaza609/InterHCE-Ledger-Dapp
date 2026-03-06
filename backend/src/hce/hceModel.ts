// Modelo FHIR-like del episodio de urgencias, alineado con Mapeo_RDA_FHIR_urgencias.md

// Tipos básicos reutilizables

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
  start: string;
  end?: string;
}

// Recursos principales

export interface FhirPatient {
  resourceType: "Patient";
  identifier: FhirIdentifier[];
  name: Array<{
    family: string;
    given: string[];
  }>;
  birthDate: string; // YYYY-MM-DD
  gender?: "male" | "female" | "other" | "unknown";
  // Campos sociodemográficos adicionales se modelan off-chain
}

export interface FhirOrganization {
  resourceType: "Organization";
  identifier: FhirIdentifier[];
  name?: string;
}

export interface FhirEncounter {
  resourceType: "Encounter";
  status: "planned" | "in-progress" | "finished";
  class: FhirCodeableConcept; // entorno/modalidad
  type?: FhirCodeableConcept[]; // grupo de servicios / tipo de episodio
  subject: FhirReference; // -> Patient
  serviceProvider: FhirReference; // -> Organization (IPS)
  period: FhirPeriod; // inicio / fin atención
  reasonCode?: FhirCodeableConcept[]; // causa que motiva la atención
  priority?: FhirCodeableConcept; // triage / prioridad
  diagnosis?: Array<{
    condition: FhirReference;
    use?: FhirCodeableConcept;
  }>;
  hospitalization?: {
    dischargeDisposition?: FhirCodeableConcept;
  };
}

export interface FhirCondition {
  resourceType: "Condition";
  code: FhirCodeableConcept; // CIE-10 / CIE-11
  subject: FhirReference; // -> Patient
  encounter?: FhirReference; // -> Encounter
  category?: FhirCodeableConcept[]; // tipo de diagnóstico (ingreso/egreso, principal/relacionado, etc.)
}

export interface FhirPractitioner {
  resourceType: "Practitioner";
  identifier: FhirIdentifier[];
  name?: Array<{
    family?: string;
    given?: string[];
  }>;
}

export interface FhirObservation {
  resourceType: "Observation";
  code: FhirCodeableConcept;
  subject: FhirReference; // -> Patient
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

export interface FhirProcedure {
  resourceType: "Procedure";
  code: FhirCodeableConcept; // CUPS u otro catálogo
  subject: FhirReference; // -> Patient
  encounter?: FhirReference;
  performedDateTime?: string;
  category?: FhirCodeableConcept; // tipo de tecnología
  reasonCode?: FhirCodeableConcept[]; // finalidad
  performer?: Array<{
    actor: FhirReference; // -> Practitioner u Organization
  }>;
}

export interface FhirMedication {
  resourceType: "Medication";
  code: FhirCodeableConcept; // ATC / INVIMA
}

export interface FhirDosage {
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
}

export interface FhirMedicationRequest {
  resourceType: "MedicationRequest";
  medicationCodeableConcept?: FhirCodeableConcept;
  subject: FhirReference; // -> Patient
  encounter?: FhirReference;
  authoredOn?: string;
  dosageInstruction?: FhirDosage[];
  reasonCode?: FhirCodeableConcept[]; // finalidad
}

export interface FhirMedicationAdministration {
  resourceType: "MedicationAdministration";
  medicationCodeableConcept?: FhirCodeableConcept;
  subject: FhirReference; // -> Patient
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
    actor: FhirReference; // -> Practitioner
  }>;
}

export interface FhirServiceRequest {
  resourceType: "ServiceRequest";
  code: FhirCodeableConcept; // procedimiento / tecnología ordenada
  subject: FhirReference; // -> Patient
  encounter?: FhirReference;
  authoredOn?: string;
  reasonCode?: FhirCodeableConcept[]; // finalidad
  category?: FhirCodeableConcept[]; // tipo tecnología
}

export interface FhirDocumentReference {
  resourceType: "DocumentReference";
  subject?: FhirReference; // -> Patient
  content: Array<{
    attachment: {
      url?: string;
      title?: string;
      contentType?: string;
      hash?: string; // hash del PDF
    };
  }>;
}

export interface FhirAllergyIntolerance {
  resourceType: "AllergyIntolerance";
  code: FhirCodeableConcept;
  patient: FhirReference;
}

export interface FhirFamilyMemberHistory {
  resourceType: "FamilyMemberHistory";
  relationship: FhirCodeableConcept;
  condition?: Array<{
    code: FhirCodeableConcept;
  }>;
}

// Agregado principal del episodio de urgencias usado por el backend

export interface EpisodioClinicoUrgencias {
  patient: FhirPatient;
  encounter: FhirEncounter;

  // IPS origen/destino
  prestadorOrigen: FhirOrganization;
  prestadorDestino?: FhirOrganization;

  // Diagnósticos principales
  diagnosticoIngreso: FhirCondition;
  diagnosticoEgreso?: FhirCondition;
  otrosDiagnosticos?: FhirCondition[];

  // Antecedentes relevantes
  antecedentes?: {
    alergias?: FhirAllergyIntolerance[];
    antecedentesFamiliares?: FhirFamilyMemberHistory[];
    factoresRiesgo?: FhirObservation[];
  };

  // Procedimientos y tecnologías en urgencias
  procedimientosRealizados?: FhirProcedure[];
  tecnologiasAdministradas?: FhirProcedure[];

  // Medicación en urgencias
  medicamentosAdministrados?: FhirMedicationAdministration[];

  // Órdenes al egreso
  medicamentosEgreso?: FhirMedicationRequest[];
  procedimientosOrdenadosEgreso?: FhirServiceRequest[];
  tecnologiasOrdenadasEgreso?: FhirServiceRequest[];

  // Documento clínico soporte (PDF u otro)
  documentoSoporte?: FhirDocumentReference;
}

// Alias de compatibilidad con el nombre anterior
export type FhirEpisodePayload = EpisodioClinicoUrgencias;



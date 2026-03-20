// Modelo FHIR-like del episodio de urgencias, alineado con
// Caracterizacion_RDA_Completa.csv y Mapeo_RDA_FHIR_urgencias.md.

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

export interface FhirPatient {
  resourceType: "Patient";
  identifier: FhirIdentifier[];
  name: Array<{
    family: string;
    given: string[];
  }>;
  birthDate: string;
  gender?: "male" | "female" | "other" | "unknown";
  extension?: FhirExtension[];
  address?: FhirAddress[];
}

export interface FhirOrganization {
  resourceType: "Organization";
  identifier: FhirIdentifier[];
  name?: string;
}

export interface FhirCoverage {
  resourceType: "Coverage";
  beneficiary: FhirReference;
  payor: Array<{
    reference?: string;
    display?: string;
    identifier: FhirIdentifier;
  }>;
}

export interface FhirEncounter {
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
  diagnosis?: Array<{
    condition: FhirReference;
    use?: FhirCodeableConcept;
  }>;
  hospitalization?: {
    dischargeDisposition?: FhirCodeableConcept;
  };
  participant?: Array<{
    individual: FhirReference;
  }>;
  extension?: FhirExtension[];
}

export interface FhirCondition {
  resourceType: "Condition";
  code: FhirCodeableConcept;
  subject: FhirReference;
  encounter?: FhirReference;
  category?: FhirCodeableConcept[];
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

export interface FhirProcedure {
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

export interface FhirMedication {
  resourceType: "Medication";
  code: FhirCodeableConcept;
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
  timing?: FhirTiming;
}

export interface FhirMedicationRequest {
  resourceType: "MedicationRequest";
  medicationCodeableConcept?: FhirCodeableConcept;
  subject: FhirReference;
  encounter?: FhirReference;
  authoredOn?: string;
  dosageInstruction?: FhirDosage[];
  reasonCode?: FhirCodeableConcept[];
  category?: FhirCodeableConcept[];
}

export interface FhirMedicationAdministration {
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

export interface FhirServiceRequest {
  resourceType: "ServiceRequest";
  code: FhirCodeableConcept;
  subject: FhirReference;
  encounter?: FhirReference;
  authoredOn?: string;
  reasonCode?: FhirCodeableConcept[];
  category?: FhirCodeableConcept[];
}

export interface FhirDocumentReference {
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

export interface EpisodioClinicoUrgencias {
  patient: FhirPatient;
  cobertura: FhirCoverage;
  encounter: FhirEncounter;

  prestadorOrigen: FhirOrganization;
  prestadorDestino?: FhirOrganization;

  diagnosticoIngreso: FhirCondition;
  diagnosticoEgreso?: FhirCondition;
  diagnosticosRelacionados?: FhirCondition[];
  diagnosticosComplicacion?: FhirCondition[];
  causaBasicaMuerte?: FhirCondition;

  antecedentes?: {
    alergias?: FhirAllergyIntolerance[];
    antecedentesFamiliares?: FhirFamilyMemberHistory[];
    factoresRiesgo?: FhirObservation[];
  };

  procedimientosRealizados?: Array<
    FhirProcedure & {
      resultados?: FhirObservation[];
      profesionalResponsable?: FhirPractitioner;
    }
  >;
  tecnologiasAdministradas?: Array<
    FhirProcedure & {
      profesionalResponsable?: FhirPractitioner;
    }
  >;

  medicamentosAdministrados?: Array<
    FhirMedicationAdministration & {
      medication?: FhirMedication;
      prescripcion?: FhirMedicationRequest;
      profesionalResponsable?: FhirPractitioner;
    }
  >;

  medicamentosEgreso?: Array<
    FhirMedicationRequest & {
      medication?: FhirMedication;
    }
  >;
  procedimientosOrdenadosEgreso?: FhirServiceRequest[];
  tecnologiasOrdenadasEgreso?: FhirServiceRequest[];

  incapacidad?: FhirObservation;
  profesionalAlta?: FhirPractitioner;
  documentoSoporte?: FhirDocumentReference;
}

export type FhirEpisodePayload = EpisodioClinicoUrgencias;

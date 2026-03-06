import { z } from "zod";

// Esquemas Zod FHIR-like, alineados con Mapeo_RDA_FHIR_urgencias.md y hceModel.ts

const identifierSchema = z.object({
  system: z.string().url().optional(),
  value: z.string().min(1)
});

const codingSchema = z.object({
  system: z.string().url().optional(),
  code: z.string().min(1),
  display: z.string().optional()
});

const codeableConceptSchema = z.object({
  coding: z.array(codingSchema).optional(),
  text: z.string().optional()
});

const referenceSchema = z.object({
  reference: z.string().optional(),
  display: z.string().optional()
});

/**
 * Normaliza a "YYYY-MM-DDTHH:mm:ss" y añade "Z" para que Zod .datetime() acepte.
 * Acepta: "YYYY-MM-DD", "YYYY-MM-DDTHH:mm:ss", o ya con "Z" / offset.
 */
function toIsoDateTime(s: string): string {
  const t = s.trim();
  if (/[Z+-]\d{2}:?\d{2}$/.test(t)) return t; // ya tiene Z o offset
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?$/i.test(t)) return t.endsWith("Z") ? t : `${t.replace(/\.\d+$/i, "")}Z`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return `${t}T00:00:00Z`;
  return t;
}

const datetimeOrDateSchema = z
  .string()
  .min(1)
  .transform(toIsoDateTime)
  .pipe(z.string().datetime({ offset: false }));

const periodSchema = z.object({
  start: datetimeOrDateSchema,
  end: z
    .string()
    .optional()
    .transform((s) => {
      if (s === undefined || s === null || !String(s).trim()) return undefined;
      return toIsoDateTime(String(s).trim());
    })
    .pipe(z.union([z.string().datetime({ offset: false }), z.undefined()]))
});

// Recursos base

const patientSchema = z.object({
  resourceType: z.literal("Patient"),
  identifier: z.array(identifierSchema).min(1),
  name: z
    .array(
      z.object({
        family: z.string().min(1),
        given: z.array(z.string().min(1)).min(1)
      })
    )
    .min(1),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  gender: z.enum(["male", "female", "other", "unknown"]).optional()
});

const organizationSchema = z.object({
  resourceType: z.literal("Organization"),
  identifier: z.array(identifierSchema).min(1),
  name: z.string().optional()
});

const encounterSchema = z.object({
  resourceType: z.literal("Encounter"),
  status: z.enum(["planned", "in-progress", "finished"]),
  class: codeableConceptSchema,
  type: z.array(codeableConceptSchema).optional(),
  subject: referenceSchema,
  serviceProvider: referenceSchema,
  period: periodSchema,
  reasonCode: z.array(codeableConceptSchema).optional(),
  priority: codeableConceptSchema.optional(),
  diagnosis: z
    .array(
      z.object({
        condition: referenceSchema,
        use: codeableConceptSchema.optional()
      })
    )
    .optional(),
  hospitalization: z
    .object({
      dischargeDisposition: codeableConceptSchema.optional()
    })
    .optional()
});

const conditionSchema = z.object({
  resourceType: z.literal("Condition"),
  code: codeableConceptSchema,
  subject: referenceSchema,
  encounter: referenceSchema.optional(),
  category: z.array(codeableConceptSchema).optional()
});

const practitionerSchema = z.object({
  resourceType: z.literal("Practitioner"),
  identifier: z.array(identifierSchema).min(1),
  name: z
    .array(
      z.object({
        family: z.string().optional(),
        given: z.array(z.string().min(1)).optional()
      })
    )
    .optional()
});

const observationSchema = z.object({
  resourceType: z.literal("Observation"),
  code: codeableConceptSchema,
  subject: referenceSchema,
  encounter: referenceSchema.optional(),
  effectiveDateTime: z.string().datetime({ offset: false }).optional(),
  valueString: z.string().optional(),
  valueQuantity: z
    .object({
      value: z.number(),
      unit: z.string().optional(),
      system: z.string().url().optional(),
      code: z.string().optional()
    })
    .optional(),
  method: codeableConceptSchema.optional()
});

const procedureSchema = z.object({
  resourceType: z.literal("Procedure"),
  code: codeableConceptSchema,
  subject: referenceSchema,
  encounter: referenceSchema.optional(),
  performedDateTime: z.string().datetime({ offset: false }).optional(),
  category: codeableConceptSchema.optional(),
  reasonCode: z.array(codeableConceptSchema).optional(),
  performer: z
    .array(
      z.object({
        actor: referenceSchema
      })
    )
    .optional()
});

const dosageSchema = z.object({
  text: z.string().optional(),
  route: codeableConceptSchema.optional(),
  doseAndRate: z
    .array(
      z.object({
        doseQuantity: z
          .object({
            value: z.number(),
            unit: z.string().optional(),
            system: z.string().url().optional(),
            code: z.string().optional()
          })
          .optional()
      })
    )
    .optional()
});

const medicationRequestSchema = z.object({
  resourceType: z.literal("MedicationRequest"),
  medicationCodeableConcept: codeableConceptSchema.optional(),
  subject: referenceSchema,
  encounter: referenceSchema.optional(),
  authoredOn: z.string().datetime({ offset: false }).optional(),
  dosageInstruction: z.array(dosageSchema).optional(),
  reasonCode: z.array(codeableConceptSchema).optional()
});

const medicationAdministrationSchema = z.object({
  resourceType: z.literal("MedicationAdministration"),
  medicationCodeableConcept: codeableConceptSchema.optional(),
  subject: referenceSchema,
  encounter: referenceSchema.optional(),
  effectiveDateTime: z.string().datetime({ offset: false }).optional(),
  route: codeableConceptSchema.optional(),
  dosage: z
    .object({
      dose: z
        .object({
          value: z.number(),
          unit: z.string().optional(),
          system: z.string().url().optional(),
          code: z.string().optional()
        })
        .optional()
    })
    .optional(),
  performer: z
    .array(
      z.object({
        actor: referenceSchema
      })
    )
    .optional()
});

const serviceRequestSchema = z.object({
  resourceType: z.literal("ServiceRequest"),
  code: codeableConceptSchema,
  subject: referenceSchema,
  encounter: referenceSchema.optional(),
  authoredOn: z.string().datetime({ offset: false }).optional(),
  reasonCode: z.array(codeableConceptSchema).optional(),
  category: z.array(codeableConceptSchema).optional()
});

const documentReferenceSchema = z.object({
  resourceType: z.literal("DocumentReference"),
  subject: referenceSchema.optional(),
  content: z
    .array(
      z.object({
        attachment: z.object({
          url: z.string().url().optional(),
          title: z.string().optional(),
          contentType: z.string().optional(),
          hash: z.string().optional()
        })
      })
    )
    .min(1)
});

const allergyIntoleranceSchema = z.object({
  resourceType: z.literal("AllergyIntolerance"),
  code: codeableConceptSchema,
  patient: referenceSchema
});

const familyMemberHistorySchema = z.object({
  resourceType: z.literal("FamilyMemberHistory"),
  relationship: codeableConceptSchema,
  condition: z
    .array(
      z.object({
        code: codeableConceptSchema
      })
    )
    .optional()
});

// Esquema raíz del episodio de urgencias

export const episodioFhirLikeSchema = z.object({
  patient: patientSchema,
  encounter: encounterSchema,

  prestadorOrigen: organizationSchema,
  prestadorDestino: organizationSchema.optional(),

  diagnosticoIngreso: conditionSchema,
  diagnosticoEgreso: conditionSchema.optional(),
  otrosDiagnosticos: z.array(conditionSchema).optional(),

  antecedentes: z
    .object({
      alergias: z.array(allergyIntoleranceSchema).optional(),
      antecedentesFamiliares: z
        .array(familyMemberHistorySchema)
        .optional(),
      factoresRiesgo: z.array(observationSchema).optional()
    })
    .optional(),

  procedimientosRealizados: z.array(procedureSchema).optional(),
  tecnologiasAdministradas: z.array(procedureSchema).optional(),

  medicamentosAdministrados: z
    .array(medicationAdministrationSchema)
    .optional(),

  medicamentosEgreso: z.array(medicationRequestSchema).optional(),
  procedimientosOrdenadosEgreso: z
    .array(serviceRequestSchema)
    .optional(),
  tecnologiasOrdenadasEgreso: z.array(serviceRequestSchema).optional(),

  documentoSoporte: documentReferenceSchema.optional()
});

export type EpisodioFhirLikeInput = z.infer<typeof episodioFhirLikeSchema>;


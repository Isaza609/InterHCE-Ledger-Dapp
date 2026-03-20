"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.episodioFhirLikeSchema = void 0;
const zod_1 = require("zod");
// Esquemas Zod FHIR-like, alineados con Mapeo_RDA_FHIR_urgencias.md y hceModel.ts
const identifierSchema = zod_1.z.object({
    system: zod_1.z.string().url().optional(),
    value: zod_1.z.string().min(1)
});
const codingSchema = zod_1.z.object({
    system: zod_1.z.string().url().optional(),
    code: zod_1.z.string().min(1),
    display: zod_1.z.string().optional()
});
const codeableConceptSchema = zod_1.z.object({
    coding: zod_1.z.array(codingSchema).optional(),
    text: zod_1.z.string().optional()
});
const referenceSchema = zod_1.z.object({
    reference: zod_1.z.string().optional(),
    display: zod_1.z.string().optional()
});
/**
 * Normaliza a "YYYY-MM-DDTHH:mm:ss" y añade "Z" para que Zod .datetime() acepte.
 * Acepta: "YYYY-MM-DD", "YYYY-MM-DDTHH:mm:ss", o ya con "Z" / offset.
 */
function toIsoDateTime(s) {
    const t = s.trim();
    if (/[Z+-]\d{2}:?\d{2}$/.test(t))
        return t; // ya tiene Z o offset
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?$/i.test(t))
        return t.endsWith("Z") ? t : `${t.replace(/\.\d+$/i, "")}Z`;
    if (/^\d{4}-\d{2}-\d{2}$/.test(t))
        return `${t}T00:00:00Z`;
    return t;
}
const datetimeOrDateSchema = zod_1.z
    .string()
    .min(1)
    .transform(toIsoDateTime)
    .pipe(zod_1.z.string().datetime({ offset: false }));
const periodSchema = zod_1.z.object({
    start: datetimeOrDateSchema,
    end: zod_1.z
        .string()
        .optional()
        .transform((s) => {
        if (s === undefined || s === null || !String(s).trim())
            return undefined;
        return toIsoDateTime(String(s).trim());
    })
        .pipe(zod_1.z.union([zod_1.z.string().datetime({ offset: false }), zod_1.z.undefined()]))
});
// Recursos base
const patientSchema = zod_1.z.object({
    resourceType: zod_1.z.literal("Patient"),
    identifier: zod_1.z.array(identifierSchema).min(1),
    name: zod_1.z
        .array(zod_1.z.object({
        family: zod_1.z.string().min(1),
        given: zod_1.z.array(zod_1.z.string().min(1)).min(1)
    }))
        .min(1),
    birthDate: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    gender: zod_1.z.enum(["male", "female", "other", "unknown"]).optional()
});
const organizationSchema = zod_1.z.object({
    resourceType: zod_1.z.literal("Organization"),
    identifier: zod_1.z.array(identifierSchema).min(1),
    name: zod_1.z.string().optional()
});
const encounterSchema = zod_1.z.object({
    resourceType: zod_1.z.literal("Encounter"),
    status: zod_1.z.enum(["planned", "in-progress", "finished"]),
    class: codeableConceptSchema,
    type: zod_1.z.array(codeableConceptSchema).optional(),
    subject: referenceSchema,
    serviceProvider: referenceSchema,
    period: periodSchema,
    reasonCode: zod_1.z.array(codeableConceptSchema).optional(),
    priority: codeableConceptSchema.optional(),
    diagnosis: zod_1.z
        .array(zod_1.z.object({
        condition: referenceSchema,
        use: codeableConceptSchema.optional()
    }))
        .optional(),
    hospitalization: zod_1.z
        .object({
        dischargeDisposition: codeableConceptSchema.optional()
    })
        .optional()
});
const conditionSchema = zod_1.z.object({
    resourceType: zod_1.z.literal("Condition"),
    code: codeableConceptSchema,
    subject: referenceSchema,
    encounter: referenceSchema.optional(),
    category: zod_1.z.array(codeableConceptSchema).optional()
});
const practitionerSchema = zod_1.z.object({
    resourceType: zod_1.z.literal("Practitioner"),
    identifier: zod_1.z.array(identifierSchema).min(1),
    name: zod_1.z
        .array(zod_1.z.object({
        family: zod_1.z.string().optional(),
        given: zod_1.z.array(zod_1.z.string().min(1)).optional()
    }))
        .optional()
});
const observationSchema = zod_1.z.object({
    resourceType: zod_1.z.literal("Observation"),
    code: codeableConceptSchema,
    subject: referenceSchema,
    encounter: referenceSchema.optional(),
    effectiveDateTime: zod_1.z.string().datetime({ offset: false }).optional(),
    valueString: zod_1.z.string().optional(),
    valueQuantity: zod_1.z
        .object({
        value: zod_1.z.number(),
        unit: zod_1.z.string().optional(),
        system: zod_1.z.string().url().optional(),
        code: zod_1.z.string().optional()
    })
        .optional(),
    method: codeableConceptSchema.optional()
});
const procedureSchema = zod_1.z.object({
    resourceType: zod_1.z.literal("Procedure"),
    code: codeableConceptSchema,
    subject: referenceSchema,
    encounter: referenceSchema.optional(),
    performedDateTime: zod_1.z.string().datetime({ offset: false }).optional(),
    category: codeableConceptSchema.optional(),
    reasonCode: zod_1.z.array(codeableConceptSchema).optional(),
    performer: zod_1.z
        .array(zod_1.z.object({
        actor: referenceSchema
    }))
        .optional()
});
const dosageSchema = zod_1.z.object({
    text: zod_1.z.string().optional(),
    route: codeableConceptSchema.optional(),
    doseAndRate: zod_1.z
        .array(zod_1.z.object({
        doseQuantity: zod_1.z
            .object({
            value: zod_1.z.number(),
            unit: zod_1.z.string().optional(),
            system: zod_1.z.string().url().optional(),
            code: zod_1.z.string().optional()
        })
            .optional()
    }))
        .optional()
});
const medicationRequestSchema = zod_1.z.object({
    resourceType: zod_1.z.literal("MedicationRequest"),
    medicationCodeableConcept: codeableConceptSchema.optional(),
    subject: referenceSchema,
    encounter: referenceSchema.optional(),
    authoredOn: zod_1.z.string().datetime({ offset: false }).optional(),
    dosageInstruction: zod_1.z.array(dosageSchema).optional(),
    reasonCode: zod_1.z.array(codeableConceptSchema).optional()
});
const medicationAdministrationSchema = zod_1.z.object({
    resourceType: zod_1.z.literal("MedicationAdministration"),
    medicationCodeableConcept: codeableConceptSchema.optional(),
    subject: referenceSchema,
    encounter: referenceSchema.optional(),
    effectiveDateTime: zod_1.z.string().datetime({ offset: false }).optional(),
    route: codeableConceptSchema.optional(),
    dosage: zod_1.z
        .object({
        dose: zod_1.z
            .object({
            value: zod_1.z.number(),
            unit: zod_1.z.string().optional(),
            system: zod_1.z.string().url().optional(),
            code: zod_1.z.string().optional()
        })
            .optional()
    })
        .optional(),
    performer: zod_1.z
        .array(zod_1.z.object({
        actor: referenceSchema
    }))
        .optional()
});
const serviceRequestSchema = zod_1.z.object({
    resourceType: zod_1.z.literal("ServiceRequest"),
    code: codeableConceptSchema,
    subject: referenceSchema,
    encounter: referenceSchema.optional(),
    authoredOn: zod_1.z.string().datetime({ offset: false }).optional(),
    reasonCode: zod_1.z.array(codeableConceptSchema).optional(),
    category: zod_1.z.array(codeableConceptSchema).optional()
});
const documentReferenceSchema = zod_1.z.object({
    resourceType: zod_1.z.literal("DocumentReference"),
    subject: referenceSchema.optional(),
    content: zod_1.z
        .array(zod_1.z.object({
        attachment: zod_1.z.object({
            url: zod_1.z.string().url().optional(),
            title: zod_1.z.string().optional(),
            contentType: zod_1.z.string().optional(),
            hash: zod_1.z.string().optional()
        })
    }))
        .min(1)
});
const allergyIntoleranceSchema = zod_1.z.object({
    resourceType: zod_1.z.literal("AllergyIntolerance"),
    code: codeableConceptSchema,
    patient: referenceSchema
});
const familyMemberHistorySchema = zod_1.z.object({
    resourceType: zod_1.z.literal("FamilyMemberHistory"),
    relationship: codeableConceptSchema,
    condition: zod_1.z
        .array(zod_1.z.object({
        code: codeableConceptSchema
    }))
        .optional()
});
// Esquema raíz del episodio de urgencias
exports.episodioFhirLikeSchema = zod_1.z.object({
    patient: patientSchema,
    encounter: encounterSchema,
    prestadorOrigen: organizationSchema,
    prestadorDestino: organizationSchema.optional(),
    diagnosticoIngreso: conditionSchema,
    diagnosticoEgreso: conditionSchema.optional(),
    otrosDiagnosticos: zod_1.z.array(conditionSchema).optional(),
    antecedentes: zod_1.z
        .object({
        alergias: zod_1.z.array(allergyIntoleranceSchema).optional(),
        antecedentesFamiliares: zod_1.z
            .array(familyMemberHistorySchema)
            .optional(),
        factoresRiesgo: zod_1.z.array(observationSchema).optional()
    })
        .optional(),
    procedimientosRealizados: zod_1.z.array(procedureSchema).optional(),
    tecnologiasAdministradas: zod_1.z.array(procedureSchema).optional(),
    medicamentosAdministrados: zod_1.z
        .array(medicationAdministrationSchema)
        .optional(),
    medicamentosEgreso: zod_1.z.array(medicationRequestSchema).optional(),
    procedimientosOrdenadosEgreso: zod_1.z
        .array(serviceRequestSchema)
        .optional(),
    tecnologiasOrdenadasEgreso: zod_1.z.array(serviceRequestSchema).optional(),
    documentoSoporte: documentReferenceSchema.optional()
});

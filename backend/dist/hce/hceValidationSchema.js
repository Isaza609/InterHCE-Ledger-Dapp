"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.episodioFhirLikeSchema = void 0;
const zod_1 = require("zod");
// Esquemas Zod FHIR-like, alineados con Caracterizacion_RDA_Completa.csv.
const PATIENT_NATIONALITY_URL = "urn:interhce:rda:patient-nationality";
const PATIENT_GENDER_IDENTITY_URL = "urn:interhce:rda:patient-gender-identity";
const PATIENT_ETHNICITY_URL = "urn:interhce:rda:patient-ethnicity";
const PATIENT_ETHNIC_COMMUNITY_URL = "urn:interhce:rda:patient-ethnic-community";
const PATIENT_DISABILITY_URL = "urn:interhce:rda:patient-disability";
const PATIENT_OCCUPATION_URL = "urn:interhce:rda:patient-occupation";
const ADDRESS_MUNICIPALITY_URL = "urn:interhce:rda:address-municipality";
const ADDRESS_ZONE_URL = "urn:interhce:rda:address-zone";
const ENCOUNTER_ROUTE_URL = "urn:interhce:rda:encounter-route";
const ENCOUNTER_TRIAGE_TIME_URL = "urn:interhce:rda:encounter-triage-time";
const identifierSchema = zod_1.z.object({
    system: zod_1.z.string().url().optional(),
    value: zod_1.z.string().min(1),
    type: zod_1.z
        .object({
        coding: zod_1.z
            .array(zod_1.z.object({
            system: zod_1.z.string().url().optional(),
            code: zod_1.z.string().min(1),
            display: zod_1.z.string().optional()
        }))
            .optional(),
        text: zod_1.z.string().optional()
    })
        .optional()
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
const extensionSchema = zod_1.z.object({
    url: zod_1.z.string().min(1),
    valueString: zod_1.z.string().optional(),
    valueCode: zod_1.z.string().optional(),
    valueInteger: zod_1.z.number().int().optional(),
    valueDateTime: zod_1.z.string().optional(),
    valueCodeableConcept: codeableConceptSchema.optional()
});
const referenceSchema = zod_1.z.object({
    reference: zod_1.z.string().optional(),
    display: zod_1.z.string().optional(),
    identifier: identifierSchema.optional()
});
function toIsoDateTime(s) {
    const t = s.trim();
    if (/[Z+-]\d{2}:?\d{2}$/.test(t))
        return t;
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?$/i.test(t)) {
        return t.endsWith("Z") ? t : `${t.replace(/\.\d+$/i, "")}Z`;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(t))
        return `${t}T00:00:00Z`;
    return t;
}
const datetimeOrDateSchema = zod_1.z
    .string()
    .min(1)
    .transform(toIsoDateTime)
    .pipe(zod_1.z.string().datetime({ offset: false }));
const optionalDateTimeSchema = zod_1.z
    .string()
    .optional()
    .transform((s) => {
    if (s === undefined || s === null || !String(s).trim())
        return undefined;
    return toIsoDateTime(String(s).trim());
})
    .pipe(zod_1.z.union([zod_1.z.string().datetime({ offset: false }), zod_1.z.undefined()]));
const periodSchema = zod_1.z.object({
    start: datetimeOrDateSchema,
    end: optionalDateTimeSchema
});
const addressSchema = zod_1.z.object({
    country: zod_1.z.string().optional(),
    text: zod_1.z.string().optional(),
    extension: zod_1.z.array(extensionSchema).optional()
});
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
    gender: zod_1.z.enum(["male", "female", "other", "unknown"]).optional(),
    extension: zod_1.z.array(extensionSchema).optional(),
    address: zod_1.z.array(addressSchema).optional()
});
const organizationSchema = zod_1.z.object({
    resourceType: zod_1.z.literal("Organization"),
    identifier: zod_1.z.array(identifierSchema).min(1),
    name: zod_1.z.string().optional()
});
const coverageSchema = zod_1.z.object({
    resourceType: zod_1.z.literal("Coverage"),
    beneficiary: referenceSchema,
    payor: zod_1.z
        .array(zod_1.z.object({
        reference: zod_1.z.string().optional(),
        display: zod_1.z.string().optional(),
        identifier: identifierSchema
    }))
        .min(1)
});
const encounterSchema = zod_1.z.object({
    resourceType: zod_1.z.literal("Encounter"),
    status: zod_1.z.enum(["planned", "in-progress", "finished"]),
    class: codeableConceptSchema,
    type: zod_1.z.array(codeableConceptSchema).optional(),
    serviceType: codeableConceptSchema.optional(),
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
        .optional(),
    participant: zod_1.z
        .array(zod_1.z.object({
        individual: referenceSchema
    }))
        .optional(),
    extension: zod_1.z.array(extensionSchema).optional()
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
    effectiveDateTime: optionalDateTimeSchema,
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
    performedDateTime: optionalDateTimeSchema,
    category: codeableConceptSchema.optional(),
    reasonCode: zod_1.z.array(codeableConceptSchema).optional(),
    performer: zod_1.z
        .array(zod_1.z.object({
        actor: referenceSchema
    }))
        .optional()
});
const timingSchema = zod_1.z.object({
    repeat: zod_1.z
        .object({
        frequency: zod_1.z.number().int().positive().optional(),
        period: zod_1.z.number().positive().optional(),
        periodUnit: zod_1.z.string().optional(),
        count: zod_1.z.number().int().nonnegative().optional(),
        duration: zod_1.z.number().positive().optional(),
        durationUnit: zod_1.z.string().optional()
    })
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
        .optional(),
    timing: timingSchema.optional()
});
const medicationSchema = zod_1.z.object({
    resourceType: zod_1.z.literal("Medication"),
    code: codeableConceptSchema
});
const medicationRequestSchema = zod_1.z.object({
    resourceType: zod_1.z.literal("MedicationRequest"),
    medicationCodeableConcept: codeableConceptSchema.optional(),
    subject: referenceSchema,
    encounter: referenceSchema.optional(),
    authoredOn: optionalDateTimeSchema,
    dosageInstruction: zod_1.z.array(dosageSchema).optional(),
    reasonCode: zod_1.z.array(codeableConceptSchema).optional(),
    category: zod_1.z.array(codeableConceptSchema).optional()
});
const medicationAdministrationSchema = zod_1.z.object({
    resourceType: zod_1.z.literal("MedicationAdministration"),
    medicationCodeableConcept: codeableConceptSchema.optional(),
    subject: referenceSchema,
    encounter: referenceSchema.optional(),
    effectiveDateTime: optionalDateTimeSchema,
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
        .optional(),
    category: codeableConceptSchema.optional()
});
const serviceRequestSchema = zod_1.z.object({
    resourceType: zod_1.z.literal("ServiceRequest"),
    code: codeableConceptSchema,
    subject: referenceSchema,
    encounter: referenceSchema.optional(),
    authoredOn: optionalDateTimeSchema,
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
const procedureEntrySchema = procedureSchema.extend({
    resultados: zod_1.z.array(observationSchema).optional(),
    profesionalResponsable: practitionerSchema.optional()
});
const tecnologiaEntrySchema = procedureSchema.extend({
    profesionalResponsable: practitionerSchema.optional()
});
const medicationAdministrationEntrySchema = medicationAdministrationSchema.extend({
    medication: medicationSchema.optional(),
    prescripcion: medicationRequestSchema.optional(),
    profesionalResponsable: practitionerSchema.optional()
});
const medicationEgresoEntrySchema = medicationRequestSchema.extend({
    medication: medicationSchema.optional()
});
function getExtensionByUrl(extensions, url) {
    return extensions?.find((extension) => extension.url === url);
}
function hasCoding(concept) {
    return Boolean(concept?.coding?.[0]?.code || concept?.text);
}
function getPrimaryCode(concept) {
    return concept?.coding?.[0]?.code;
}
function requireCodeableConcept(concept, path, message, ctx) {
    if (!hasCoding(concept)) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            path,
            message
        });
    }
}
function requireExtensionValue(extensions, url, path, message, ctx, expected) {
    const extension = getExtensionByUrl(extensions, url);
    const ok = expected === "codeable"
        ? hasCoding(extension?.valueCodeableConcept)
        : expected === "string"
            ? Boolean(extension?.valueString?.trim())
            : Boolean(extension?.valueDateTime?.trim());
    if (!ok) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            path,
            message
        });
    }
}
exports.episodioFhirLikeSchema = zod_1.z
    .object({
    patient: patientSchema,
    cobertura: coverageSchema,
    encounter: encounterSchema,
    prestadorOrigen: organizationSchema,
    prestadorDestino: organizationSchema.optional(),
    diagnosticoIngreso: conditionSchema,
    diagnosticoEgreso: conditionSchema.optional(),
    diagnosticosRelacionados: zod_1.z.array(conditionSchema).optional(),
    diagnosticosComplicacion: zod_1.z.array(conditionSchema).optional(),
    causaBasicaMuerte: conditionSchema.optional(),
    antecedentes: zod_1.z
        .object({
        alergias: zod_1.z.array(allergyIntoleranceSchema).optional(),
        antecedentesFamiliares: zod_1.z.array(familyMemberHistorySchema).optional(),
        factoresRiesgo: zod_1.z.array(observationSchema).optional()
    })
        .optional(),
    procedimientosRealizados: zod_1.z.array(procedureEntrySchema).optional(),
    tecnologiasAdministradas: zod_1.z.array(tecnologiaEntrySchema).optional(),
    medicamentosAdministrados: zod_1.z.array(medicationAdministrationEntrySchema).optional(),
    medicamentosEgreso: zod_1.z.array(medicationEgresoEntrySchema).optional(),
    procedimientosOrdenadosEgreso: zod_1.z.array(serviceRequestSchema).optional(),
    tecnologiasOrdenadasEgreso: zod_1.z.array(serviceRequestSchema).optional(),
    incapacidad: observationSchema.optional(),
    profesionalAlta: practitionerSchema.optional(),
    documentoSoporte: documentReferenceSchema.optional()
})
    .superRefine((episodio, ctx) => {
    const patientIdentifier = episodio.patient.identifier[0];
    if (!patientIdentifier?.type?.coding?.[0]?.code) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            path: ["patient", "identifier", 0, "type"],
            message: "Debe informar el tipo de documento del paciente (RDA 2.1)."
        });
    }
    if (!/^\d{6,15}$/.test(patientIdentifier?.value ?? "")) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            path: ["patient", "identifier", 0, "value"],
            message: "El numero de documento del paciente debe tener entre 6 y 15 digitos."
        });
    }
    requireExtensionValue(episodio.patient.extension, PATIENT_NATIONALITY_URL, ["patient", "extension"], "Debe informar la nacionalidad del paciente (RDA 1.1 y 1.2).", ctx, "codeable");
    requireExtensionValue(episodio.patient.extension, PATIENT_OCCUPATION_URL, ["patient", "extension"], "Debe informar la ocupacion del paciente (RDA 7.1 y 7.2).", ctx, "codeable");
    const ethnicity = getExtensionByUrl(episodio.patient.extension, PATIENT_ETHNICITY_URL);
    const ethnicityCode = getPrimaryCode(ethnicity?.valueCodeableConcept);
    if (ethnicityCode && ethnicityCode !== "NINGUNO") {
        requireExtensionValue(episodio.patient.extension, PATIENT_ETHNIC_COMMUNITY_URL, ["patient", "extension"], "La comunidad etnica es obligatoria cuando se reporta etnia diferente de Ninguno.", ctx, "string");
    }
    if (!episodio.patient.address?.[0]?.country?.trim()) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            path: ["patient", "address", 0, "country"],
            message: "Debe informar el pais de residencia del paciente (RDA 11.1 y 11.2)."
        });
    }
    requireExtensionValue(episodio.patient.address?.[0]?.extension, ADDRESS_MUNICIPALITY_URL, ["patient", "address", 0, "extension"], "Debe informar el municipio de residencia del paciente (RDA 12.1 y 12.2).", ctx, "codeable");
    requireExtensionValue(episodio.patient.address?.[0]?.extension, ADDRESS_ZONE_URL, ["patient", "address", 0, "extension"], "Debe informar la zona territorial del paciente (RDA 14).", ctx, "codeable");
    if (!episodio.cobertura.payor[0]?.identifier?.value?.trim()) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            path: ["cobertura", "payor", 0, "identifier", "value"],
            message: "Debe informar el codigo del administrador del plan de beneficios (RDA 15.1)."
        });
    }
    if (!episodio.cobertura.payor[0]?.display?.trim()) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            path: ["cobertura", "payor", 0, "display"],
            message: "Debe informar el nombre del administrador del plan de beneficios (RDA 15.2)."
        });
    }
    requireCodeableConcept(episodio.encounter.class, ["encounter", "class"], "Debe informar el entorno de atencion (RDA 19).", ctx);
    requireCodeableConcept(episodio.encounter.type?.[0], ["encounter", "type", 0], "Debe informar la modalidad de tecnologia en salud (RDA 18.1).", ctx);
    requireCodeableConcept(episodio.encounter.serviceType, ["encounter", "serviceType"], "Debe informar el grupo de servicios (RDA 18.2).", ctx);
    requireCodeableConcept(episodio.encounter.reasonCode?.[0], ["encounter", "reasonCode", 0], "Debe informar la causa que motiva la atencion (RDA 21).", ctx);
    requireCodeableConcept(episodio.encounter.priority, ["encounter", "priority"], "Debe informar la clasificacion de triage (RDA 22).", ctx);
    requireExtensionValue(episodio.encounter.extension, ENCOUNTER_ROUTE_URL, ["encounter", "extension"], "Debe informar la via de ingreso del usuario (RDA 20).", ctx, "codeable");
    requireExtensionValue(episodio.encounter.extension, ENCOUNTER_TRIAGE_TIME_URL, ["encounter", "extension"], "Debe informar la fecha y hora del triage (RDA 22).", ctx, "datetime");
    requireCodeableConcept(episodio.diagnosticoIngreso.code, ["diagnosticoIngreso", "code"], "Debe informar el diagnostico principal de ingreso (RDA 23.1 y 23.2).", ctx);
    requireCodeableConcept(episodio.diagnosticoIngreso.category?.[0], ["diagnosticoIngreso", "category", 0], "Debe informar el tipo del diagnostico principal de ingreso (RDA 23.3).", ctx);
    if (episodio.encounter.status === "finished") {
        if (!episodio.encounter.period.end) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                path: ["encounter", "period", "end"],
                message: "La fecha/hora fin de atencion es obligatoria cuando el episodio esta finalizado (RDA 43)."
            });
        }
        requireCodeableConcept(episodio.encounter.hospitalization?.dischargeDisposition, ["encounter", "hospitalization", "dischargeDisposition"], "Debe informar la condicion y destino del egreso (RDA 41).", ctx);
        if (!episodio.prestadorDestino?.identifier?.[0]?.value?.trim()) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                path: ["prestadorDestino", "identifier", 0, "value"],
                message: "Debe informar el prestador destino al cierre del episodio (RDA 44)."
            });
        }
        if (!episodio.diagnosticoEgreso) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                path: ["diagnosticoEgreso"],
                message: "Debe informar el diagnostico principal de egreso cuando el episodio esta finalizado."
            });
        }
        else {
            requireCodeableConcept(episodio.diagnosticoEgreso.code, ["diagnosticoEgreso", "code"], "Debe informar el diagnostico principal de egreso (RDA 37.1 y 37.2).", ctx);
            requireCodeableConcept(episodio.diagnosticoEgreso.category?.[0], ["diagnosticoEgreso", "category", 0], "Debe informar el tipo del diagnostico principal de egreso (RDA 37.3).", ctx);
        }
        if (!episodio.profesionalAlta?.identifier?.[0]?.type?.coding?.[0]?.code) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                path: ["profesionalAlta", "identifier", 0, "type"],
                message: "Debe informar el tipo de documento del profesional que da el alta (RDA 49.1)."
            });
        }
        if (!episodio.profesionalAlta?.identifier?.[0]?.value?.trim()) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                path: ["profesionalAlta", "identifier", 0, "value"],
                message: "Debe informar el numero de documento del profesional que da el alta (RDA 49.2)."
            });
        }
        if (!episodio.documentoSoporte?.content?.[0]?.attachment?.title?.trim()) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                path: ["documentoSoporte", "content", 0, "attachment", "title"],
                message: "Debe informar el nombre del documento soporte (RDA documento PDF)."
            });
        }
    }
    if (episodio.encounter.period.end &&
        episodio.encounter.period.end < episodio.encounter.period.start) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            path: ["encounter", "period", "end"],
            message: "La fecha/hora fin de atencion no puede ser anterior al inicio."
        });
    }
    if (episodio.incapacidad) {
        requireCodeableConcept(episodio.incapacidad.code, ["incapacidad", "code"], "La incapacidad debe informar el alcance (RDA 45.1).", ctx);
        if (episodio.incapacidad.valueQuantity && episodio.incapacidad.valueQuantity.value < 0) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                path: ["incapacidad", "valueQuantity", "value"],
                message: "Los dias de incapacidad no pueden ser negativos."
            });
        }
    }
});

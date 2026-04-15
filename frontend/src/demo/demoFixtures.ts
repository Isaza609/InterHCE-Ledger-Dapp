/**
 * demoFixtures.ts — Payload ficticio pero estructuralmente válido para el TX Demo Panel.
 * Sigue el mismo patrón que backend/scripts/seed-evaluacion-demo.ts.
 * No debe usarse fuera de src/demo/.
 */
import type { EpisodioPayload } from "@/shared/types/episodio";

// URLs de extensión (idénticas a las del backend)
const NATIONALITY_URL   = "urn:interhce:rda:patient-nationality";
const GENDER_ID_URL     = "urn:interhce:rda:patient-gender-identity";
const ETHNICITY_URL     = "urn:interhce:rda:patient-ethnicity";
const ETHNIC_COM_URL    = "urn:interhce:rda:patient-ethnic-community";
const DISABILITY_URL    = "urn:interhce:rda:patient-disability";
const OCCUPATION_URL    = "urn:interhce:rda:patient-occupation";
const MUNICIPALITY_URL  = "urn:interhce:rda:address-municipality";
const ZONE_URL          = "urn:interhce:rda:address-zone";
const ROUTE_URL         = "urn:interhce:rda:encounter-route";
const TRIAGE_TIME_URL   = "urn:interhce:rda:encounter-triage-time";

/**
 * @param ipsId  Debe coincidir con sesion.ipsId del actor (x-ips-id header).
 *               El backend valida que prestadorOrigen.identifier[0].value === actor.ipsId.
 */
export function buildDemoEpisodePayload(ipsId: string): EpisodioPayload {
  const start = new Date(Date.now() - 90 * 60 * 1000).toISOString(); // 90 min atrás

  return {
    patient: {
      resourceType: "Patient",
      identifier: [
        {
          value: "12345678",                              // solo dígitos, 6-15 chars
          type: {
            coding: [{
              system: "https://catalogo.minsalud.gov.co/",
              code: "CC",
              display: "Cedula de Ciudadania"
            }]
          }
        }
      ],
      name: [{ family: "DemoBlockchain", given: ["TxPanel"] }],
      birthDate: "1990-03-20",
      gender: "male",
      extension: [
        {
          url: NATIONALITY_URL,
          valueCodeableConcept: { coding: [{ code: "CO", display: "Colombia" }] }
        },
        {
          url: GENDER_ID_URL,
          valueCodeableConcept: { coding: [{ code: "M", display: "Masculino" }] }
        },
        {
          url: ETHNICITY_URL,
          valueCodeableConcept: { coding: [{ code: "NINGUNO", display: "Ninguno" }] }
        },
        {
          url: ETHNIC_COM_URL,
          valueString: ""
        },
        {
          url: DISABILITY_URL,
          valueCodeableConcept: { coding: [{ code: "NA", display: "No aplica" }] }
        },
        {
          url: OCCUPATION_URL,
          valueCodeableConcept: { coding: [{ code: "4110", display: "Empleados de oficina" }] }
        }
      ],
      address: [
        {
          country: "CO",
          extension: [
            {
              url: MUNICIPALITY_URL,
              valueCodeableConcept: { coding: [{ code: "11001", display: "Bogota D.C." }] }
            },
            {
              url: ZONE_URL,
              valueCodeableConcept: { coding: [{ code: "U", display: "Urbano" }] }
            }
          ]
        }
      ]
    },

    cobertura: {
      resourceType: "Coverage",
      beneficiary: { reference: "Patient/1" },
      payor: [
        {
          identifier: { value: "EPS001" },
          display: "EPS SURA Demo"
        }
      ]
    },

    encounter: {
      resourceType: "Encounter",
      status: "in-progress",              // evita validaciones de egreso
      class: { coding: [{ code: "INTRAMURAL", display: "Intramural" }] },
      type: [{ coding: [{ code: "01", display: "Intramural" }] }],
      serviceType: { coding: [{ code: "02", display: "Urgencias" }] },
      subject: { reference: "Patient/1" },
      serviceProvider: { reference: "Organization/IPS-003" },
      period: { start },
      reasonCode: [{ coding: [{ code: "02", display: "Enfermedad general" }] }],
      priority: { coding: [{ code: "III", display: "Triage III" }] },
      extension: [
        {
          url: ROUTE_URL,
          valueCodeableConcept: { coding: [{ code: "01", display: "Demanda espontanea" }] }
        },
        {
          url: TRIAGE_TIME_URL,
          valueDateTime: start
        }
      ]
    },

    prestadorOrigen: {
      resourceType: "Organization",
      identifier: [{ value: ipsId }],   // debe coincidir con x-ips-id del actor
      name: `IPS ${ipsId} (TX Demo)`
    },

    diagnosticoIngreso: {
      resourceType: "Condition",
      code: {
        coding: [{
          system: "http://hl7.org/fhir/sid/icd-10",
          code: "J06.9",
          display: "Infeccion aguda de las vias respiratorias superiores"
        }]
      },
      category: [{ coding: [{ code: "principal", display: "Principal" }] }],
      subject: { reference: "Patient/1" }
    }
  };
}

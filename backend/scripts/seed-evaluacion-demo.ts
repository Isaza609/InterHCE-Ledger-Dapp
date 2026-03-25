/**
 * Población demo para evaluación: más IPS, profesionales/admins y episodios con pacientes sintéticos.
 * Simula pacientes atendidos en varias IPS y permisos entre instituciones.
 *
 * Uso (desde backend/, con API detenida recomendado):
 *   Para borrar datos JSON locales: RESET_DEMO_CONFIRM=YES npm run reset:demo-data
 *   Luego: npm run seed:eval-demo
 *
 *   Blockchain: este script fuerza BLOCKCHAIN_TRACE_MODE=mock salvo que ponga SEED_BLOCKCHAIN_REAL=1.
 *   Sin eso, si el .env tiene RPC/contrato real pero la clave no tiene rol ProfesionalSalud/AdminIps
 *   en InterHCELedger, las llamadas revertirían con "Rol no autorizado".
 *
 * Opciones por variables de entorno:
 *   SEED_NUM_PATIENTS=24     — episodios base (por defecto 18)
 *   SEED_SECOND_EPISODE=1  — 0 desactiva segundo episodio por paciente en otra IPS
 *   SEED_GRANT_PERMS=1     — 0 no otorga permisos cruzados
 *   Los documentos de paciente son estables por índice (1035000000 + p*13): al repetir el seed
 *   NO se crean cuentas paciente duplicadas para el mismo documento (crearUsuarioPacienteSiNoExiste).
 *   Sí se crean episodios y trazas NUEVOS cada vez (nuevos UUID); para empezar limpio, borra o archiva
 *   backend/data/episodio-*.json antes de volver a sembrar.
 *
 *   SEED_ALL_TRACE_EVENTS=1 — además de CREATED + GRANTED, registra en cadena/bloque:
 *       EPISODE_UPDATED, AUDITABLE_ACCESS (IPS con permiso), INTEGRITY_CHECK (auditor),
 *       PERMISSION_REVOKED (si hubo grant). Así se cubren los tipos de blockchain-funcionamiento.md.
 *       Pon 0 para omitir y dejar solo creación + permiso.
 *
 *   SEED_BLOCKCHAIN_REAL=1 — usar trazas reales (Sepolia); requiere que el owner del contrato haya
 *       llamado gestionarUsuario(backendAddress, ProfesionalSalud|AdminIps, ipsIdHash, true).
 */

import { config } from "dotenv";
import { randomUUID } from "crypto";
import path from "path";

config({ path: path.resolve(__dirname, "../.env") });

import type { ActorContexto } from "../src/hce/episodioLifecycleService";
import type { EpisodioFhirLikeInput } from "../src/hce/hceValidationSchema";
import { crearIps } from "../src/ips/ipsService";
import {
  crearUsuarioIps,
  crearUsuarioPacienteSiNoExiste,
  extraerDocumentoIdentidadDesdeDocumentoClinico,
  nombrePacienteDesdeDocumentoClinico
} from "../src/access/accesoUsuariosService";
import { validateEpisodioClinico } from "../src/hce/validationService";
import {
  generarDocumentoClinico,
  almacenarDocumentoClinico,
  generarRegistroOnChainMetadataDesdeDocumento,
  recuperarDocumentoClinico
} from "../src/hce/documentoClinicoService";
import {
  crearRegistroLifecycleEpisodio,
  prevalidarActualizacionLifecycleEpisodio,
  actualizarRegistroLifecycleEpisodio
} from "../src/hce/episodioLifecycleService";
import {
  registrarPropietarioEpisodio,
  otorgarPermisoEpisodio,
  revocarPermisoEpisodio,
  puedeAccederDocumento,
  obtenerPropietarioEpisodio
} from "../src/hce/permisosEpisodioService";
import {
  registrarEventoTrazabilidad,
  obtenerUltimoHashRegistradoOnChain
} from "../src/hce/trazabilidadService";
import { obtenerConfiguracionBlockchainReal } from "../src/infra/blockchainTraceService";
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

/** IPS adicionales (IPS-001 y IPS-002 ya vienen en seeds del backend). */
const NUEVAS_IPS: Array<{
  ipsId: string;
  nombre: string;
  repsCodigo: string;
  ciudad: string;
  departamento: string;
  direccion: string;
}> = [
  {
    ipsId: "IPS-003",
    nombre: "Clínica Central del Valle",
    repsCodigo: "380038001380",
    ciudad: "Cali",
    departamento: "Valle del Cauca",
    direccion: "Av. Roosevelt #26-45"
  },
  {
    ipsId: "IPS-004",
    nombre: "Hospital Caribe Norte",
    repsCodigo: "080018001080",
    ciudad: "Barranquilla",
    departamento: "Atlántico",
    direccion: "Cra. 54 #72-125"
  },
  {
    ipsId: "IPS-005",
    nombre: "Unidad de Urgencias Santander",
    repsCodigo: "680068001680",
    ciudad: "Bucaramanga",
    departamento: "Santander",
    direccion: "Cl. 35 #19-200"
  },
  {
    ipsId: "IPS-006",
    nombre: "Hospital Universitario del Café",
    repsCodigo: "660016001660",
    ciudad: "Pereira",
    departamento: "Risaralda",
    direccion: "Cra. 7 #23-45"
  }
];

const MUNICIPIOS: Array<{ code: string; display: string }> = [
  { code: "11001", display: "Bogota D.C." },
  { code: "05001", display: "Medellin" },
  { code: "76001", display: "Cali" },
  { code: "08001", display: "Barranquilla" },
  { code: "68001", display: "Bucaramanga" },
  { code: "63001", display: "Armenia" }
];

const CIE_ROTACION: Array<{ code: string; display: string }> = [
  { code: "J06.9", display: "Infeccion respiratoria aguda" },
  { code: "A09", display: "Diarrea y gastroenteritis de presunto origen infeccioso" },
  { code: "R51", display: "Cefalea" },
  { code: "R10.4", display: "Otro dolor abdominal y los no especificados" },
  { code: "K29.7", display: "Gastritis, no especificada" },
  { code: "J45", display: "Asma" },
  { code: "I10", display: "Hipertension esencial (primaria)" },
  { code: "E11", display: "Diabetes mellitus tipo 2" },
  { code: "A90", display: "Dengue sin signos de alarma" },
  { code: "J18.9", display: "Neumonia no especificada" }
];

const NOMBRES_FEMENINOS = [
  "Andrea", "Valentina", "Camila", "Isabella", "Mariana", "Luciana", "Paula", "Sofia",
  "Juliana", "Carolina", "Laura", "Daniela", "Alejandra", "Natalia", "Fernanda", "Monica"
];
const NOMBRES_MASCULINOS = [
  "Santiago", "Sebastian", "Mateo", "Nicolas", "Daniel", "Carlos", "Diego", "Andres",
  "Felipe", "Esteban", "Alejandro", "Miguel", "Ricardo", "Fernando", "Cristian", "David"
];

const APELLIDOS = [
  "Garcia", "Rodriguez", "Martinez", "Lopez", "Gonzalez", "Hernandez", "Perez", "Sanchez",
  "Ramirez", "Torres", "Florez", "Rivera", "Castro", "Morales", "Vargas", "Jimenez",
  "Ruiz", "Diaz", "Moreno", "Munoz"
];

/** Entidades promotoras de salud reales de Colombia */
const EPS_ROTACION: Array<{ code: string; display: string }> = [
  { code: "CCF018", display: "CAFAM EPS" },
  { code: "EPS001", display: "Sanitas EPS" },
  { code: "EPS002", display: "Nueva EPS" },
  { code: "EPS003", display: "Sura EPS" },
  { code: "EPS007", display: "Compensar EPS" },
  { code: "EPS010", display: "Coosalud EPS" },
  { code: "EPS012", display: "Mutual Ser EPS" }
];

/** Valores de signos vitales por diagnóstico — hace la HCE más realista */
const VITALES_POR_DIAG: Record<string, Array<{ code: string; display: string; value: string; unit: string }>> = {
  "I10": [
    { code: "8480-6", display: "Presion sistolica", value: "165", unit: "mmHg" },
    { code: "8462-4", display: "Presion diastolica", value: "100", unit: "mmHg" },
    { code: "8867-4", display: "Frecuencia cardiaca", value: "88", unit: "/min" }
  ],
  "J45": [
    { code: "59408-5", display: "Saturacion O2", value: "91", unit: "%" },
    { code: "9279-1", display: "Frecuencia respiratoria", value: "24", unit: "/min" }
  ],
  "default": [
    { code: "8310-5", display: "Temperatura corporal", value: "37.2", unit: "Cel" },
    { code: "8867-4", display: "Frecuencia cardiaca", value: "82", unit: "/min" },
    { code: "8480-6", display: "Presion sistolica", value: "118", unit: "mmHg" }
  ]
};

const IPS_TODAS = ["IPS-001", "IPS-002", ...NUEVAS_IPS.map((i) => i.ipsId)];

function envBool(name: string, defaultValue: boolean): boolean {
  const v = process.env[name]?.trim().toLowerCase();
  if (v === undefined || v === "") return defaultValue;
  return v === "1" || v === "true" || v === "yes";
}

function envInt(name: string, def: number): number {
  const n = parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : def;
}

/**
 * Número de documento estable por índice (misma corrida o otra con mismo SEED_NUM_PATIENTS).
 * Así `crearUsuarioPacienteSiNoExiste` no duplica usuarios paciente al reejecutar el seed.
 * Si necesitas variar documentos entre laboratorios, usa SEED_DOCUMENT_OFFSET=n (entero).
 */
function generarDocumentoDemo(idx: number): string {
  const offset = parseInt(process.env.SEED_DOCUMENT_OFFSET ?? "0", 10) || 0;
  const base = 1_035_000_000 + idx * 13 + offset;
  const s = String(Math.min(9_999_999_999, Math.max(1_000_000_000, base))).padStart(10, "0").slice(0, 10);
  return s;
}

function buildPayload(
  ipsOrigenId: string,
  doc: string,
  nombreGiven: string,
  nombreFamily: string,
  birthDate: string,
  encounterStartIso: string,
  diag: { code: string; display: string },
  municipio: { code: string; display: string },
  gender: "male" | "female" = "female",
  eps: { code: string; display: string } = EPS_ROTACION[0]
): EpisodioFhirLikeInput {
  const genderDisplay = gender === "male" ? "Masculino" : "Femenino";
  const genderCode = gender === "male" ? "M" : "F";

  const vitales = (VITALES_POR_DIAG[diag.code] ?? VITALES_POR_DIAG["default"]).map((v) => ({
    resourceType: "Observation" as const,
    status: "final" as const,
    code: { coding: [{ system: "http://loinc.org", code: v.code, display: v.display }] },
    subject: { reference: "Patient/1" },
    valueQuantity: { value: parseFloat(v.value), unit: v.unit, system: "http://unitsofmeasure.org" },
    effectiveDateTime: encounterStartIso
  }));

  const subj: EpisodioFhirLikeInput["patient"] = {
    resourceType: "Patient",
    identifier: [
      {
        value: doc,
        type: { coding: [{ system: "https://catalogo.minsalud.gov.co/", code: "CC", display: "Cedula de Ciudadania" }] }
      }
    ],
    name: [{ family: nombreFamily, given: [nombreGiven] }],
    birthDate,
    gender,
    extension: [
      {
        url: PATIENT_NATIONALITY_URL,
        valueCodeableConcept: { coding: [{ code: "CO", display: "Colombia" }] }
      },
      {
        url: PATIENT_GENDER_IDENTITY_URL,
        valueCodeableConcept: { coding: [{ code: genderCode, display: genderDisplay }] }
      },
      {
        url: PATIENT_ETHNICITY_URL,
        valueCodeableConcept: { coding: [{ code: "NINGUNO", display: "Ninguno" }] }
      },
      {
        url: PATIENT_ETHNIC_COMMUNITY_URL,
        valueString: ""
      },
      {
        url: PATIENT_DISABILITY_URL,
        valueCodeableConcept: { coding: [{ code: "NA", display: "No aplica" }] }
      },
      {
        url: PATIENT_OCCUPATION_URL,
        valueCodeableConcept: { coding: [{ code: "4110", display: "Empleados de oficina" }] }
      }
    ],
    address: [
      {
        country: "CO",
        extension: [
          {
            url: ADDRESS_MUNICIPALITY_URL,
            valueCodeableConcept: { coding: [{ code: municipio.code, display: municipio.display }] }
          },
          {
            url: ADDRESS_ZONE_URL,
            valueCodeableConcept: { coding: [{ code: "U", display: "Urbano" }] }
          }
        ]
      }
    ]
  };

  return {
    patient: subj,
    cobertura: {
      resourceType: "Coverage",
      beneficiary: { reference: "Patient/1" },
      payor: [
        {
          identifier: { value: eps.code },
          display: eps.display
        }
      ]
    },
    encounter: {
      resourceType: "Encounter",
      status: "in-progress",
      class: { coding: [{ code: "INTRAMURAL", display: "Intramural" }] },
      type: [{ coding: [{ code: "01", display: "Intramural" }] }],
      serviceType: { coding: [{ code: "02", display: "Urgencias" }] },
      subject: { reference: "Patient/1" },
      serviceProvider: { reference: "Organization/1" },
      period: { start: encounterStartIso },
      reasonCode: [{ coding: [{ code: "02", display: "Enfermedad general" }] }],
      priority: { coding: [{ code: "III", display: "Triage III" }] },
      hospitalization: {
        dischargeDisposition: { coding: [{ code: "01", display: "Alta" }] }
      },
      extension: [
        {
          url: ENCOUNTER_ROUTE_URL,
          valueCodeableConcept: { coding: [{ code: "01", display: "Demanda espontanea" }] }
        },
        {
          url: ENCOUNTER_TRIAGE_TIME_URL,
          valueDateTime: encounterStartIso
        }
      ]
    },
    prestadorOrigen: {
      resourceType: "Organization",
      identifier: [{ system: "https://prestadores.minsalud.gov.co/", value: ipsOrigenId }]
    },
    diagnosticoIngreso: {
      resourceType: "Condition",
      code: {
        coding: [{ system: "http://hl7.org/fhir/sid/icd-10", code: diag.code, display: diag.display }]
      },
      category: [{ coding: [{ code: "principal", display: "Principal" }] }],
      subject: { reference: "Patient/1" }
    },
    // Signos vitales como factores de riesgo/observaciones — enriquecen la HCE para evaluación
    antecedentes: {
      factoresRiesgo: vitales
    }
  };
}

async function registrarUnEpisodio(
  actor: ActorContexto,
  payload: EpisodioFhirLikeInput
): Promise<{ episodeId: string; lifecycleVersion: number }> {
  const validation = validateEpisodioClinico(payload);
  if (!validation.valid) {
    throw new Error(`Validación HCE: ${JSON.stringify(validation.issues, null, 2)}`);
  }
  const data = validation.data!;
  const episodeId = randomUUID();
  const documento = generarDocumentoClinico(data);
  await almacenarDocumentoClinico(episodeId, documento);
  const onChain = generarRegistroOnChainMetadataDesdeDocumento(episodeId, documento);
  const lifecycle = crearRegistroLifecycleEpisodio(episodeId, documento, actor, onChain);
  registrarPropietarioEpisodio(episodeId, actor.ipsId ?? "");
  await registrarEventoTrazabilidad({
    episodeId,
    eventType: "EPISODE_CREATED",
    actor,
    metadata: {
      version: lifecycle.versionActual,
      documentHash: onChain.documentHash,
      eventId: lifecycle.eventoUrgencias.eventoUrgenciasId,
      sourceIpsId: lifecycle.eventoUrgencias.ipsOrigenId
    }
  });
  const patientId = extraerDocumentoIdentidadDesdeDocumentoClinico(data);
  if (patientId) {
    crearUsuarioPacienteSiNoExiste({
      documentoIdentidad: patientId,
      nombre: nombrePacienteDesdeDocumentoClinico(data),
      ipsId: actor.ipsId ?? ""
    });
  }
  return { episodeId, lifecycleVersion: lifecycle.versionActual };
}

async function otorgarPermisoConTraz(
  actorAdmin: ActorContexto,
  episodeId: string,
  targetIps: string
): Promise<void> {
  const owner = actorAdmin.ipsId ?? "";
  const result = otorgarPermisoEpisodio(episodeId, owner, targetIps);
  if (!result.ok) {
    if (result.code === "PERMISSION_ALREADY_ACTIVE") return;
    throw new Error(`${result.code}: ${result.message}`);
  }
  await registrarEventoTrazabilidad({
    episodeId,
    eventType: "PERMISSION_GRANTED",
    actor: actorAdmin,
    metadata: {
      sourceIpsId: result.permission.sourceIpsId,
      targetIpsId: result.permission.targetIpsId,
      granted: true
    }
  });
}

/** Simula GET /episodes/:id/document — AUDITABLE_ACCESS on-chain (como en `episodes.ts`). */
async function simularAccesoDocumentoConTraz(
  episodeId: string,
  actor: ActorContexto
): Promise<void> {
  if (!puedeAccederDocumento(episodeId, actor.ipsId, actor.rol)) {
    throw new Error(`AUDITABLE_ACCESS: sin permiso para IPS ${actor.ipsId}`);
  }
  const almacenado = await recuperarDocumentoClinico(episodeId);
  if (!almacenado) {
    throw new Error("AUDITABLE_ACCESS: documento no encontrado");
  }
  await registrarEventoTrazabilidad({
    episodeId,
    eventType: "AUDITABLE_ACCESS",
    actor,
    metadata: {
      sourceIpsId: obtenerPropietarioEpisodio(episodeId),
      targetIpsId: actor.ipsId,
      accessType: "DOCUMENT_READ"
    }
  });
}

/** Simula PUT /episodes/:id — EPISODE_UPDATED (cambio leve de triage, sin romper evento de urgencias). */
async function simularActualizacionEpisodioConTraz(
  episodeId: string,
  actor: ActorContexto
): Promise<void> {
  const almacenado = await recuperarDocumentoClinico(episodeId);
  if (!almacenado) {
    throw new Error("EPISODE_UPDATED: sin documento");
  }
  const raw = JSON.parse(JSON.stringify(almacenado.document)) as EpisodioFhirLikeInput;
  raw.encounter.priority = { coding: [{ code: "IV", display: "Triage IV" }] };

  const validation = validateEpisodioClinico(raw);
  if (!validation.valid) {
    throw new Error(`EPISODE_UPDATED validación: ${JSON.stringify(validation.issues)}`);
  }
  const data = validation.data!;
  const documento = generarDocumentoClinico(data);
  const precheck = prevalidarActualizacionLifecycleEpisodio(episodeId, documento, actor);
  if (!precheck.ok) {
    throw new Error(`EPISODE_UPDATED precheck: ${precheck.error}`);
  }
  const previewOnChain = generarRegistroOnChainMetadataDesdeDocumento(episodeId, documento);

  // Persistir el documento actualizado. Si FHIR falla, abortamos el evento de trazabilidad
  // para evitar que trazabilidad quede con el nuevo hash y FHIR con el documento antiguo.
  // Sin este chequeo, al reiniciar el backend FHIR serviría el documento viejo (hash distinto)
  // y la verificación de integridad mostraría "revision_requerida" incorrectamente.
  const { fhirPersistWarning } = await almacenarDocumentoClinico(episodeId, documento);
  if (fhirPersistWarning) {
    console.warn(`[seed] EPISODE_UPDATED omitido para ${episodeId} — FHIR no persistió (integridad se mantiene consistente): ${fhirPersistWarning}`);
    return;
  }

  const lifecycleUpdated = actualizarRegistroLifecycleEpisodio(
    episodeId,
    documento,
    actor,
    previewOnChain
  );
  if (lifecycleUpdated.error || !lifecycleUpdated.record) {
    throw new Error(lifecycleUpdated.error ?? "EPISODE_UPDATED sin registro");
  }
  const lifecycle = lifecycleUpdated.record;
  await registrarEventoTrazabilidad({
    episodeId,
    eventType: "EPISODE_UPDATED",
    actor,
    metadata: {
      version: lifecycle.versionActual,
      documentHash: previewOnChain.documentHash,
      eventId: lifecycle.eventoUrgencias.eventoUrgenciasId,
      sourceIpsId: lifecycle.eventoUrgencias.ipsOrigenId
    }
  });
}

/** Simula GET /episodes/:id/integrity — INTEGRITY_CHECK. */
async function simularVerificacionIntegridadConTraz(
  episodeId: string,
  actor: ActorContexto
): Promise<void> {
  const almacenado = await recuperarDocumentoClinico(episodeId);
  if (!almacenado) {
    throw new Error("INTEGRITY_CHECK: documento no encontrado");
  }
  const onChain = obtenerUltimoHashRegistradoOnChain(episodeId);
  if (!onChain.documentHash || !onChain.traceEvent) {
    throw new Error("INTEGRITY_CHECK: no hay hash en traza CREATED/UPDATED");
  }
  const isValid = onChain.documentHash === almacenado.hash;
  await registrarEventoTrazabilidad({
    episodeId,
    eventType: "INTEGRITY_CHECK",
    actor,
    metadata: {
      integrityMatch: isValid,
      sourceIpsId: obtenerPropietarioEpisodio(episodeId),
      targetIpsId: actor.ipsId
    }
  });
}

async function revocarPermisoConTraz(
  actorAdmin: ActorContexto,
  episodeId: string,
  targetIps: string
): Promise<void> {
  const owner = actorAdmin.ipsId ?? "";
  const result = revocarPermisoEpisodio(episodeId, owner, targetIps);
  if (!result.ok) {
    if (result.code === "PERMISSION_NOT_ACTIVE") return;
    throw new Error(`${result.code}: ${result.message}`);
  }
  await registrarEventoTrazabilidad({
    episodeId,
    eventType: "PERMISSION_REVOKED",
    actor: actorAdmin,
    metadata: {
      sourceIpsId: result.permission.sourceIpsId,
      targetIpsId: result.permission.targetIpsId,
      granted: false
    }
  });
}

const ACTOR_AUDITOR: ActorContexto = {
  rol: "auditor",
  ipsId: "AUDITORIA",
  usuarioId: "auditor-001"
};

/**
 * Cubre los 6 tipos de evento que documenta blockchain-funcionamiento.md
 * (CREATED y GRANTED ya ocurrieron antes de llamar a esto).
 */
async function ejecutarTrazasInteroperabilidadCompletas(input: {
  episodeId: string;
  ownerIps: string;
  /** IPS a la que se otorgó permiso; si null, se omiten AUDITABLE_ACCESS y REVOKED. */
  ipsConPermiso: string | null;
  actorProfPropietario: ActorContexto;
  actorAdminPropietario: ActorContexto;
}): Promise<void> {
  const { episodeId, ipsConPermiso, actorProfPropietario, actorAdminPropietario } = input;

  if (ipsConPermiso) {
    const actorLecturaOtraIps: ActorContexto = {
      rol: "profesional_salud",
      ipsId: ipsConPermiso,
      usuarioId: `seed-prof-${ipsConPermiso}`
    };
    await simularAccesoDocumentoConTraz(episodeId, actorLecturaOtraIps);
  }

  await simularActualizacionEpisodioConTraz(episodeId, actorProfPropietario);
  await simularVerificacionIntegridadConTraz(episodeId, ACTOR_AUDITOR);

  if (ipsConPermiso) {
    await revocarPermisoConTraz(actorAdminPropietario, episodeId, ipsConPermiso);
  }
}

async function main(): Promise<void> {
  /**
   * InterHCELedger.registrarEpisodio usa onlyClinicalActor: msg.sender debe tener rol
   * ProfesionalSalud o AdminIps en el contrato. La cuenta de DEPLOYER_PRIVATE_KEY suele no coincidir
   * con el deployer ni estar registrada → revert "Rol no autorizado".
   * El seed genera muchas trazas; por defecto usamos mock. Cadena real solo con SEED_BLOCKCHAIN_REAL=1
   * y rol asignado (gestionarUsuario desde la cuenta owner del despliegue).
   */
  const usarCadenaReal = process.env.SEED_BLOCKCHAIN_REAL?.trim() === "1";
  if (!usarCadenaReal) {
    process.env.BLOCKCHAIN_TRACE_MODE = "mock";
    console.log(
      "Seed: trazas en modo mock (sin txs Sepolia). Para txs reales: SEED_BLOCKCHAIN_REAL=1 y registrar la cuenta del backend en el contrato (rol clínico)."
    );
  }

  const bc = obtenerConfiguracionBlockchainReal();
  if (!bc.enabled) {
    console.error(
      "Blockchain no habilitada para trazas. Configure RPC + firma + contrato, o ejecute con BLOCKCHAIN_TRACE_MODE=mock"
    );
    process.exit(1);
  }

  console.log("Seed evaluación — blockchain:", bc.enabled ? "ok (mock o real)" : "no");

  for (const row of NUEVAS_IPS) {
    const r = crearIps({
      ipsId: row.ipsId,
      nombre: row.nombre,
      repsCodigo: row.repsCodigo,
      direccion: row.direccion,
      ciudad: row.ciudad,
      departamento: row.departamento,
      telefono: "6010000000",
      correoContacto: `contacto@${row.ipsId.toLowerCase()}.demo.local`
    });
    if (r.ok) {
      console.log("IPS creada:", row.ipsId, row.nombre);
    } else {
      console.log("IPS omitida (ya existe o error):", row.ipsId, row.nombre);
    }
  }

  for (const ipsId of IPS_TODAS) {
    const admId = `seed-admin-${ipsId}`;
    const profId = `seed-prof-${ipsId}`;
    if (!crearUsuarioIps({
      usuarioId: admId,
      nombre: `Admin demo ${ipsId}`,
      correo: `${admId}@demo.local`,
      password: "SeedDemo2025!",
      rol: "admin_ips",
      ipsId
    }).ok) {
      /* ya existe */
    }
    if (!crearUsuarioIps({
      usuarioId: profId,
      nombre: `Prof. demo ${ipsId}`,
      correo: `${profId}@demo.local`,
      password: "SeedDemo2025!",
      rol: "profesional_salud",
      ipsId
    }).ok) {
      /* ya existe */
    }
  }

  const numPatients = envInt("SEED_NUM_PATIENTS", 18);
  const secondEpisode = envBool("SEED_SECOND_EPISODE", true);
  const grantPerms = envBool("SEED_GRANT_PERMS", true);
  const allTraceEvents = envBool("SEED_ALL_TRACE_EVENTS", true);

  let creados = 0;
  for (let p = 0; p < numPatients; p++) {
    const doc = generarDocumentoDemo(p);
    const esMasculino = p % 2 === 0;
    const nombresPool = esMasculino ? NOMBRES_MASCULINOS : NOMBRES_FEMENINOS;
    const given = nombresPool[p % nombresPool.length];
    const family = `${APELLIDOS[(p * 3) % APELLIDOS.length]} ${APELLIDOS[(p + 5) % APELLIDOS.length]}`;
    const birthYear = 1972 + (p % 35);
    const birthDate = `${birthYear}-${String((p % 12) + 1).padStart(2, "0")}-${String((p % 27) + 1).padStart(2, "0")}`;
    const diag = CIE_ROTACION[p % CIE_ROTACION.length];
    const mun = MUNICIPIOS[p % MUNICIPIOS.length];
    const gender: "male" | "female" = esMasculino ? "male" : "female";
    const eps = EPS_ROTACION[p % EPS_ROTACION.length];

    const horasAtras = (p + 1) * 5;
    const start1 = new Date(Date.now() - horasAtras * 3600 * 1000).toISOString();

    const ips1 = IPS_TODAS[p % IPS_TODAS.length];
    const actor1: ActorContexto = {
      rol: "profesional_salud",
      ipsId: ips1,
      usuarioId: `seed-prof-${ips1}`
    };

    const pl1 = buildPayload(ips1, doc, given, family, birthDate, start1, diag, mun, gender, eps);
    const e1 = await registrarUnEpisodio(actor1, pl1);
    creados++;
    console.log(`Episodio ${creados}: ${e1.episodeId.slice(0, 8)}… paciente ${doc} en ${ips1}`);

    const otra = IPS_TODAS[(p + 2) % IPS_TODAS.length];
    const adminActor: ActorContexto = {
      rol: "admin_ips",
      ipsId: ips1,
      usuarioId: `seed-admin-${ips1}`
    };
    let ipsConPermiso: string | null = null;
    if (grantPerms && otra !== ips1) {
      try {
        await otorgarPermisoConTraz(adminActor, e1.episodeId, otra);
        ipsConPermiso = otra;
        console.log(`  permiso: ${ips1} → ${otra}`);
      } catch (e) {
        console.warn(`  permiso omitido:`, e instanceof Error ? e.message : e);
      }
    }

    if (allTraceEvents) {
      try {
        await ejecutarTrazasInteroperabilidadCompletas({
          episodeId: e1.episodeId,
          ownerIps: ips1,
          ipsConPermiso,
          actorProfPropietario: actor1,
          actorAdminPropietario: adminActor
        });
        console.log(
          ipsConPermiso
            ? "  trazas: UPDATED + ACCESS(IPS remota) + INTEGRITY + REVOKED"
            : "  trazas: UPDATED + INTEGRITY (sin grant, sin ACCESS/REVOKED)"
        );
      } catch (e) {
        console.warn(`  trazas extendidas omitidas:`, e instanceof Error ? e.message : e);
      }
    }

    if (secondEpisode && p % 2 === 0) {
      const ips2 = IPS_TODAS[(p + 1) % IPS_TODAS.length];
      const start2 = new Date(Date.now() - (horasAtras - 2) * 3600 * 1000).toISOString();
      const actor2: ActorContexto = {
        rol: "profesional_salud",
        ipsId: ips2,
        usuarioId: `seed-prof-${ips2}`
      };
      const pl2 = buildPayload(
        ips2,
        doc,
        given,
        family,
        birthDate,
        start2,
        CIE_ROTACION[(p + 3) % CIE_ROTACION.length],
        MUNICIPIOS[(p + 1) % MUNICIPIOS.length],
        gender,
        EPS_ROTACION[(p + 2) % EPS_ROTACION.length]
      );
      const e2 = await registrarUnEpisodio(actor2, pl2);
      creados++;
      console.log(`  segundo episodio: ${e2.episodeId.slice(0, 8)}… en ${ips2} (mismo paciente)`);
    }
  }

  console.log("\nListo. episodios creados en esta corrida:", creados);
  console.log("Usuarios demo (login): seed-prof-IPS-00x / SeedDemo2025!  ó  seed-admin-IPS-00x / SeedDemo2025!");
  console.log("Pacientes: usuario paciente-<documento> con contraseña Paciente-<documento>!");
  console.log(
    "\nNota: IPS y usuarios del seed viven en memoria. Si reinicias el backend, vuelve a ejecutar este script\n" +
      "para recrear IPS-003…006 y cuentas seed (los episodios en data/*.json y FHIR ya persistidos se acumulan)."
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

const test = require("node:test");
const assert = require("node:assert/strict");

process.env.FHIR_BASE_URL = "";
process.env.BLOCKCHAIN_TRACE_MODE = "mock";

const {
  almacenarDocumentoClinico,
  generarRegistroOnChainMetadataDesdeDocumento
} = require("../dist/hce/documentoClinicoService");
const {
  actualizarRegistroLifecycleEpisodio,
  crearRegistroLifecycleEpisodio
} = require("../dist/hce/episodioLifecycleService");
const {
  otorgarPermisoEpisodio,
  registrarPropietarioEpisodio
} = require("../dist/hce/permisosEpisodioService");
const { registrarEventoTrazabilidad } = require("../dist/hce/trazabilidadService");
const { generarDashboardEvaluacionPrototipo } = require("../dist/evaluation/prototipoEvaluationService");
const { configurarIpsSimuladas } = require("../dist/infra/infraestructuraService");

function buildPayload({
  patientIdentifier = "99001122",
  ips = "IPS-001",
  status = "in-progress",
  cie10 = "A099",
  start = "2026-03-23T08:00:00",
  end
} = {}) {
  return {
    patient: {
      resourceType: "Patient",
      identifier: [{ value: patientIdentifier }],
      name: [{ family: "Sprint", given: ["Seis"] }],
      birthDate: "1990-04-20",
      gender: "female"
    },
    cobertura: {
      resourceType: "Coverage",
      beneficiary: { reference: "Patient/1" },
      payor: [{ identifier: { value: "EPS-001" }, display: "Asegurador" }]
    },
    encounter: {
      resourceType: "Encounter",
      status,
      class: { coding: [{ code: "EMER", display: "Urgencias" }] },
      subject: { reference: "Patient/1" },
      serviceProvider: { reference: "Organization/1" },
      period: end ? { start, end } : { start }
    },
    prestadorOrigen: {
      resourceType: "Organization",
      identifier: [{ system: "https://prestadores.minsalud.gov.co/", value: ips }]
    },
    prestadorDestino: {
      resourceType: "Organization",
      identifier: [{ system: "https://prestadores.minsalud.gov.co/", value: "IPS-002" }]
    },
    diagnosticoIngreso: {
      resourceType: "Condition",
      code: { coding: [{ system: "http://hl7.org/fhir/sid/icd-10", code: cie10 }] },
      subject: { reference: "Patient/1" }
    }
  };
}

test("Sprint 6: el dashboard consolida interoperabilidad, tiempos y costo blockchain", async () => {
  configurarIpsSimuladas([
    { ipsId: "IPS-001", nombre: "Hospital Central", repsCodigo: "110010001" },
    { ipsId: "IPS-002", nombre: "Clinica Norte", repsCodigo: "110010002" }
  ]);

  const episodeId = `ep-s6-${Date.now()}`;
  const actorOrigen = { rol: "profesional_salud", ipsId: "IPS-001", usuarioId: "profesional-001" };
  const actorAdmin = { rol: "admin_ips", ipsId: "IPS-001", usuarioId: "admin-ips-001" };
  const actorReceptor = { rol: "profesional_salud", ipsId: "IPS-002", usuarioId: "profesional-002" };

  const payloadInicial = buildPayload();
  const onChainInicial = generarRegistroOnChainMetadataDesdeDocumento(episodeId, payloadInicial);
  await almacenarDocumentoClinico(episodeId, payloadInicial);
  const lifecycle = crearRegistroLifecycleEpisodio(episodeId, payloadInicial, actorOrigen, onChainInicial);
  registrarPropietarioEpisodio(episodeId, "IPS-001");

  await registrarEventoTrazabilidad({
    episodeId,
    eventType: "EPISODE_CREATED",
    actor: actorOrigen,
    metadata: {
      version: lifecycle.versionActual,
      documentHash: onChainInicial.documentHash,
      eventId: lifecycle.eventoUrgencias.eventoUrgenciasId,
      sourceIpsId: "IPS-001"
    }
  });

  const grant = otorgarPermisoEpisodio(episodeId, "IPS-001", "IPS-002");
  assert.equal(grant.ok, true);
  if (!grant.ok) return;

  await registrarEventoTrazabilidad({
    episodeId,
    eventType: "PERMISSION_GRANTED",
    actor: actorAdmin,
    metadata: {
      sourceIpsId: "IPS-001",
      targetIpsId: "IPS-002",
      granted: true
    }
  });

  const payloadContinuidad = buildPayload({
    status: "finished",
    cie10: "A090",
    end: "2026-03-23T09:00:00"
  });
  const onChainContinuidad = generarRegistroOnChainMetadataDesdeDocumento(episodeId, payloadContinuidad);
  await almacenarDocumentoClinico(episodeId, payloadContinuidad);
  const updated = actualizarRegistroLifecycleEpisodio(episodeId, payloadContinuidad, actorReceptor, onChainContinuidad);
  assert.equal(updated.error, undefined);

  await registrarEventoTrazabilidad({
    episodeId,
    eventType: "EPISODE_UPDATED",
    actor: actorReceptor,
    metadata: {
      version: updated.record.versionActual,
      documentHash: onChainContinuidad.documentHash,
      eventId: updated.record.eventoUrgencias.eventoUrgenciasId,
      sourceIpsId: "IPS-001",
      targetIpsId: "IPS-002"
    }
  });

  await registrarEventoTrazabilidad({
    episodeId,
    eventType: "INTEGRITY_CHECK",
    actor: actorReceptor,
    metadata: {
      sourceIpsId: "IPS-001",
      targetIpsId: "IPS-002",
      integrityMatch: true
    }
  });

  const dashboard = await generarDashboardEvaluacionPrototipo({ runs: 2 });
  const scenario = dashboard.interoperability.scenarios.find((item) => item.episodeId === episodeId);

  assert.ok(scenario);
  assert.equal(scenario.hasCrossIpsContinuity, true);
  assert.equal(scenario.integrityStatus, "integro");
  assert.ok(dashboard.timings.operations.metadataOnChain.samples >= 2);
  assert.equal(dashboard.blockchainPerformance.metricKind, "estimado");
  assert.ok(dashboard.blockchainPerformance.operations.some((item) => item.eventType === "EPISODE_CREATED"));
});

test("Sprint 6: el dashboard documenta auditoría, cumplimiento y conclusiones", async () => {
  const dashboard = await generarDashboardEvaluacionPrototipo({ runs: 1 });

  assert.ok(Array.isArray(dashboard.documentation.resumenEjecutivo));
  assert.ok(dashboard.documentation.conclusiones.length >= 1);
  assert.ok(dashboard.documentation.aportes.length >= 1);
  assert.ok(dashboard.documentation.trabajoFuturo.length >= 1);
  assert.ok(dashboard.compliance.requirements.some((item) => item.requirementId === "RF10"));
  assert.equal(typeof dashboard.audit.endToEndTraceability, "boolean");
});

const test = require("node:test");
const assert = require("node:assert/strict");

process.env.FHIR_BASE_URL = "";
process.env.BLOCKCHAIN_TRACE_MODE = "mock";

const {
  almacenarDocumentoClinico,
  buscarEpisodiosPorIdentificadorPaciente,
  generarRegistroOnChainMetadataDesdeDocumento,
  recuperarDocumentoClinico
} = require("../dist/hce/documentoClinicoService");
const {
  crearRegistroLifecycleEpisodio,
  actualizarRegistroLifecycleEpisodio
} = require("../dist/hce/episodioLifecycleService");
const {
  listarEventosTrazabilidad,
  obtenerUltimoHashRegistradoOnChain,
  registrarEventoTrazabilidad
} = require("../dist/hce/trazabilidadService");
const {
  listarEpisodiosAccesiblesPorIps,
  puedeAccederDocumento,
  registrarPropietarioEpisodio,
  otorgarPermisoEpisodio
} = require("../dist/hce/permisosEpisodioService");

function buildPayload({
  patientIdentifier = "99887766",
  start = "2026-03-23T08:00:00",
  end,
  ips = "IPS-001",
  status = "in-progress",
  cie10 = "A099"
} = {}) {
  return {
    patient: {
      resourceType: "Patient",
      identifier: [{ value: patientIdentifier }],
      name: [{ family: "Torres", given: ["Elena"] }],
      birthDate: "1989-10-15",
      gender: "female"
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

test("HU2-E1 + HU2-E2 + HU4-E2: búsqueda por paciente, acceso autorizado y continuidad entre IPS mantienen el mismo episodio", async () => {
  const episodeId = `ep-s5-${Date.now()}`;
  const actorOrigen = { rol: "profesional_salud", ipsId: "IPS-001", usuarioId: "profesional-001" };
  const actorReceptor = { rol: "profesional_salud", ipsId: "IPS-002", usuarioId: "profesional-002" };
  const payloadInicial = buildPayload();
  const onChainInicial = generarRegistroOnChainMetadataDesdeDocumento(episodeId, payloadInicial);

  await almacenarDocumentoClinico(episodeId, payloadInicial);
  const lifecycleInicial = crearRegistroLifecycleEpisodio(episodeId, payloadInicial, actorOrigen, onChainInicial);
  registrarPropietarioEpisodio(episodeId, actorOrigen.ipsId);

  const encontrados = await buscarEpisodiosPorIdentificadorPaciente("99887766");
  assert.equal(encontrados.some((item) => item.episodeId === episodeId), true);
  assert.equal(listarEpisodiosAccesiblesPorIps(actorReceptor.ipsId, actorReceptor.rol).includes(episodeId), false);

  const grant = otorgarPermisoEpisodio(episodeId, actorOrigen.ipsId, actorReceptor.ipsId);
  assert.equal(grant.ok, true);
  if (!grant.ok) return;

  assert.equal(puedeAccederDocumento(episodeId, actorReceptor.ipsId, actorReceptor.rol), true);
  assert.equal(listarEpisodiosAccesiblesPorIps(actorReceptor.ipsId, actorReceptor.rol).includes(episodeId), true);

  const payloadContinuidad = buildPayload({
    end: "2026-03-23T09:15:00",
    status: "finished",
    cie10: "A090"
  });
  const onChainContinuidad = generarRegistroOnChainMetadataDesdeDocumento(episodeId, payloadContinuidad);
  await almacenarDocumentoClinico(episodeId, payloadContinuidad);
  const updated = actualizarRegistroLifecycleEpisodio(
    episodeId,
    payloadContinuidad,
    actorReceptor,
    onChainContinuidad
  );

  assert.equal(updated.error, undefined);
  assert.equal(updated.record.episodeId, episodeId);
  assert.equal(updated.record.versionActual, 2);
  assert.equal(updated.record.eventoUrgencias.eventoUrgenciasId, lifecycleInicial.eventoUrgencias.eventoUrgenciasId);
  assert.equal(updated.record.versiones[1].actor.ipsId, "IPS-002");
});

test("HU3-E2 + HU3-E4 + HU4-E3 + HU5-E4: integridad y trazabilidad quedan auditables y filtrables por episodio, tipo e IPS", async () => {
  const episodeId = `ep-s5-trace-${Date.now()}`;
  const actorOrigen = { rol: "admin_ips", ipsId: "IPS-001", usuarioId: "admin-ips-001" };
  const actorReceptor = { rol: "profesional_salud", ipsId: "IPS-002", usuarioId: "profesional-002" };
  const payload = buildPayload({ patientIdentifier: "44556677" });
  const onChain = generarRegistroOnChainMetadataDesdeDocumento(episodeId, payload);

  await almacenarDocumentoClinico(episodeId, payload);
  const lifecycle = crearRegistroLifecycleEpisodio(episodeId, payload, actorOrigen, onChain);
  registrarPropietarioEpisodio(episodeId, "IPS-001");

  const createdTrace = await registrarEventoTrazabilidad({
    episodeId,
    eventType: "EPISODE_CREATED",
    actor: actorOrigen,
    metadata: {
      version: lifecycle.versionActual,
      documentHash: onChain.documentHash,
      eventId: lifecycle.eventoUrgencias.eventoUrgenciasId,
      sourceIpsId: "IPS-001"
    }
  });

  const grant = otorgarPermisoEpisodio(episodeId, "IPS-001", "IPS-002");
  assert.equal(grant.ok, true);
  if (!grant.ok) return;

  const grantTrace = await registrarEventoTrazabilidad({
    episodeId,
    eventType: "PERMISSION_GRANTED",
    actor: actorOrigen,
    metadata: {
      sourceIpsId: "IPS-001",
      targetIpsId: "IPS-002",
      granted: true
    }
  });

  const stored = await recuperarDocumentoClinico(episodeId);
  const latestHash = obtenerUltimoHashRegistradoOnChain(episodeId);
  assert.equal(latestHash.documentHash, stored.hash);

  const accessTrace = await registrarEventoTrazabilidad({
    episodeId,
    eventType: "AUDITABLE_ACCESS",
    actor: actorReceptor,
    metadata: {
      sourceIpsId: "IPS-001",
      targetIpsId: "IPS-002",
      accessType: "DOCUMENT_READ"
    }
  });

  const integrityTrace = await registrarEventoTrazabilidad({
    episodeId,
    eventType: "INTEGRITY_CHECK",
    actor: actorReceptor,
    metadata: {
      sourceIpsId: "IPS-001",
      targetIpsId: "IPS-002",
      integrityMatch: latestHash.documentHash === stored.hash
    }
  });

  const all = listarEventosTrazabilidad({ episodeId });
  const onlyAccess = listarEventosTrazabilidad({ episodeId, eventType: "AUDITABLE_ACCESS" });
  const byIps = listarEventosTrazabilidad({ ipsId: "IPS-002" });

  assert.equal(all.length, 4);
  assert.equal(onlyAccess.length, 1);
  assert.equal(onlyAccess[0].traceId, accessTrace.traceId);
  assert.equal(byIps.some((item) => item.traceId === grantTrace.traceId), true);
  assert.equal(byIps.some((item) => item.traceId === accessTrace.traceId), true);
  assert.equal(byIps.some((item) => item.traceId === integrityTrace.traceId), true);
  assert.ok(createdTrace.evidence.transactionHash.startsWith("0x"));
  assert.ok(integrityTrace.evidence.transactionHash.startsWith("0x"));
});

const test = require("node:test");
const assert = require("node:assert/strict");

process.env.FHIR_BASE_URL = "";

const {
  almacenarDocumentoClinico,
  obtenerRegistroOnChainMetadata
} = require("../dist/hce/documentoClinicoService");
const {
  crearRegistroLifecycleEpisodio,
  actualizarRegistroLifecycleEpisodio,
  obtenerRegistroLifecycleEpisodio
} = require("../dist/hce/episodioLifecycleService");
const {
  obtenerActorDesdeRequest,
  validarAccesoOperacionClinica
} = require("../dist/security/autorizacionService");
const {
  configurarIpsSimuladas,
  obtenerEstadoInfraestructura,
  activarContratosSimulados
} = require("../dist/infra/infraestructuraService");

function payloadBase({
  start = "2026-03-17T08:00:00",
  end,
  ips = "IPS-001",
  status = "in-progress"
} = {}) {
  return {
    patient: {
      resourceType: "Patient",
      identifier: [{ value: "hash-cc-123" }],
      name: [{ family: "Lopez", given: ["Maria"] }],
      birthDate: "1990-04-20",
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
    diagnosticoIngreso: {
      resourceType: "Condition",
      code: { coding: [{ system: "http://hl7.org/fhir/sid/icd-10", code: "A099" }] },
      subject: { reference: "Patient/1" }
    }
  };
}

function fakeReq(headers) {
  return {
    header(name) {
      return headers[name.toLowerCase()];
    }
  };
}

test("HU0-E1: validación de rol/IPS permite creación solo a actor autorizado", () => {
  const actorInvalido = obtenerActorDesdeRequest(
    fakeReq({ "x-user-role": "paciente", "x-ips-id": "IPS-001" })
  );
  const accesoInvalido = validarAccesoOperacionClinica(actorInvalido);
  assert.equal(accesoInvalido.ok, false);

  const actorValido = obtenerActorDesdeRequest(
    fakeReq({
      "x-user-role": "profesional_salud",
      "x-ips-id": "IPS-001",
      "x-user-id": "prof-1"
    })
  );
  const accesoValido = validarAccesoOperacionClinica(actorValido);
  assert.deepEqual(accesoValido, { ok: true });
});

test("HU0-E1 + HU4-E1: creación registra episodio, asociación a evento y metadatos on-chain", async () => {
  const payload = payloadBase({ start: "2026-03-17T08:15:00", ips: "IPS-010" });
  const episodeId = `ep-${Date.now()}-hu0e1`;
  const actor = { rol: "profesional_salud", ipsId: "IPS-010", usuarioId: "prof-10" };

  await almacenarDocumentoClinico(episodeId, payload);
  const onChain = await obtenerRegistroOnChainMetadata(episodeId);
  assert.ok(onChain);
  const lifecycle = crearRegistroLifecycleEpisodio(episodeId, payload, actor, onChain);

  assert.equal(lifecycle.episodeId, episodeId);
  assert.equal(lifecycle.versionActual, 1);
  assert.equal(lifecycle.eventoUrgencias.ipsOrigenId, "IPS-010");
  assert.equal(lifecycle.eventoUrgencias.fechaHoraInicio, "2026-03-17T08:15:00");
  assert.equal(lifecycle.versiones.length, 1);
  assert.equal(lifecycle.versiones[0].documentHash, onChain.documentHash);
});

test("HU1-E1: actualización crea nueva versión y conserva historial previo", async () => {
  const episodeId = `ep-${Date.now()}-hu1e1`;
  const actor = { rol: "profesional_salud", ipsId: "IPS-020", usuarioId: "prof-20" };
  const p1 = payloadBase({ start: "2026-03-17T09:00:00", ips: "IPS-020" });
  await almacenarDocumentoClinico(episodeId, p1);
  const m1 = await obtenerRegistroOnChainMetadata(episodeId);
  crearRegistroLifecycleEpisodio(episodeId, p1, actor, m1);

  const p2 = payloadBase({
    start: "2026-03-17T09:00:00",
    end: "2026-03-17T10:10:00",
    ips: "IPS-020",
    status: "finished"
  });
  await almacenarDocumentoClinico(episodeId, p2);
  const m2 = await obtenerRegistroOnChainMetadata(episodeId);
  const updated = actualizarRegistroLifecycleEpisodio(episodeId, p2, actor, m2);

  assert.equal(updated.error, undefined);
  assert.equal(updated.record.versionActual, 2);
  assert.equal(updated.record.versiones.length, 2);
  assert.notEqual(updated.record.versiones[0].documentHash, updated.record.versiones[1].documentHash);
});

test("HU4-E1: la asociación episodio-evento es inmutable durante el ciclo de vida", async () => {
  const episodeId = `ep-${Date.now()}-hu4e1`;
  const actor = { rol: "profesional_salud", ipsId: "IPS-030", usuarioId: "prof-30" };
  const p1 = payloadBase({ start: "2026-03-17T11:00:00", ips: "IPS-030" });
  await almacenarDocumentoClinico(episodeId, p1);
  const m1 = await obtenerRegistroOnChainMetadata(episodeId);
  crearRegistroLifecycleEpisodio(episodeId, p1, actor, m1);

  const pConflict = payloadBase({
    start: "2026-03-17T11:30:00",
    end: "2026-03-17T12:00:00",
    ips: "IPS-030"
  });
  await almacenarDocumentoClinico(episodeId, pConflict);
  const m2 = await obtenerRegistroOnChainMetadata(episodeId);
  const updated = actualizarRegistroLifecycleEpisodio(episodeId, pConflict, actor, m2);
  assert.equal(updated.errorCode, "EVENT_ASSOCIATION_CONFLICT");

  const record = obtenerRegistroLifecycleEpisodio(episodeId);
  assert.equal(record.versionActual, 1);
});

test("HU1-E5: simulación de infraestructura permite múltiples IPS y estado operativo", () => {
  const invalid = configurarIpsSimuladas([
    { ipsId: "IPS-A", nombre: "IPS A", repsCodigo: "11001" },
    { ipsId: "IPS-A", nombre: "IPS A duplicada", repsCodigo: "11002" }
  ]);
  assert.equal(invalid.ok, false);

  const configured = configurarIpsSimuladas([
    { ipsId: "IPS-A", nombre: "IPS Alfa", repsCodigo: "11001" },
    { ipsId: "IPS-B", nombre: "IPS Beta", repsCodigo: "11002" }
  ]);
  assert.equal(configured.ok, true);
  activarContratosSimulados();
  const estado = obtenerEstadoInfraestructura();
  assert.equal(estado.simulacionIps.total, 2);
  assert.equal(estado.simulacionIps.multipleIpsActivo, true);
  assert.equal(estado.blockchain.contratosOperativos, true);
  assert.equal(estado.cumpleHu1E5, true);
});

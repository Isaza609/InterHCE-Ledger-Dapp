const test = require("node:test");
const assert = require("node:assert/strict");

process.env.FHIR_BASE_URL = "";
process.env.BLOCKCHAIN_TRACE_MODE = "disabled";

const {
  almacenarDocumentoClinico,
  calcularHashDocumento,
  generarRegistroOnChainMetadataDesdeDocumento,
  recuperarDocumentoClinico
} = require("../dist/hce/documentoClinicoService");
const {
  crearRegistroLifecycleEpisodio,
  actualizarRegistroLifecycleEpisodio,
  obtenerRegistroLifecycleEpisodio
} = require("../dist/hce/episodioLifecycleService");
const {
  listarEventosTrazabilidad,
  obtenerUltimoHashRegistradoOnChain,
  registrarEventoTrazabilidad
} = require("../dist/hce/trazabilidadService");
const {
  listarPermisosEpisodio,
  puedeAccederDocumento,
  registrarPropietarioEpisodio,
  otorgarPermisoEpisodio,
  revocarPermisoEpisodio,
  obtenerEstadosPermisosEpisodio
} = require("../dist/hce/permisosEpisodioService");
const {
  iniciarSesion,
  invalidarSesion,
  obtenerSesionPorToken
} = require("../dist/security/autenticacionService");

function buildPayload({
  start = "2026-03-18T08:00:00",
  end,
  ips = "IPS-001",
  status = "in-progress",
  cie10 = "A099"
} = {}) {
  return {
    patient: {
      resourceType: "Patient",
      identifier: [{ value: "12345678" }],
      name: [{ family: "Perez", given: ["Ana"] }],
      birthDate: "1990-05-20",
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
      code: { coding: [{ system: "http://hl7.org/fhir/sid/icd-10", code: cie10 }] },
      subject: { reference: "Patient/1" }
    }
  };
}

test("HU3-E5: autenticación y autorización resuelven rol e IPS desde backend", () => {
  const login = iniciarSesion("admin.ips001@interhce.local", "AdminIPS001!");
  assert.equal(login.ok, true);
  if (!login.ok) return;

  assert.equal(login.session.rol, "admin_ips");
  assert.equal(login.session.ipsId, "IPS-001");
  assert.ok(login.session.token);

  const persisted = obtenerSesionPorToken(login.session.token);
  assert.equal(persisted?.usuarioId, login.session.usuarioId);
  assert.equal(invalidarSesion(login.session.token), true);
  assert.equal(obtenerSesionPorToken(login.session.token), null);
});

test("HU0-E4 + HU1-E4 + HU3-E1 + HU4-E4: creación, actualización e integridad conservan trazabilidad verificable", async () => {
  const actor = { rol: "profesional_salud", ipsId: "IPS-001", usuarioId: "profesional-001" };
  const episodeId = `ep-s4-${Date.now()}`;
  const payloadV1 = buildPayload();
  const onChainV1 = generarRegistroOnChainMetadataDesdeDocumento(episodeId, payloadV1);

  await almacenarDocumentoClinico(episodeId, payloadV1);
  const lifecycleV1 = crearRegistroLifecycleEpisodio(episodeId, payloadV1, actor, onChainV1);
  registrarPropietarioEpisodio(episodeId, actor.ipsId);
  const traceCreated = await registrarEventoTrazabilidad({
    episodeId,
    eventType: "EPISODE_CREATED",
    actor,
    metadata: {
      version: lifecycleV1.versionActual,
      documentHash: onChainV1.documentHash,
      eventId: lifecycleV1.eventoUrgencias.eventoUrgenciasId,
      sourceIpsId: actor.ipsId
    }
  });

  const payloadV2 = buildPayload({
    end: "2026-03-18T09:10:00",
    status: "finished",
    cie10: "A090"
  });
  const onChainV2 = generarRegistroOnChainMetadataDesdeDocumento(episodeId, payloadV2);
  await almacenarDocumentoClinico(episodeId, payloadV2);
  const lifecycleV2 = actualizarRegistroLifecycleEpisodio(episodeId, payloadV2, actor, onChainV2);
  assert.equal(lifecycleV2.error, undefined);
  const traceUpdated = await registrarEventoTrazabilidad({
    episodeId,
    eventType: "EPISODE_UPDATED",
    actor,
    metadata: {
      version: lifecycleV2.record.versionActual,
      documentHash: onChainV2.documentHash,
      eventId: lifecycleV2.record.eventoUrgencias.eventoUrgenciasId,
      sourceIpsId: actor.ipsId
    }
  });

  const stored = await recuperarDocumentoClinico(episodeId);
  const latestOnChain = obtenerUltimoHashRegistradoOnChain(episodeId);
  const traceEvents = listarEventosTrazabilidad({ episodeId });

  assert.ok(traceCreated.evidence.transactionHash);
  assert.ok(traceUpdated.evidence.transactionHash);
  assert.equal(traceEvents.length >= 2, true);
  assert.equal(lifecycleV2.record.versionActual, 2);
  assert.equal(getLatestEventType(traceEvents), "EPISODE_UPDATED");
  assert.equal(latestOnChain.documentHash, stored.hash);
  assert.equal(calcularHashDocumento(payloadV2), stored.hash);
});

test("HU0-E2 + HU1-E2 + HU2-E4: permisos entre IPS aplican de inmediato y conservan historial auditable", async () => {
  const episodeId = `ep-perm-s4-${Date.now()}`;
  registrarPropietarioEpisodio(episodeId, "IPS-001");

  assert.equal(puedeAccederDocumento(episodeId, "IPS-002", "profesional_salud"), false);

  const grant = otorgarPermisoEpisodio(episodeId, "IPS-001", "IPS-002");
  assert.equal(grant.ok, true);
  if (!grant.ok) return;
  const grantTrace = await registrarEventoTrazabilidad({
    episodeId,
    eventType: "PERMISSION_GRANTED",
    actor: { rol: "admin_ips", ipsId: "IPS-001", usuarioId: "admin-ips-001" },
    metadata: {
      sourceIpsId: grant.permission.sourceIpsId,
      targetIpsId: grant.permission.targetIpsId,
      granted: true
    }
  });

  assert.equal(puedeAccederDocumento(episodeId, "IPS-002", "profesional_salud"), true);
  assert.equal(listarPermisosEpisodio(episodeId).includes("IPS-002"), true);

  const revoke = revocarPermisoEpisodio(episodeId, "IPS-001", "IPS-002");
  assert.equal(revoke.ok, true);
  if (!revoke.ok) return;
  const revokeTrace = await registrarEventoTrazabilidad({
    episodeId,
    eventType: "PERMISSION_REVOKED",
    actor: { rol: "admin_ips", ipsId: "IPS-001", usuarioId: "admin-ips-001" },
    metadata: {
      sourceIpsId: revoke.permission.sourceIpsId,
      targetIpsId: revoke.permission.targetIpsId,
      granted: false
    }
  });

  const traceEvents = listarEventosTrazabilidad({ episodeId });
  const permissionStates = obtenerEstadosPermisosEpisodio(episodeId);

  assert.ok(grantTrace.evidence.transactionHash);
  assert.ok(revokeTrace.evidence.transactionHash);
  assert.equal(puedeAccederDocumento(episodeId, "IPS-002", "profesional_salud"), false);
  assert.equal(traceEvents.some((item) => item.eventType === "PERMISSION_GRANTED"), true);
  assert.equal(traceEvents.some((item) => item.eventType === "PERMISSION_REVOKED"), true);
  assert.equal(permissionStates.some((item) => item.targetIpsId === "IPS-002" && item.activo === false), true);
});

function getLatestEventType(events) {
  return events[events.length - 1]?.eventType;
}

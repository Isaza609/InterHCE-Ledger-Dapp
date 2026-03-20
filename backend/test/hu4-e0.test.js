const test = require("node:test");
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");

process.env.FHIR_BASE_URL = "";

const {
  almacenarDocumentoClinico,
  calcularHashDocumento,
  generarRegistroOnChainMetadata,
  obtenerRegistroOnChainMetadata
} = require("../dist/hce/documentoClinicoService");
const { openApiSpec } = require("../dist/docs/openapi");

function buildPayload() {
  return {
    patient: {
      resourceType: "Patient",
      identifier: [{ value: "CC-10203040" }],
      name: [{ family: "Perez", given: ["Ana"] }],
      birthDate: "1992-06-14",
      gender: "female"
    },
    encounter: {
      resourceType: "Encounter",
      status: "in-progress",
      class: { coding: [{ code: "EMER", display: "Urgencias" }] },
      subject: { reference: "Patient/1" },
      serviceProvider: { reference: "Organization/1" },
      period: { start: "2026-03-17T09:15:00" }
    },
    prestadorOrigen: {
      resourceType: "Organization",
      identifier: [{ system: "https://prestadores.minsalud.gov.co/", value: "IPS-001" }]
    },
    diagnosticoIngreso: {
      resourceType: "Condition",
      code: { coding: [{ system: "http://hl7.org/fhir/sid/icd-10", code: "J189" }] },
      subject: { reference: "Patient/1" }
    }
  };
}

test("HU4-E0: generarRegistroOnChainMetadata solo expone hashes y metadatos no sensibles", () => {
  const payload = buildPayload();
  const hash = calcularHashDocumento(payload);
  const createdAt = "2026-03-17T12:00:00.000Z";
  const metadata = generarRegistroOnChainMetadata("episode-123", {
    episodeId: "episode-123",
    document: payload,
    hash,
    createdAt
  });

  assert.deepEqual(Object.keys(metadata).sort(), [
    "createdAt",
    "documentHash",
    "episodeId",
    "patientIdentifierHash",
    "prestadorOrigenHash"
  ]);
  assert.equal(metadata.episodeId, "episode-123");
  assert.equal(metadata.documentHash, hash);
  assert.equal(metadata.createdAt, createdAt);
  assert.equal(
    metadata.patientIdentifierHash,
    createHash("sha256").update("CC-10203040", "utf8").digest("hex")
  );
  assert.equal(
    metadata.prestadorOrigenHash,
    createHash("sha256").update("IPS-001", "utf8").digest("hex")
  );
  assert.equal("patient" in metadata, false);
  assert.equal("encounter" in metadata, false);
  assert.equal("diagnosticoIngreso" in metadata, false);
});

test("HU4-E0: obtenerRegistroOnChainMetadata excluye datos clinicos del modelo HCE", async () => {
  const payload = buildPayload();
  const episodeId = "episode-hu4-e0-test";

  await almacenarDocumentoClinico(episodeId, payload);
  const metadata = await obtenerRegistroOnChainMetadata(episodeId);

  assert.ok(metadata);
  assert.equal(metadata.episodeId, episodeId);
  assert.equal(typeof metadata.documentHash, "string");
  assert.equal(typeof metadata.patientIdentifierHash, "string");
  assert.equal(typeof metadata.prestadorOrigenHash, "string");
  assert.equal("document" in metadata, false);
  assert.equal("patient" in metadata, false);
  assert.equal("encounter" in metadata, false);
  assert.equal("diagnosticoIngreso" in metadata, false);
});

test("HU4-E0: OpenAPI documenta el endpoint de metadatos on-chain", () => {
  const path = openApiSpec?.paths?.["/episodes/{id}/onchain-metadata"];
  assert.ok(path);
  assert.ok(path.get);
  assert.equal(typeof path.get.summary, "string");
  assert.equal(path.get.summary.includes("HU4-E0"), true);
});

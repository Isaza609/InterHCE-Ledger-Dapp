const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("InterHCELedger", function () {
  async function deployFixture() {
    const [owner, profesional, adminIps, auditor] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("InterHCELedger");
    const ledger = await Factory.deploy();
    await ledger.waitForDeployment();

    const ips001Hash = ethers.keccak256(ethers.toUtf8Bytes("IPS-001"));
    const ips002Hash = ethers.keccak256(ethers.toUtf8Bytes("IPS-002"));

    await ledger.gestionarUsuario(
      profesional.address,
      2,
      ips001Hash,
      true
    );
    await ledger.gestionarUsuario(
      adminIps.address,
      3,
      ips001Hash,
      true
    );
    await ledger.gestionarUsuario(
      auditor.address,
      4,
      ethers.ZeroHash,
      true
    );

    return {
      ledger,
      owner,
      profesional,
      adminIps,
      auditor,
      ips001Hash,
      ips002Hash
    };
  }

  it("emite trazabilidad independiente para creación y actualización del episodio", async function () {
    const { ledger, profesional, ips001Hash } = await deployFixture();
    const episodeIdHash = ethers.keccak256(ethers.toUtf8Bytes("episode-001"));
    const eventIdHash = ethers.keccak256(ethers.toUtf8Bytes("event-001"));
    const hashV1 = ethers.keccak256(ethers.toUtf8Bytes("doc-v1"));
    const hashV2 = ethers.keccak256(ethers.toUtf8Bytes("doc-v2"));

    await expect(
      ledger
        .connect(profesional)
        .registrarEpisodio(episodeIdHash, eventIdHash, hashV1, ips001Hash)
    )
      .to.emit(ledger, "EpisodioRegistrado")
      .withArgs(episodeIdHash, eventIdHash, hashV1, 1, ips001Hash);

    await expect(
      ledger
        .connect(profesional)
        .actualizarEpisodio(episodeIdHash, eventIdHash, hashV2, ips001Hash)
    )
      .to.emit(ledger, "EpisodioActualizado")
      .withArgs(episodeIdHash, eventIdHash, hashV2, 2, ips001Hash);

    const episodio = await ledger.episodios(episodeIdHash);
    expect(episodio.currentDocumentHash).to.equal(hashV2);
    expect(episodio.versionActual).to.equal(2n);
  });

  it("permite a admin_ips registrar otorgamiento y revocación de permisos", async function () {
    const { ledger, adminIps, ips001Hash, ips002Hash } = await deployFixture();
    const episodeIdHash = ethers.keccak256(ethers.toUtf8Bytes("episode-perm-001"));

    await expect(
      ledger
        .connect(adminIps)
        .registrarPermisoDocumento(episodeIdHash, ips001Hash, ips002Hash, true)
    )
      .to.emit(ledger, "PermisoDocumentoActualizado")
      .withArgs(episodeIdHash, ips001Hash, ips002Hash, true);

    await expect(
      ledger
        .connect(adminIps)
        .registrarPermisoDocumento(episodeIdHash, ips001Hash, ips002Hash, false)
    )
      .to.emit(ledger, "PermisoDocumentoActualizado")
      .withArgs(episodeIdHash, ips001Hash, ips002Hash, false);
  });

  it("acepta admin_ips como actor clínico para creación y actualización", async function () {
    const { ledger, adminIps, ips001Hash } = await deployFixture();
    const episodeIdHash = ethers.keccak256(ethers.toUtf8Bytes("episode-admin-001"));
    const eventIdHash = ethers.keccak256(ethers.toUtf8Bytes("event-admin-001"));
    const hashV1 = ethers.keccak256(ethers.toUtf8Bytes("doc-admin-v1"));

    await expect(
      ledger
        .connect(adminIps)
        .registrarEpisodio(episodeIdHash, eventIdHash, hashV1, ips001Hash)
    ).to.emit(ledger, "EpisodioRegistrado");
  });
});

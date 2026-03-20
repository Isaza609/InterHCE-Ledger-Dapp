const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

async function main() {
  const network = hre.network.name;
  if (network !== "sepolia") {
    throw new Error("Este script está pensado para ejecutarse en sepolia.");
  }

  const Factory = await hre.ethers.getContractFactory("InterHCELedger");
  const contract = await Factory.deploy();
  await contract.waitForDeployment();
  const address = await contract.getAddress();

  const outDir = path.resolve(__dirname, "../../shared/blockchain");
  const outFile = path.join(outDir, "contracts.sepolia.json");
  fs.mkdirSync(outDir, { recursive: true });

  const payload = {
    network: "sepolia",
    chainId: 11155111,
    deployedAt: new Date().toISOString(),
    contracts: {
      InterHCELedger: address
    }
  };

  fs.writeFileSync(outFile, JSON.stringify(payload, null, 2), "utf8");
  console.log("Contrato desplegado:", address);
  console.log("Archivo generado:", outFile);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

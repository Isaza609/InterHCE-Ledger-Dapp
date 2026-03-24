import { createHash } from "crypto";
import { existsSync, readFileSync } from "fs";
import { createRequire } from "module";
import path from "path";
import { config as loadDotenv } from "dotenv";
import type { ActorContexto } from "../hce/episodioLifecycleService";

export interface BlockchainTraceConfig {
  enabled: boolean;
  network: string;
  chainId: number;
  contractAddress?: string;
  rpcUrlConfigured: boolean;
  signerConfigured: boolean;
}

export interface BlockchainTraceReceipt {
  ledgerMode: "real";
  network: string;
  chainId: number;
  contractAddress: string;
  transactionHash: string;
  explorerUrl?: string;
  emitterId: string;
  metricsMode: "measured" | "estimated";
  submittedAt: string;
  confirmedAt: string;
  confirmationMs: number;
  gasUsed?: string;
  gasPriceWei?: string;
  transactionCostWei?: string;
  blockNumber?: number;
}

export interface BlockchainHealthCheck {
  checkedAt: string;
  rpcReachable: boolean;
  blockNumber?: number;
  message?: string;
}

export class BlockchainTraceError extends Error {
  readonly details?: Record<string, unknown>;

  constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "BlockchainTraceError";
    this.details = details;
  }
}

type TraceableEventType =
  | "EPISODE_CREATED"
  | "EPISODE_UPDATED"
  | "PERMISSION_GRANTED"
  | "PERMISSION_REVOKED"
  | "AUDITABLE_ACCESS"
  | "INTEGRITY_CHECK";

interface TraceTransactionInput {
  episodeId: string;
  eventType: TraceableEventType;
  actor: ActorContexto;
  metadata: Record<string, string | number | boolean | null | undefined>;
}

interface DeploymentConfig {
  network: string;
  chainId: number;
  contracts?: {
    InterHCELedger?: string;
  };
}

interface MockMetricSeed {
  confirmationMs: number;
  gasUsed: string;
  gasPriceWei: string;
}

const MOCK_METRICS: Record<TraceableEventType, MockMetricSeed> = {
  EPISODE_CREATED: {
    confirmationMs: 1280,
    gasUsed: "205000",
    gasPriceWei: "15000000000"
  },
  EPISODE_UPDATED: {
    confirmationMs: 1160,
    gasUsed: "189000",
    gasPriceWei: "15000000000"
  },
  PERMISSION_GRANTED: {
    confirmationMs: 910,
    gasUsed: "128000",
    gasPriceWei: "14000000000"
  },
  PERMISSION_REVOKED: {
    confirmationMs: 880,
    gasUsed: "124000",
    gasPriceWei: "14000000000"
  },
  AUDITABLE_ACCESS: {
    confirmationMs: 760,
    gasUsed: "91000",
    gasPriceWei: "12000000000"
  },
  INTEGRITY_CHECK: {
    confirmationMs: 740,
    gasUsed: "88000",
    gasPriceWei: "12000000000"
  }
};

let envLoaded = false;
const requireFromBackend = createRequire(__filename);

function ensureEnvLoaded(): void {
  if (envLoaded) return;
  envLoaded = true;
  const envCandidates = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "../contracts/.env"),
    path.resolve(__dirname, "../../../contracts/.env")
  ];
  for (const candidate of envCandidates) {
    if (existsSync(candidate)) {
      loadDotenv({ path: candidate, override: false });
    }
  }
}

function readDeploymentConfig(): DeploymentConfig {
  const filePath = path.resolve(
    __dirname,
    "../../../shared/blockchain/contracts.sepolia.json"
  );
  if (!existsSync(filePath)) {
    return { network: "sepolia", chainId: 11155111 };
  }
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as DeploymentConfig;
  } catch {
    return { network: "sepolia", chainId: 11155111 };
  }
}

function readContractAbi(): unknown[] {
  const artifactPath = path.resolve(
    __dirname,
    "../../../contracts/artifacts/contracts/InterHCELedger.sol/InterHCELedger.json"
  );
  if (!existsSync(artifactPath)) {
    throw new Error("No se encontró el artefacto ABI de InterHCELedger.");
  }
  const artifact = JSON.parse(readFileSync(artifactPath, "utf8")) as { abi?: unknown[] };
  if (!artifact.abi) {
    throw new Error("El artefacto del contrato no contiene ABI.");
  }
  return artifact.abi;
}

async function loadEthersModule(): Promise<any> {
  try {
    return requireFromBackend("ethers");
  } catch {
    const localEthers = path.resolve(
      __dirname,
      "../../../contracts/node_modules/ethers/lib.commonjs/index.js"
    );
    return requireFromBackend(localEthers);
  }
}

function normalizeSha256ToBytes32(hash?: string): string {
  const normalized = String(hash ?? "").replace(/^0x/i, "").trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(normalized)) {
    throw new Error("El hash documental no tiene formato SHA-256 hexadecimal válido.");
  }
  return `0x${normalized}`;
}

function buildExplorerUrl(network: string, txHash: string): string | undefined {
  if (network === "sepolia") {
    return `https://sepolia.etherscan.io/tx/${txHash}`;
  }
  return undefined;
}

function addMilliseconds(baseIso: string, milliseconds: number): string {
  return new Date(Date.parse(baseIso) + milliseconds).toISOString();
}

function buildMockReceipt(
  input: TraceTransactionInput,
  config: BlockchainTraceConfig
): BlockchainTraceReceipt {
  const seed = MOCK_METRICS[input.eventType];
  const submittedAt = new Date().toISOString();
  const confirmedAt = addMilliseconds(submittedAt, seed.confirmationMs);
  const transactionHash = `0x${createHash("sha256")
    .update(JSON.stringify({ input, issuedAt: submittedAt }), "utf8")
    .digest("hex")}`;
  const contractAddress = config.contractAddress || "0x0000000000000000000000000000000000000000";
  const transactionCostWei = (BigInt(seed.gasUsed) * BigInt(seed.gasPriceWei)).toString();

  return {
    ledgerMode: "real",
    network: config.network,
    chainId: config.chainId,
    contractAddress,
    transactionHash,
    explorerUrl: buildExplorerUrl(config.network, transactionHash),
    emitterId: "mock-backend-signer",
    metricsMode: "estimated",
    submittedAt,
    confirmedAt,
    confirmationMs: seed.confirmationMs,
    gasUsed: seed.gasUsed,
    gasPriceWei: seed.gasPriceWei,
    transactionCostWei,
    blockNumber: 0
  };
}

export function obtenerConfiguracionBlockchainReal(): BlockchainTraceConfig {
  ensureEnvLoaded();
  const deployment = readDeploymentConfig();
  const rpcUrl = String(process.env.SEPOLIA_RPC_URL ?? "").trim();
  const privateKey = String(process.env.DEPLOYER_PRIVATE_KEY ?? "").trim();
  const contractAddress = deployment.contracts?.InterHCELedger?.trim();
  const traceMode = String(process.env.BLOCKCHAIN_TRACE_MODE ?? "auto").trim().toLowerCase();

  if (traceMode === "mock") {
    return {
      enabled: true,
      network: deployment.network || "sepolia",
      chainId: deployment.chainId || 11155111,
      contractAddress: contractAddress || "0x0000000000000000000000000000000000000000",
      rpcUrlConfigured: true,
      signerConfigured: true
    };
  }

  const enabledByMode = traceMode !== "disabled";
  return {
    enabled: enabledByMode && Boolean(rpcUrl && privateKey && contractAddress),
    network: deployment.network || "sepolia",
    chainId: deployment.chainId || 11155111,
    contractAddress: contractAddress || undefined,
    rpcUrlConfigured: Boolean(rpcUrl),
    signerConfigured: Boolean(privateKey)
  };
}

export async function verificarConexionBlockchainReal(): Promise<BlockchainHealthCheck | null> {
  ensureEnvLoaded();
  const checkedAt = new Date().toISOString();
  const traceMode = String(process.env.BLOCKCHAIN_TRACE_MODE ?? "auto").trim().toLowerCase();
  if (traceMode === "mock") {
    return {
      checkedAt,
      rpcReachable: true,
      blockNumber: 0,
      message: "Modo mock activo para validaciones automatizadas."
    };
  }

  const rpcUrl = String(process.env.SEPOLIA_RPC_URL ?? "").trim();
  if (!rpcUrl) {
    return null;
  }

  try {
    const ethers = await loadEthersModule();
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const blockNumber = await provider.getBlockNumber();
    return {
      checkedAt,
      rpcReachable: true,
      blockNumber
    };
  } catch (error) {
    return {
      checkedAt,
      rpcReachable: false,
      message: error instanceof Error ? error.message : "No fue posible consultar la RPC."
    };
  }
}

export async function registrarEventoBlockchainReal(
  input: TraceTransactionInput
): Promise<BlockchainTraceReceipt | null> {
  const traceMode = String(process.env.BLOCKCHAIN_TRACE_MODE ?? "auto").trim().toLowerCase();
  const config = obtenerConfiguracionBlockchainReal();
  if (traceMode === "mock") {
    return buildMockReceipt(input, config);
  }
  if (!config.enabled || !config.contractAddress) {
    throw new BlockchainTraceError("La configuración de blockchain real es obligatoria.", {
      network: config.network,
      chainId: config.chainId,
      contractAddress: config.contractAddress,
      rpcUrlConfigured: config.rpcUrlConfigured,
      signerConfigured: config.signerConfigured
    });
  }

  const rpcUrl = String(process.env.SEPOLIA_RPC_URL ?? "").trim();
  const privateKey = String(process.env.DEPLOYER_PRIVATE_KEY ?? "").trim();
  const abi = readContractAbi();
  const ethers = await loadEthersModule();
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  const contract = new ethers.Contract(config.contractAddress, abi, wallet);

  const episodeIdHash = ethers.keccak256(ethers.toUtf8Bytes(input.episodeId));
  const sourceIpsId = String(input.metadata.sourceIpsId ?? input.actor.ipsId ?? "").trim();
  const sourceIpsHash = ethers.keccak256(ethers.toUtf8Bytes(sourceIpsId || "SIN_IPS"));

  const submittedAt = new Date().toISOString();
  let txResponse;
  switch (input.eventType) {
    case "EPISODE_CREATED":
      txResponse = await contract.registrarEpisodio(
        episodeIdHash,
        ethers.keccak256(ethers.toUtf8Bytes(String(input.metadata.eventId ?? input.episodeId))),
        normalizeSha256ToBytes32(String(input.metadata.documentHash ?? "")),
        sourceIpsHash
      );
      break;
    case "EPISODE_UPDATED":
      txResponse = await contract.actualizarEpisodio(
        episodeIdHash,
        ethers.keccak256(ethers.toUtf8Bytes(String(input.metadata.eventId ?? input.episodeId))),
        normalizeSha256ToBytes32(String(input.metadata.documentHash ?? "")),
        sourceIpsHash
      );
      break;
    case "PERMISSION_GRANTED":
    case "PERMISSION_REVOKED":
      txResponse = await contract.registrarPermisoDocumento(
        episodeIdHash,
        sourceIpsHash,
        ethers.keccak256(
          ethers.toUtf8Bytes(String(input.metadata.targetIpsId ?? "SIN_DESTINO"))
        ),
        input.eventType === "PERMISSION_GRANTED"
      );
      break;
    case "AUDITABLE_ACCESS":
    case "INTEGRITY_CHECK":
      txResponse = await contract.registrarTraza(
        episodeIdHash,
        input.eventType,
        sourceIpsHash,
        ethers.toUtf8Bytes(
          JSON.stringify({
            actor: input.actor,
            metadata: input.metadata,
            recordedAt: new Date().toISOString()
          })
        )
      );
      break;
    default:
      return null;
  }

  const receipt = await txResponse.wait();
  const confirmedAt = new Date().toISOString();
  const confirmationMs = Date.parse(confirmedAt) - Date.parse(submittedAt);
  const gasUsed = receipt?.gasUsed ? receipt.gasUsed.toString() : undefined;
  const gasPriceWei = (receipt?.gasPrice ?? receipt?.effectiveGasPrice ?? txResponse.gasPrice)
    ? String(receipt?.gasPrice ?? receipt?.effectiveGasPrice ?? txResponse.gasPrice)
    : undefined;
  const transactionCostWei = gasUsed && gasPriceWei
    ? (BigInt(gasUsed) * BigInt(gasPriceWei)).toString()
    : undefined;

  return {
    ledgerMode: "real",
    network: config.network,
    chainId: config.chainId,
    contractAddress: config.contractAddress,
    transactionHash: txResponse.hash,
    explorerUrl: buildExplorerUrl(config.network, txResponse.hash),
    emitterId: wallet.address,
    metricsMode: "measured",
    submittedAt,
    confirmedAt,
    confirmationMs,
    gasUsed,
    gasPriceWei,
    transactionCostWei,
    blockNumber: typeof receipt?.blockNumber === "number" ? receipt.blockNumber : undefined
  };
}

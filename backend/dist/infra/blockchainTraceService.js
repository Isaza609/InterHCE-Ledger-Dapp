"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlockchainTraceError = void 0;
exports.obtenerConfiguracionBlockchainReal = obtenerConfiguracionBlockchainReal;
exports.verificarConexionBlockchainReal = verificarConexionBlockchainReal;
exports.registrarEventoBlockchainReal = registrarEventoBlockchainReal;
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const module_1 = require("module");
const path_1 = __importDefault(require("path"));
const dotenv_1 = require("dotenv");
class BlockchainTraceError extends Error {
    constructor(message, details) {
        super(message);
        this.name = "BlockchainTraceError";
        this.details = details;
    }
}
exports.BlockchainTraceError = BlockchainTraceError;
const MOCK_METRICS = {
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
const requireFromBackend = (0, module_1.createRequire)(__filename);
function ensureEnvLoaded() {
    if (envLoaded)
        return;
    envLoaded = true;
    const envCandidates = [
        path_1.default.resolve(process.cwd(), ".env"),
        path_1.default.resolve(process.cwd(), "../contracts/.env"),
        path_1.default.resolve(__dirname, "../../../contracts/.env")
    ];
    for (const candidate of envCandidates) {
        if ((0, fs_1.existsSync)(candidate)) {
            (0, dotenv_1.config)({ path: candidate, override: false });
        }
    }
}
function readDeploymentConfig() {
    const filePath = path_1.default.resolve(__dirname, "../../../shared/blockchain/contracts.sepolia.json");
    if (!(0, fs_1.existsSync)(filePath)) {
        return { network: "sepolia", chainId: 11155111 };
    }
    try {
        return JSON.parse((0, fs_1.readFileSync)(filePath, "utf8"));
    }
    catch {
        return { network: "sepolia", chainId: 11155111 };
    }
}
function readContractAbi() {
    const artifactPath = path_1.default.resolve(__dirname, "../../../contracts/artifacts/contracts/InterHCELedger.sol/InterHCELedger.json");
    if (!(0, fs_1.existsSync)(artifactPath)) {
        throw new Error("No se encontró el artefacto ABI de InterHCELedger.");
    }
    const artifact = JSON.parse((0, fs_1.readFileSync)(artifactPath, "utf8"));
    if (!artifact.abi) {
        throw new Error("El artefacto del contrato no contiene ABI.");
    }
    return artifact.abi;
}
async function loadEthersModule() {
    try {
        return requireFromBackend("ethers");
    }
    catch {
        const localEthers = path_1.default.resolve(__dirname, "../../../contracts/node_modules/ethers/lib.commonjs/index.js");
        return requireFromBackend(localEthers);
    }
}
function normalizeSha256ToBytes32(hash) {
    const normalized = String(hash ?? "").replace(/^0x/i, "").trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(normalized)) {
        throw new Error("El hash documental no tiene formato SHA-256 hexadecimal válido.");
    }
    return `0x${normalized}`;
}
function buildExplorerUrl(network, txHash) {
    if (network === "sepolia") {
        return `https://sepolia.etherscan.io/tx/${txHash}`;
    }
    return undefined;
}
function addMilliseconds(baseIso, milliseconds) {
    return new Date(Date.parse(baseIso) + milliseconds).toISOString();
}
function buildMockReceipt(input, config) {
    const seed = MOCK_METRICS[input.eventType];
    const submittedAt = new Date().toISOString();
    const confirmedAt = addMilliseconds(submittedAt, seed.confirmationMs);
    const transactionHash = `0x${(0, crypto_1.createHash)("sha256")
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
function obtenerConfiguracionBlockchainReal() {
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
async function verificarConexionBlockchainReal() {
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
    }
    catch (error) {
        return {
            checkedAt,
            rpcReachable: false,
            message: error instanceof Error ? error.message : "No fue posible consultar la RPC."
        };
    }
}
async function registrarEventoBlockchainReal(input) {
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
            txResponse = await contract.registrarEpisodio(episodeIdHash, ethers.keccak256(ethers.toUtf8Bytes(String(input.metadata.eventId ?? input.episodeId))), normalizeSha256ToBytes32(String(input.metadata.documentHash ?? "")), sourceIpsHash);
            break;
        case "EPISODE_UPDATED":
            txResponse = await contract.actualizarEpisodio(episodeIdHash, ethers.keccak256(ethers.toUtf8Bytes(String(input.metadata.eventId ?? input.episodeId))), normalizeSha256ToBytes32(String(input.metadata.documentHash ?? "")), sourceIpsHash);
            break;
        case "PERMISSION_GRANTED":
        case "PERMISSION_REVOKED":
            txResponse = await contract.registrarPermisoDocumento(episodeIdHash, sourceIpsHash, ethers.keccak256(ethers.toUtf8Bytes(String(input.metadata.targetIpsId ?? "SIN_DESTINO"))), input.eventType === "PERMISSION_GRANTED");
            break;
        case "AUDITABLE_ACCESS":
        case "INTEGRITY_CHECK":
            txResponse = await contract.registrarTraza(episodeIdHash, input.eventType, sourceIpsHash, ethers.toUtf8Bytes(JSON.stringify({
                actor: input.actor,
                metadata: input.metadata,
                recordedAt: new Date().toISOString()
            })));
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

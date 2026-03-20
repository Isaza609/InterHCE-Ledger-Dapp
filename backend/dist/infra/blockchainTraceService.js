"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.obtenerConfiguracionBlockchainReal = obtenerConfiguracionBlockchainReal;
exports.verificarConexionBlockchainReal = verificarConexionBlockchainReal;
exports.registrarEventoBlockchainReal = registrarEventoBlockchainReal;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const url_1 = require("url");
const dotenv_1 = require("dotenv");
let envLoaded = false;
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
        const packageName = "ethers";
        return await Promise.resolve(`${packageName}`).then(s => __importStar(require(s)));
    }
    catch {
        const localEthers = path_1.default.resolve(__dirname, "../../../contracts/node_modules/ethers/lib.commonjs/index.js");
        return Promise.resolve(`${(0, url_1.pathToFileURL)(localEthers).href}`).then(s => __importStar(require(s)));
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
function obtenerConfiguracionBlockchainReal() {
    ensureEnvLoaded();
    const deployment = readDeploymentConfig();
    const rpcUrl = String(process.env.SEPOLIA_RPC_URL ?? "").trim();
    const privateKey = String(process.env.DEPLOYER_PRIVATE_KEY ?? "").trim();
    const contractAddress = deployment.contracts?.InterHCELedger?.trim();
    const traceMode = String(process.env.BLOCKCHAIN_TRACE_MODE ?? "auto").trim().toLowerCase();
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
    const config = obtenerConfiguracionBlockchainReal();
    if (!config.enabled || !config.contractAddress) {
        return null;
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
    await txResponse.wait();
    return {
        ledgerMode: "real",
        network: config.network,
        chainId: config.chainId,
        contractAddress: config.contractAddress,
        transactionHash: txResponse.hash,
        explorerUrl: buildExplorerUrl(config.network, txResponse.hash)
    };
}

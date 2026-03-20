"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registrarEventoTrazabilidad = registrarEventoTrazabilidad;
exports.listarEventosTrazabilidad = listarEventosTrazabilidad;
exports.obtenerUltimoHashRegistradoOnChain = obtenerUltimoHashRegistradoOnChain;
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const blockchainTraceService_1 = require("../infra/blockchainTraceService");
const eventosStore = [];
function loadDeploymentConfig() {
    const filePath = path_1.default.resolve(__dirname, "../../../shared/blockchain/contracts.sepolia.json");
    if (!(0, fs_1.existsSync)(filePath)) {
        return {
            network: "sepolia",
            chainId: 11155111
        };
    }
    try {
        const parsed = JSON.parse((0, fs_1.readFileSync)(filePath, "utf8"));
        return {
            network: parsed.network || "sepolia",
            chainId: parsed.chainId || 11155111,
            contracts: parsed.contracts
        };
    }
    catch {
        return {
            network: "sepolia",
            chainId: 11155111
        };
    }
}
function buildExplorerUrl(network, transactionHash) {
    if (!transactionHash)
        return undefined;
    if (network === "sepolia") {
        return `https://sepolia.etherscan.io/tx/${transactionHash}`;
    }
    return undefined;
}
function buildTransactionHash(payload) {
    const serialized = JSON.stringify(payload);
    return `0x${(0, crypto_1.createHash)("sha256").update(serialized, "utf8").digest("hex")}`;
}
async function registrarEventoTrazabilidad(input) {
    const config = loadDeploymentConfig();
    const traceId = (0, crypto_1.randomUUID)();
    const recordedAt = new Date().toISOString();
    const metadata = { ...(input.metadata ?? {}) };
    const txPayload = {
        traceId,
        episodeId: input.episodeId,
        eventType: input.eventType,
        actor: input.actor,
        metadata,
        recordedAt
    };
    const fallbackTransactionHash = buildTransactionHash(txPayload);
    const fallbackEvidence = {
        ledgerMode: "simulado",
        network: config.network,
        chainId: config.chainId,
        contractAddress: config.contracts?.InterHCELedger,
        transactionHash: fallbackTransactionHash,
        explorerUrl: buildExplorerUrl(config.network, fallbackTransactionHash)
    };
    let evidence = fallbackEvidence;
    try {
        const realReceipt = await (0, blockchainTraceService_1.registrarEventoBlockchainReal)({
            episodeId: input.episodeId,
            eventType: input.eventType,
            actor: input.actor,
            metadata
        });
        if (realReceipt) {
            evidence = realReceipt;
        }
    }
    catch {
        evidence = fallbackEvidence;
    }
    const event = {
        traceId,
        episodeId: input.episodeId,
        eventType: input.eventType,
        recordedAt,
        actor: { ...input.actor },
        metadata,
        evidence
    };
    eventosStore.push(event);
    return {
        ...event,
        actor: { ...event.actor },
        metadata: { ...event.metadata },
        evidence: { ...event.evidence }
    };
}
function listarEventosTrazabilidad(input) {
    const episodeId = input?.episodeId?.trim();
    const ipsId = input?.ipsId?.trim();
    return eventosStore
        .filter((item) => {
        if (episodeId && item.episodeId !== episodeId)
            return false;
        if (input?.eventType && item.eventType !== input.eventType)
            return false;
        if (ipsId && item.actor.ipsId !== ipsId && item.metadata.targetIpsId !== ipsId)
            return false;
        return true;
    })
        .map((item) => ({
        ...item,
        actor: { ...item.actor },
        metadata: { ...item.metadata },
        evidence: { ...item.evidence }
    }));
}
function obtenerUltimoHashRegistradoOnChain(episodeId) {
    const events = listarEventosTrazabilidad({ episodeId }).filter((item) => item.eventType === "EPISODE_CREATED" || item.eventType === "EPISODE_UPDATED");
    const last = events[events.length - 1];
    const rawHash = last?.metadata.documentHash;
    return {
        documentHash: typeof rawHash === "string" ? rawHash : undefined,
        traceEvent: last
    };
}

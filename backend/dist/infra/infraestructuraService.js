"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.configurarIpsSimuladas = configurarIpsSimuladas;
exports.listarIpsSimuladas = listarIpsSimuladas;
exports.obtenerEstadoInfraestructura = obtenerEstadoInfraestructura;
const fhirClient_1 = require("../hce/fhirClient");
const blockchainTraceService_1 = require("./blockchainTraceService");
const estadoInfra = {
    red: "sepolia",
    chainId: 11155111
};
const ipsSimuladas = new Map();
function configurarIpsSimuladas(ips) {
    const normalizadas = ips.map((item) => ({
        ipsId: item.ipsId.trim(),
        nombre: item.nombre.trim(),
        repsCodigo: item.repsCodigo.trim()
    }));
    if (normalizadas.some((item) => !item.ipsId || !item.nombre || !item.repsCodigo)) {
        return {
            ok: false,
            message: "Cada IPS simulada debe incluir ipsId, nombre y repsCodigo."
        };
    }
    if (new Set(normalizadas.map((item) => item.ipsId)).size !== normalizadas.length) {
        return {
            ok: false,
            message: "No puede haber ipsId repetidos en la simulación."
        };
    }
    ipsSimuladas.clear();
    for (const item of normalizadas) {
        ipsSimuladas.set(item.ipsId, item);
    }
    return { ok: true, total: ipsSimuladas.size };
}
function listarIpsSimuladas() {
    return [...ipsSimuladas.values()];
}
function obtenerEstadoInfraestructura() {
    const ips = listarIpsSimuladas();
    const fhirConfigurado = (0, fhirClient_1.isFhirConfigured)();
    const blockchainReal = (0, blockchainTraceService_1.obtenerConfiguracionBlockchainReal)();
    const blockchainMode = blockchainReal.enabled ? "real" : "no_disponible";
    const contratosOperativos = blockchainReal.enabled;
    const cumpleHu1E5 = contratosOperativos && ips.length >= 2;
    return {
        backend: {
            status: "ok",
            timestamp: new Date().toISOString()
        },
        blockchain: {
            red: blockchainReal.network || estadoInfra.red,
            chainId: blockchainReal.chainId || estadoInfra.chainId,
            contratosOperativos,
            modo: blockchainMode,
            contractAddress: blockchainReal.contractAddress,
            backendSignerConfigured: blockchainReal.signerConfigured,
            backendRpcConfigured: blockchainReal.rpcUrlConfigured,
            rpcReachable: undefined,
            lastBlockNumber: undefined,
            checkedAt: undefined,
            healthMessage: undefined
        },
        offChain: {
            fhirConfigurado,
            almacenamiento: fhirConfigurado ? "hapi-fhir" : "memoria"
        },
        simulacionIps: {
            total: ips.length,
            ips,
            multipleIpsActivo: ips.length >= 2
        },
        cumpleHu1E5
    };
}

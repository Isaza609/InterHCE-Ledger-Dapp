"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.infraRouter = void 0;
const express_1 = require("express");
const blockchainTraceService_1 = require("../infra/blockchainTraceService");
const infraestructuraService_1 = require("../infra/infraestructuraService");
exports.infraRouter = (0, express_1.Router)();
exports.infraRouter.get("/status", async (_req, res) => {
    const estado = (0, infraestructuraService_1.obtenerEstadoInfraestructura)();
    const health = await (0, blockchainTraceService_1.verificarConexionBlockchainReal)();
    if (health) {
        estado.blockchain.rpcReachable = health.rpcReachable;
        estado.blockchain.lastBlockNumber = health.blockNumber;
        estado.blockchain.checkedAt = health.checkedAt;
        estado.blockchain.healthMessage = health.message;
    }
    return res.status(200).json({
        code: "OK",
        message: "Estado de infraestructura del prototipo (HU1-E5).",
        data: estado
    });
});
exports.infraRouter.get("/ips", (_req, res) => {
    return res.status(200).json({
        code: "OK",
        ips: (0, infraestructuraService_1.listarIpsSimuladas)()
    });
});
exports.infraRouter.post("/ips", (req, res) => {
    const ips = Array.isArray(req.body?.ips) ? req.body.ips : [];
    const result = (0, infraestructuraService_1.configurarIpsSimuladas)(ips);
    if (!result.ok) {
        return res.status(400).json({
            code: "INVALID_IPS_SIMULATION",
            message: result.message
        });
    }
    return res.status(200).json({
        code: "IPS_SIMULATION_UPDATED",
        message: `Simulación de IPS actualizada (${result.total} IPS).`,
        total: result.total,
        ips: (0, infraestructuraService_1.listarIpsSimuladas)()
    });
});
exports.infraRouter.post("/contracts/mock-deploy", (_req, res) => {
    (0, infraestructuraService_1.activarContratosSimulados)();
    return res.status(200).json({
        code: "CONTRACTS_SIMULATED",
        message: "Contratos marcados como operativos en modo simulado (HU1-E5).",
        data: (0, infraestructuraService_1.obtenerEstadoInfraestructura)().blockchain
    });
});

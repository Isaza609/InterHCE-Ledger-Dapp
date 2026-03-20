import { Router } from "express";
import { verificarConexionBlockchainReal } from "../infra/blockchainTraceService";
import {
  activarContratosSimulados,
  configurarIpsSimuladas,
  listarIpsSimuladas,
  obtenerEstadoInfraestructura
} from "../infra/infraestructuraService";

export const infraRouter = Router();

infraRouter.get("/status", async (_req, res) => {
  const estado = obtenerEstadoInfraestructura();
  const health = await verificarConexionBlockchainReal();
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

infraRouter.get("/ips", (_req, res) => {
  return res.status(200).json({
    code: "OK",
    ips: listarIpsSimuladas()
  });
});

infraRouter.post("/ips", (req, res) => {
  const ips = Array.isArray(req.body?.ips) ? req.body.ips : [];
  const result = configurarIpsSimuladas(ips);
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
    ips: listarIpsSimuladas()
  });
});

infraRouter.post("/contracts/mock-deploy", (_req, res) => {
  activarContratosSimulados();
  return res.status(200).json({
    code: "CONTRACTS_SIMULATED",
    message: "Contratos marcados como operativos en modo simulado (HU1-E5).",
    data: obtenerEstadoInfraestructura().blockchain
  });
});

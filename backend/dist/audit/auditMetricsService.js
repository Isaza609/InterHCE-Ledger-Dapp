"use strict";
/**
 * Servicio de métricas de auditoría (RF10).
 * Persiste los registros en backend/data/audit-metrics.json.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.listarMetricas = listarMetricas;
exports.obtenerMetricaPorId = obtenerMetricaPorId;
exports.ejecutarEvaluacion = ejecutarEvaluacion;
exports.eliminarMetrica = eliminarMetrica;
const crypto_1 = require("crypto");
const jsonFileStore_1 = require("../shared/jsonFileStore");
const pandorasBoxAdapter_1 = require("./pandorasBoxAdapter");
const auditMetricModel_1 = require("./auditMetricModel");
const STORE_FILE = "audit-metrics.json";
// ─── Persistencia ─────────────────────────────────────────────────────────────
function cargarRegistros() {
    return (0, jsonFileStore_1.loadJsonFile)(STORE_FILE, []);
}
function guardarRegistros(records) {
    (0, jsonFileStore_1.saveJsonFile)(STORE_FILE, records);
}
// ─── Semáforos ────────────────────────────────────────────────────────────────
function calcSemaforoEficiencia(tpsPromedio, config) {
    const verde = config.umbralTpsVerde ?? auditMetricModel_1.UMBRALES_DEFAULT.tpsVerde;
    const amarillo = config.umbralTpsAmarillo ?? auditMetricModel_1.UMBRALES_DEFAULT.tpsAmarillo;
    if (tpsPromedio >= verde)
        return "verde";
    if (tpsPromedio >= amarillo)
        return "amarillo";
    return "rojo";
}
function calcSemaforoLatencia(latenciaMs, config) {
    const verde = config.umbralLatenciaVerdeMs ?? auditMetricModel_1.UMBRALES_DEFAULT.latenciaVerdeMs;
    const amarillo = config.umbralLatenciaAmarilloMs ?? auditMetricModel_1.UMBRALES_DEFAULT.latenciaAmarilloMs;
    if (latenciaMs <= verde)
        return "verde";
    if (latenciaMs <= amarillo)
        return "amarillo";
    return "rojo";
}
function calcSemaforoSeguridad(tasaExito, config) {
    const verde = config.umbralTasaExitoVerde ?? auditMetricModel_1.UMBRALES_DEFAULT.tasaExitoVerde;
    const amarillo = auditMetricModel_1.UMBRALES_DEFAULT.tasaExitoAmarillo;
    if (tasaExito >= verde)
        return "verde";
    if (tasaExito >= amarillo)
        return "amarillo";
    return "rojo";
}
function calcSemaforoInteroperabilidad(modo, deployExitoso, llamadasERCExitosas, llamadasERCTotal) {
    if (modo === "EOA") {
        // Para EOA no hay deploy ni ERC, se evalúa solo disponibilidad
        return "verde";
    }
    if (!deployExitoso)
        return "rojo";
    if (!llamadasERCTotal)
        return "amarillo";
    const tasa = (llamadasERCExitosas / llamadasERCTotal) * 100;
    if (tasa >= 95)
        return "verde";
    if (tasa >= 80)
        return "amarillo";
    return "rojo";
}
// ─── Conversión PandorasBoxOutput → AuditMetricRecord ─────────────────────────
function convertirASalida(output, config, fuente) {
    const tasaExito = output.total_transactions > 0
        ? (output.successful_transactions / output.total_transactions) * 100
        : 0;
    const deployExitoso = output.deploy_successful ?? config.modo === "EOA";
    const llamadasERCTotal = output.erc_function_calls ?? 0;
    const llamadasERCExitosas = output.erc_function_success ?? 0;
    return {
        id: (0, crypto_1.randomUUID)(),
        timestamp: new Date().toISOString(),
        modo: output.mode,
        rpcUrl: output.rpc_url,
        chainId: output.chain_id,
        contractAddress: output.contract_address ?? config.contractAddress,
        tpsPico: output.tps_peak,
        tpsPromedio: output.tps_average,
        totalTransacciones: output.total_transactions,
        transaccionesExitosas: output.successful_transactions,
        transaccionesFallidas: output.failed_transactions,
        tasaExito,
        latenciaPromedioMs: output.latency_avg_ms,
        latenciaMinMs: output.latency_min_ms,
        latenciaMaxMs: output.latency_max_ms,
        latenciaP95Ms: output.latency_p95_ms,
        blockTimePromedioSeg: output.block_time_avg_seconds,
        bloquesObservados: output.blocks_observed,
        gasUsadoPromedio: output.gas_used_avg,
        gasUsadoMax: output.gas_used_max,
        gasLimit: output.gas_limit,
        gasUtilizacionPct: output.gas_utilization_pct,
        transaccionesRevertidas: output.reverted_transactions,
        transaccionesOutOfGas: output.out_of_gas_transactions,
        tiempoRespuestaNodoMs: output.node_response_avg_ms,
        deployExitoso,
        llamadasERCExitosas,
        llamadasERCTotal,
        semaforoEficiencia: calcSemaforoEficiencia(output.tps_average, config),
        semaforoLatencia: calcSemaforoLatencia(output.latency_avg_ms, config),
        semaforoSeguridad: calcSemaforoSeguridad(tasaExito, config),
        semaforoInteroperabilidad: calcSemaforoInteroperabilidad(output.mode, deployExitoso, llamadasERCExitosas, llamadasERCTotal),
        blockSamples: output.block_samples,
        rawOutput: output,
        fuente
    };
}
// ─── API pública del servicio ─────────────────────────────────────────────────
function listarMetricas() {
    return cargarRegistros().sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}
function obtenerMetricaPorId(id) {
    return cargarRegistros().find((r) => r.id === id) ?? null;
}
async function ejecutarEvaluacion(config) {
    const { output, fuente, errorPandoras } = await (0, pandorasBoxAdapter_1.ejecutarPrueba)(config);
    const record = convertirASalida(output, config, fuente);
    const registros = cargarRegistros();
    registros.push(record);
    guardarRegistros(registros);
    return { record, fuente, errorPandoras };
}
function eliminarMetrica(id) {
    const registros = cargarRegistros();
    const idx = registros.findIndex((r) => r.id === id);
    if (idx === -1)
        return false;
    registros.splice(idx, 1);
    guardarRegistros(registros);
    return true;
}

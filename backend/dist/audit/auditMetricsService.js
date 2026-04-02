"use strict";
/**
 * Servicio de métricas de auditoría (RF10).
 * Persiste los registros en backend/data/audit-metrics.json.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.listarMetricas = listarMetricas;
exports.listarMetricasComparativas = listarMetricasComparativas;
exports.obtenerMetricaPorId = obtenerMetricaPorId;
exports.ejecutarEvaluacion = ejecutarEvaluacion;
exports.eliminarMetrica = eliminarMetrica;
const crypto_1 = require("crypto");
const jsonFileStore_1 = require("../shared/jsonFileStore");
const pandorasBoxAdapter_1 = require("./pandorasBoxAdapter");
const auditMetricModel_1 = require("./auditMetricModel");
const evaluacionSesionService_1 = require("./evaluacionSesionService");
const STORE_FILE = "audit-metrics.json";
const MODO_ORDER = {
    EOA: 0,
    ERC20: 1,
    ERC721: 2
};
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
/**
 * Calcula el semáforo de interoperabilidad EVM/HCE.
 *
 * Criterios (más informativos que "EOA siempre verde"):
 * - Verde   : nodo accesible + contrato accesible + lecturas y escrituras OK.
 * - Amarillo: nodo accesible pero contrato sin confirmar (EOA sin contrato o
 *             deploy fallido) O llamadas ERC con tasa < 95 %.
 * - Rojo    : nodo no accesible O deploy explícitamente fallido.
 */
function calcSemaforoInteroperabilidad(modo, deployExitoso, llamadasERCExitosas, llamadasERCTotal, nodoAccesible) {
    if (!nodoAccesible)
        return "rojo";
    if (modo === "EOA") {
        // EOA: no hay contrato; el nodo respondió → amarillo (accesible pero sin contrato)
        return "amarillo";
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
function buildInteroperabilityDetails(output, config, chainId) {
    const nodoAccesible = chainId > 0; // Si pudimos leer chainId, el nodo respondió
    const deployExitoso = output.deploy_successful ?? config.modo === "EOA";
    const llamadasERCTotal = output.erc_function_calls ?? 0;
    const llamadasERCExitosas = output.erc_function_success ?? 0;
    const writeCallsOk = output.successful_transactions > 0;
    const readCallsOk = nodoAccesible; // Siempre consultamos eth_chainId + eth_blockNumber
    let compatibilidadERC = config.modo;
    if (config.contractAddress) {
        compatibilidadERC = `${config.modo} (contrato: ${config.contractAddress.slice(0, 10)}…)`;
    }
    let nota;
    if (!nodoAccesible) {
        nota = "El nodo RPC no respondió; no fue posible verificar interoperabilidad.";
    }
    else if (config.modo === "EOA") {
        nota =
            "Modo EOA: se verificó que el nodo EVM responde (eth_chainId, eth_blockNumber) y que " +
                "las transferencias de valor se confirmaron. No se despliega contrato en este modo. " +
                "Para evaluar compatibilidad con InterHCELedger use modo ERC20/ERC721 con la dirección del contrato.";
    }
    else if (!deployExitoso) {
        nota = `Deploy del contrato ${config.modo} falló. Verificar fondos y configuración del mnemonic.`;
    }
    else {
        const tasa = llamadasERCTotal > 0
            ? `${((llamadasERCExitosas / llamadasERCTotal) * 100).toFixed(1)} %`
            : "sin llamadas ERC registradas";
        nota =
            `Compatibilidad ${config.modo}: deploy exitoso, llamadas ERC con tasa ${tasa}. ` +
                `Red: chain ${chainId} · RPC: ${config.rpcUrl.slice(0, 40)}…`;
    }
    return {
        chainId,
        rpcUrl: config.rpcUrl,
        nodoAccesible,
        contratoAccesible: config.modo !== "EOA" ? deployExitoso : false,
        readCallsOk,
        writeCallsOk,
        compatibilidadERC,
        nota
    };
}
// ─── Conversión PandorasBoxOutput → AuditMetricRecord ─────────────────────────
function convertirASalida(output, config, fuente, extras) {
    const tasaExito = output.total_transactions > 0
        ? (output.successful_transactions / output.total_transactions) * 100
        : 0;
    const deployExitoso = output.deploy_successful ?? config.modo === "EOA";
    const llamadasERCTotal = output.erc_function_calls ?? 0;
    const llamadasERCExitosas = output.erc_function_success ?? 0;
    const interopDetails = buildInteroperabilityDetails(output, config, output.chain_id);
    const sesionActual = (0, evaluacionSesionService_1.obtenerSesionActual)();
    return {
        id: (0, crypto_1.randomUUID)(),
        timestamp: new Date().toISOString(),
        sesionId: sesionActual?.id,
        batchId: extras?.batchId,
        modo: output.mode,
        rpcUrl: output.rpc_url,
        chainId: output.chain_id,
        contractAddress: output.contract_address ?? config.contractAddress,
        tpsPico: output.tps_peak,
        tpsPromedio: output.tps_average,
        totalTransacciones: extras?.totalTransacciones ?? output.total_transactions,
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
        interoperabilityDetails: interopDetails,
        semaforoEficiencia: calcSemaforoEficiencia(output.tps_average, config),
        semaforoLatencia: calcSemaforoLatencia(output.latency_avg_ms, config),
        semaforoSeguridad: calcSemaforoSeguridad(tasaExito, config),
        semaforoInteroperabilidad: calcSemaforoInteroperabilidad(output.mode, deployExitoso, llamadasERCExitosas, llamadasERCTotal, interopDetails.nodoAccesible),
        blockSamples: output.block_samples,
        rawOutput: output,
        fuente
    };
}
// ─── API pública del servicio ─────────────────────────────────────────────────
/**
 * Lista métricas de auditoría.
 *
 * @param opciones.sesionId — si se pasa, solo devuelve registros de esa sesión.
 * @param opciones.desde    — si se pasa, solo devuelve registros con timestamp >= este ISO string.
 */
function listarMetricas(opciones) {
    let registros = cargarRegistros();
    if (opciones?.sesionId) {
        registros = registros.filter((r) => r.sesionId === opciones.sesionId);
    }
    if (opciones?.desde) {
        const desdeMs = new Date(opciones.desde).getTime();
        registros = registros.filter((r) => new Date(r.timestamp).getTime() >= desdeMs);
    }
    return registros.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}
function listarMetricasComparativas() {
    return cargarRegistros()
        .filter((record) => record.batchId && typeof record.totalTransacciones === "number")
        .sort((a, b) => {
        const totalA = a.totalTransacciones ?? Number.MAX_SAFE_INTEGER;
        const totalB = b.totalTransacciones ?? Number.MAX_SAFE_INTEGER;
        if (totalA !== totalB)
            return totalA - totalB;
        const modoA = MODO_ORDER[a.modo] ?? Number.MAX_SAFE_INTEGER;
        const modoB = MODO_ORDER[b.modo] ?? Number.MAX_SAFE_INTEGER;
        if (modoA !== modoB)
            return modoA - modoB;
        return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    });
}
function obtenerMetricaPorId(id) {
    return cargarRegistros().find((r) => r.id === id) ?? null;
}
async function ejecutarEvaluacion(config, extras) {
    const { output, fuente, errorPandoras } = await (0, pandorasBoxAdapter_1.ejecutarPrueba)(config);
    const record = convertirASalida(output, config, fuente, extras);
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

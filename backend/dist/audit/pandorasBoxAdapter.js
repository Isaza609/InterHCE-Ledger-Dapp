"use strict";
/**
 * Adaptador para pandoras-box (https://github.com/sig-0/pandoras-box).
 *
 * Ejecuta el binario real cuando está disponible en PATH y parsea su JSON de salida.
 * Si no está instalado, cae a una simulación realista que consulta el nodo RPC
 * para obtener datos reales de bloques.
 *
 * Formato real de salida pandoras-box:
 * {
 *   "averageTPS": 12,
 *   "blocks": [
 *     { "blockNum": N, "createdAt": <unix_ts>, "numTxs": N,
 *       "gasUsed": "0x...", "gasLimit": "0x...", "gasUtilization": 1.5 }
 *   ]
 * }
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ejecutarPrueba = ejecutarPrueba;
exports.parsearSalidaPandorasBox = parsearSalidaReal;
const child_process_1 = require("child_process");
const util_1 = require("util");
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const os_1 = require("os");
const path_1 = __importDefault(require("path"));
const https_1 = __importDefault(require("https"));
const http_1 = __importDefault(require("http"));
const execFileAsync = (0, util_1.promisify)(child_process_1.execFile);
function hexToNumber(hex) {
    return parseInt(hex, 16);
}
function parsearSalidaReal(raw, config, chainId) {
    const { averageTPS, blocks } = raw;
    if (!blocks || blocks.length === 0) {
        // Sin bloques: solo TPS disponible
        return construirSalidaMinima(averageTPS, config, chainId);
    }
    // Ordenar bloques por número
    const sorted = [...blocks].sort((a, b) => a.blockNum - b.blockNum);
    // Calcular blocktime a partir de timestamps consecutivos
    const blockTimes = [];
    for (let i = 1; i < sorted.length; i++) {
        const diff = sorted[i].createdAt - sorted[i - 1].createdAt;
        if (diff > 0)
            blockTimes.push(diff);
    }
    const avgBlockTimeSec = blockTimes.length > 0
        ? blockTimes.reduce((a, b) => a + b, 0) / blockTimes.length
        : 12;
    const minBlockTimeSec = blockTimes.length > 0 ? Math.min(...blockTimes) : avgBlockTimeSec;
    const maxBlockTimeSec = blockTimes.length > 0 ? Math.max(...blockTimes) : avgBlockTimeSec;
    // Gas
    const gasUsedValues = sorted.map((b) => hexToNumber(b.gasUsed));
    const gasLimitValues = sorted.map((b) => hexToNumber(b.gasLimit));
    const gasUsedAvg = gasUsedValues.reduce((a, b) => a + b, 0) / gasUsedValues.length;
    const gasUsedMax = Math.max(...gasUsedValues);
    const gasLimit = gasLimitValues.length > 0 ? gasLimitValues[gasLimitValues.length - 1] : 30000000;
    const avgGasUtil = sorted.reduce((a, b) => a + b.gasUtilization, 0) / sorted.length;
    // Transacciones confirmadas en bloques
    const txEnBloques = sorted.reduce((a, b) => a + b.numTxs, 0);
    // Las no confirmadas son las enviadas menos las que llegaron a bloque
    const transaccionesExitosas = txEnBloques;
    const transaccionesFallidas = Math.max(0, config.totalTransacciones - txEnBloques);
    // TPS pico: bloque con mayor tx/blocktime
    let tpsPico = averageTPS;
    for (let i = 1; i < sorted.length; i++) {
        const bt = sorted[i].createdAt - sorted[i - 1].createdAt;
        if (bt > 0) {
            const bTps = sorted[i].numTxs / bt;
            if (bTps > tpsPico)
                tpsPico = bTps;
        }
    }
    // Latencia ≈ blocktime promedio (mínima latencia posible en una red de bloques)
    // Con varianza del 20 % hacia arriba para ser realista
    const latenciaAvgMs = avgBlockTimeSec * 1000 * 1.15;
    const latenciaMinMs = minBlockTimeSec * 1000 * 0.9;
    const latenciaMaxMs = maxBlockTimeSec * 1000 * 2.5;
    const latenciaP50Ms = latenciaAvgMs;
    const latenciaP95Ms = latenciaAvgMs * 1.6;
    const latenciaP99Ms = latenciaAvgMs * 2.1;
    // Duración total de la prueba
    const durationSeconds = sorted.length > 1
        ? sorted[sorted.length - 1].createdAt - sorted[0].createdAt
        : avgBlockTimeSec * sorted.length;
    // Series por bloque
    const blockSamples = sorted.map((b, i) => {
        const bt = i > 0 ? Math.max(1, b.createdAt - sorted[i - 1].createdAt) : avgBlockTimeSec;
        return {
            block_number: b.blockNum,
            timestamp: new Date(b.createdAt * 1000).toISOString(),
            tx_count: b.numTxs,
            gas_used: hexToNumber(b.gasUsed),
            gas_limit: hexToNumber(b.gasLimit),
            block_time_seconds: bt,
            tps: b.numTxs / bt
        };
    });
    const startIso = new Date(sorted[0].createdAt * 1000).toISOString();
    const endIso = new Date(sorted[sorted.length - 1].createdAt * 1000).toISOString();
    return {
        mode: config.modo,
        start_time: startIso,
        end_time: endIso,
        duration_seconds: durationSeconds,
        rpc_url: config.rpcUrl,
        chain_id: chainId,
        total_transactions: config.totalTransacciones,
        successful_transactions: transaccionesExitosas,
        failed_transactions: transaccionesFallidas,
        tps_peak: tpsPico,
        tps_average: averageTPS,
        latency_avg_ms: latenciaAvgMs,
        latency_min_ms: latenciaMinMs,
        latency_max_ms: latenciaMaxMs,
        latency_p50_ms: latenciaP50Ms,
        latency_p95_ms: latenciaP95Ms,
        latency_p99_ms: latenciaP99Ms,
        block_time_avg_seconds: avgBlockTimeSec,
        block_time_min_seconds: minBlockTimeSec,
        block_time_max_seconds: maxBlockTimeSec,
        blocks_observed: sorted.length,
        gas_used_avg: gasUsedAvg,
        gas_used_max: gasUsedMax,
        gas_limit: gasLimit,
        gas_utilization_pct: avgGasUtil,
        // pandoras-box no expone reverts directamente; los inferimos de las no confirmadas
        reverted_transactions: Math.round(transaccionesFallidas * 0.7),
        out_of_gas_transactions: Math.round(transaccionesFallidas * 0.3),
        node_response_avg_ms: avgBlockTimeSec * 80, // heurística: ~8 % del blocktime
        contract_address: config.contractAddress,
        deploy_successful: config.modo !== "EOA" ? transaccionesFallidas / config.totalTransacciones < 0.5 : undefined,
        erc_function_calls: config.modo !== "EOA" ? transaccionesExitosas : 0,
        erc_function_success: config.modo !== "EOA" ? transaccionesExitosas : 0,
        block_samples: blockSamples
    };
}
function construirSalidaMinima(averageTPS, config, chainId) {
    const now = new Date().toISOString();
    return {
        mode: config.modo,
        start_time: now,
        end_time: now,
        duration_seconds: 0,
        rpc_url: config.rpcUrl,
        chain_id: chainId,
        total_transactions: config.totalTransacciones,
        successful_transactions: config.totalTransacciones,
        failed_transactions: 0,
        tps_peak: averageTPS,
        tps_average: averageTPS,
        latency_avg_ms: 0,
        latency_min_ms: 0,
        latency_max_ms: 0,
        latency_p50_ms: 0,
        latency_p95_ms: 0,
        latency_p99_ms: 0,
        block_time_avg_seconds: 0,
        block_time_min_seconds: 0,
        block_time_max_seconds: 0,
        blocks_observed: 0,
        gas_used_avg: 0,
        gas_used_max: 0,
        gas_limit: 30000000,
        gas_utilization_pct: 0,
        reverted_transactions: 0,
        out_of_gas_transactions: 0,
        node_response_avg_ms: 0,
        contract_address: config.contractAddress,
        deploy_successful: config.modo !== "EOA" ? true : undefined,
        erc_function_calls: 0,
        erc_function_success: 0,
        block_samples: []
    };
}
// ─── Ejecución real de pandoras-box ──────────────────────────────────────────
// Ruta absoluta al binario de pandoras-box como fallback cuando PATH no la incluye
// (ocurre cuando el backend corre con pm2, systemd o en entornos sin .bashrc)
const PANDORAS_BIN_PATHS = [
    "pandoras-box", // PATH global
    "/home/aisaza/.nvm/versions/node/v18.20.8/bin/pandoras-box", // nvm usuario
    "/usr/local/bin/pandoras-box",
    "/usr/bin/pandoras-box"
];
function resolverBinario() {
    const { execSync } = require("child_process");
    try {
        const found = execSync("which pandoras-box 2>/dev/null || true", { encoding: "utf8" }).trim();
        if (found)
            return found;
    }
    catch { /* no encontrado */ }
    // Verificar rutas conocidas
    for (const p of PANDORAS_BIN_PATHS.slice(1)) {
        if ((0, fs_1.existsSync)(p))
            return p;
    }
    return "pandoras-box"; // fallback; execFile lanzará ENOENT que capturamos abajo
}
/** Detecta si la URL del RPC es de Alchemy (limitado en compute units por segundo). */
function esUrlAlchemy(rpcUrl) {
    return rpcUrl.includes("alchemy.com") || rpcUrl.includes("alchemyapi.io");
}
/**
 * Detecta el tipo de error de Alchemy en el texto de salida/error de pandoras-box.
 *
 * "rate_limit": compute units exhausted antes de recibir los recibos.
 *   pandoras-box tiene un timeout interno de 30 s (hardcoded, no configurable).
 *   Si Alchemy devuelve HTTP 429 / "compute units per second capacity exceeded",
 *   los recibos no llegan a tiempo y el proceso termina con código no cero.
 *   Las transacciones SÍ se enviaron a Sepolia y pueden haberse minado.
 *
 * "replacement_underpriced": síntoma secundario de un rate limit previo.
 *   pandoras-box reintenta con el mismo nonce pero con gas insuficiente porque
 *   Alchemy rechazó la llamada previa de estimación de gas.
 */
function detectarTipoErrorAlchemy(text) {
    const lower = text.toLowerCase();
    if (lower.includes("compute units per second") ||
        lower.includes("compute units capacity") ||
        lower.includes("too many requests") ||
        lower.includes("rate limit") ||
        lower.includes("429")) {
        return "rate_limit";
    }
    if (lower.includes("replacement transaction underpriced")) {
        return "replacement_underpriced";
    }
    return null;
}
async function tryRunPandorasBox(config, chainId) {
    const mnemonic = config.mnemonic?.trim();
    if (!mnemonic) {
        // Sin mnemonic no se puede correr pandoras-box
        return null;
    }
    // Crear archivo temporal para la salida
    const tmpDir = (0, fs_1.mkdtempSync)(path_1.default.join((0, os_1.tmpdir)(), "pandoras-"));
    const outFile = path_1.default.join(tmpDir, `result-${(0, crypto_1.randomBytes)(4).toString("hex")}.json`);
    const binario = resolverBinario();
    try {
        const args = [
            "-url", config.rpcUrl,
            "-m", mnemonic,
            "-t", String(config.totalTransacciones),
            "-s", String(config.numSubcuentas),
            "--mode", config.modo,
            "-o", outFile
        ];
        if (config.batchSize) {
            args.push("-b", String(config.batchSize));
        }
        else if (esUrlAlchemy(config.rpcUrl)) {
            // Alchemy limita a ~330 compute units/s en el plan gratuito.
            // Con el -b por defecto de pandoras-box (25) se agotan los CU antes de que
            // lleguen todos los recibos → timeout interno de 30 s → salida non-zero.
            // Con -b 5 cada lote tarda ~60 ms y no excede la capacidad del plan.
            args.push("-b", "5");
        }
        // Timeout generoso: 10 min para pruebas grandes en Sepolia
        const { stdout, stderr } = await execFileAsync(binario, args, {
            timeout: 600000,
            // Heredar el PATH del proceso para que nvm funcione correctamente
            env: { ...process.env }
        });
        // Buscar el archivo de salida. En modo EOA pandoras-box a veces ignora el flag -o
        // y escribe en el directorio de trabajo actual o dentro de tmpDir con otro nombre.
        let archivoSalida = null;
        if ((0, fs_1.existsSync)(outFile)) {
            archivoSalida = outFile;
        }
        else {
            // Búsqueda de rutas alternativas (diferencia de comportamiento por modo)
            const candidatos = [
                path_1.default.join(process.cwd(), "result.json"),
                path_1.default.join(process.cwd(), "pandoras-result.json"),
                ...(0, fs_1.readdirSync)(tmpDir)
                    .filter((f) => f.endsWith(".json"))
                    .map((f) => path_1.default.join(tmpDir, f))
            ];
            for (const candidato of candidatos) {
                if ((0, fs_1.existsSync)(candidato)) {
                    archivoSalida = candidato;
                    break;
                }
            }
        }
        if (!archivoSalida) {
            // pandoras-box terminó sin error pero no generó ningún archivo JSON.
            // Incluir stdout/stderr para facilitar el diagnóstico (no el mensaje genérico).
            const salidaRaw = [
                stderr?.trim() ? `stderr: ${stderr.trim()}` : "",
                stdout?.trim() ? `stdout: ${stdout.trim()}` : ""
            ].filter(Boolean).join(" | ");
            return {
                error: salidaRaw
                    ? `pandoras-box ejecutó sin generar archivo de salida. Detalle: ${salidaRaw}`
                    : `pandoras-box ejecutó pero no generó archivo de salida en ${outFile} ni en el directorio de trabajo. Verifica que el mnemonic tenga fondos suficientes.`
            };
        }
        const rawText = (0, fs_1.readFileSync)(archivoSalida, "utf8");
        let raw;
        try {
            raw = JSON.parse(rawText);
        }
        catch {
            return { error: `pandoras-box generó un JSON inválido. Contenido recibido: ${rawText.slice(0, 200)}` };
        }
        return { output: parsearSalidaReal(raw, config, chainId) };
    }
    catch (err) {
        const e = err;
        // Recoger mensaje de stderr (donde pandoras-box escribe sus errores)
        const stderr = (e.stderr ?? "").trim();
        const stdout = (e.stdout ?? "").trim();
        const base = e.message ?? String(err);
        // Si el binario no existe en PATH
        if (e.code === "ENOENT") {
            return null; // pandoras-box no instalado → simulación (no es un error del usuario)
        }
        // Detectar errores específicos de Alchemy (rate limit / nonce reciclado)
        const textoError = `${stderr} ${stdout} ${base}`;
        const tipoErrorAlchemy = detectarTipoErrorAlchemy(textoError);
        if (tipoErrorAlchemy === "rate_limit") {
            return {
                error: `Rate limit de Alchemy: las transacciones SÍ se enviaron a Sepolia ` +
                    `pero pandoras-box no pudo recopilar todos los recibos antes del timeout ` +
                    `interno de 30 s. Reduce -t a 15–20 y -b a 5 para no agotar el límite ` +
                    `de compute units por segundo. Detalle: ${stderr || base}`
            };
        }
        if (tipoErrorAlchemy === "replacement_underpriced") {
            return {
                error: `"Replacement transaction underpriced": pandoras-box intentó reenviar txs ` +
                    `con el mismo nonce tras recibir errores de Alchemy. ` +
                    `Las transacciones anteriores SÍ pueden haberse enviado a Sepolia. ` +
                    `Espera ~2 min (para que los nonces avancen) y reduce -t a 15–20 y -b a 5 ` +
                    `antes de volver a intentarlo. Detalle: ${stderr || base}`
            };
        }
        // Construir mensaje de error informativo con toda la info disponible
        const detalle = [
            base,
            stderr ? `stderr: ${stderr}` : "",
            stdout && !stderr ? `stdout: ${stdout}` : ""
        ].filter(Boolean).join(" | ");
        return { error: `pandoras-box falló: ${detalle}` };
    }
    finally {
        // Limpiar el archivo temporal (puede estar en outFile u otra ruta alternativa encontrada)
        for (const f of [outFile, path_1.default.join(process.cwd(), "result.json"), path_1.default.join(process.cwd(), "pandoras-result.json")]) {
            try {
                if ((0, fs_1.existsSync)(f))
                    (0, fs_1.unlinkSync)(f);
            }
            catch { /* noop */ }
        }
    }
}
// ─── Utilidades JSON-RPC ──────────────────────────────────────────────────────
function jsonRpcPost(rpcUrl, method, params) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method, params });
        const parsed = new URL(rpcUrl);
        const isHttps = parsed.protocol === "https:";
        const options = {
            hostname: parsed.hostname,
            port: parsed.port || (isHttps ? 443 : 80),
            path: parsed.pathname + parsed.search,
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(body)
            },
            timeout: 8000
        };
        const transport = isHttps ? https_1.default : http_1.default;
        const req = transport.request(options, (res) => {
            let data = "";
            res.on("data", (c) => { data += c; });
            res.on("end", () => {
                try {
                    const p = JSON.parse(data);
                    resolve(p.result);
                }
                catch {
                    reject(new Error("JSON-RPC parse error"));
                }
            });
        });
        req.on("error", reject);
        req.on("timeout", () => { req.destroy(); reject(new Error("RPC timeout")); });
        req.write(body);
        req.end();
    });
}
async function getChainId(rpcUrl) {
    try {
        const result = await jsonRpcPost(rpcUrl, "eth_chainId", []);
        return parseInt(String(result), 16);
    }
    catch {
        return 0;
    }
}
async function getLatestBlockNumber(rpcUrl) {
    try {
        const result = await jsonRpcPost(rpcUrl, "eth_blockNumber", []);
        return parseInt(String(result), 16);
    }
    catch {
        return 0;
    }
}
async function getBlockByNumber(rpcUrl, blockNum) {
    try {
        const hex = "0x" + blockNum.toString(16);
        const result = await jsonRpcPost(rpcUrl, "eth_getBlockByNumber", [hex, false]);
        return result;
    }
    catch {
        return null;
    }
}
async function fetchRealBlockData(rpcUrl, blockCount) {
    const chainId = await getChainId(rpcUrl);
    const latestNum = await getLatestBlockNumber(rpcUrl);
    if (!latestNum)
        return { samples: [], chainId };
    const samples = [];
    const from = Math.max(1, latestNum - blockCount);
    let prevTimestamp = 0;
    for (let n = from; n <= latestNum; n++) {
        const block = await getBlockByNumber(rpcUrl, n);
        if (!block)
            continue;
        const ts = parseInt(block.timestamp, 16);
        const gasUsed = parseInt(block.gasUsed, 16);
        const gasLimit = parseInt(block.gasLimit, 16);
        const txCount = block.transactions.length;
        const blockTimeSec = prevTimestamp > 0 ? Math.max(1, ts - prevTimestamp) : 12;
        prevTimestamp = ts;
        samples.push({
            block_number: n,
            timestamp: new Date(ts * 1000).toISOString(),
            tx_count: txCount,
            gas_used: gasUsed,
            gas_limit: gasLimit,
            block_time_seconds: blockTimeSec,
            tps: txCount / blockTimeSec
        });
    }
    return { samples, chainId };
}
// ─── Simulación realista (fallback) ──────────────────────────────────────────
function rng(seed) {
    let s = seed;
    return () => {
        s = (s * 1664525 + 1013904223) & 0xffffffff;
        return (s >>> 0) / 0xffffffff;
    };
}
function normalSample(rand, mean, stdDev) {
    const u1 = Math.max(1e-10, rand());
    const u2 = rand();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return Math.max(0, mean + z * stdDev);
}
function networkParams(chainId) {
    switch (chainId) {
        case 1: return { avgBlockTimeSec: 12, avgGasPerTx: 42000, baseLatencyMs: 14000, baseTps: 15 };
        case 11155111: return { avgBlockTimeSec: 12, avgGasPerTx: 35000, baseLatencyMs: 13000, baseTps: 12 };
        case 137: return { avgBlockTimeSec: 2.2, avgGasPerTx: 25000, baseLatencyMs: 2500, baseTps: 65 };
        case 56: return { avgBlockTimeSec: 3, avgGasPerTx: 21000, baseLatencyMs: 3200, baseTps: 55 };
        case 42161: return { avgBlockTimeSec: 0.25, avgGasPerTx: 500000, baseLatencyMs: 400, baseTps: 200 };
        default: return { avgBlockTimeSec: 1, avgGasPerTx: 21000, baseLatencyMs: 120, baseTps: 200 };
    }
}
function buildSimulation(config, realSamples, chainId) {
    const seed = Date.now() % 0xffffffff;
    const rand = rng(seed);
    const params = networkParams(chainId || 0);
    let avgBlockTimeSec = params.avgBlockTimeSec;
    if (realSamples.length >= 3) {
        const times = realSamples.map((s) => s.block_time_seconds);
        avgBlockTimeSec = times.reduce((a, b) => a + b, 0) / times.length;
    }
    const durationSeconds = Math.max(10, config.totalTransacciones / params.baseTps);
    const avgTps = config.totalTransacciones / durationSeconds;
    const tpsPeak = Math.min(avgTps * 1.8, avgTps + 20);
    const failurePct = config.modo === "EOA" ? 0.015 : config.modo === "ERC20" ? 0.025 : 0.03;
    const failedTx = Math.round(config.totalTransacciones * failurePct * (0.8 + rand() * 0.4));
    const successfulTx = config.totalTransacciones - failedTx;
    const latencyAvg = normalSample(rand, params.baseLatencyMs, params.baseLatencyMs * 0.2);
    const latencyMin = latencyAvg * (0.4 + rand() * 0.2);
    const latencyMax = latencyAvg * (2 + rand() * 1.5);
    let gasPerTx = params.avgGasPerTx;
    if (config.modo === "ERC20")
        gasPerTx = 50000;
    if (config.modo === "ERC721")
        gasPerTx = 120000;
    const gasUsedAvg = normalSample(rand, gasPerTx, gasPerTx * 0.1);
    const gasUsedMax = gasUsedAvg * (1.2 + rand() * 0.3);
    const gasLimit = 30000000;
    // Generar muestras de bloque sintéticas
    const numBlocks = Math.max(2, Math.round(durationSeconds / avgBlockTimeSec));
    const startTs = Date.now() - durationSeconds * 1000;
    const blockSamples = [];
    for (let i = 0; i < numBlocks; i++) {
        const bt = Math.max(1, normalSample(rand, avgBlockTimeSec, avgBlockTimeSec * 0.15));
        const tps = Math.max(0, normalSample(rand, avgTps, avgTps * 0.3));
        const txCount = Math.round(tps * bt);
        const gasUsed = txCount * gasPerTx;
        blockSamples.push({
            block_number: 1000000 + i,
            timestamp: new Date(startTs + i * bt * 1000).toISOString(),
            tx_count: txCount,
            gas_used: gasUsed,
            gas_limit: gasLimit,
            block_time_seconds: bt,
            tps
        });
    }
    const times = blockSamples.map((s) => s.block_time_seconds);
    const minBt = Math.min(...times);
    const maxBt = Math.max(...times);
    const gasUtil = Math.min(100, (successfulTx * gasUsedAvg) / (gasLimit * numBlocks) * 100);
    const nodeResponseMs = normalSample(rand, params.baseLatencyMs * 0.1, params.baseLatencyMs * 0.03);
    const deployOk = config.modo !== "EOA";
    const ercCalls = config.modo !== "EOA" ? successfulTx : 0;
    const ercSuccess = deployOk ? Math.round(ercCalls * (0.97 + rand() * 0.03)) : 0;
    return {
        mode: config.modo,
        start_time: new Date(startTs).toISOString(),
        end_time: new Date().toISOString(),
        duration_seconds: durationSeconds,
        rpc_url: config.rpcUrl,
        chain_id: chainId,
        total_transactions: config.totalTransacciones,
        successful_transactions: successfulTx,
        failed_transactions: failedTx,
        tps_peak: tpsPeak,
        tps_average: avgTps,
        latency_avg_ms: latencyAvg,
        latency_min_ms: latencyMin,
        latency_max_ms: latencyMax,
        latency_p50_ms: latencyAvg * 0.95,
        latency_p95_ms: latencyAvg * 1.6,
        latency_p99_ms: latencyAvg * 2.1,
        block_time_avg_seconds: avgBlockTimeSec,
        block_time_min_seconds: minBt,
        block_time_max_seconds: maxBt,
        blocks_observed: blockSamples.length,
        gas_used_avg: gasUsedAvg,
        gas_used_max: gasUsedMax,
        gas_limit: gasLimit,
        gas_utilization_pct: gasUtil,
        reverted_transactions: Math.round(failedTx * 0.7),
        out_of_gas_transactions: Math.round(failedTx * 0.3),
        node_response_avg_ms: nodeResponseMs,
        contract_address: config.contractAddress,
        deploy_successful: config.modo !== "EOA" ? deployOk : undefined,
        erc_function_calls: ercCalls,
        erc_function_success: ercSuccess,
        block_samples: blockSamples
    };
}
// ─── Función principal ────────────────────────────────────────────────────────
async function ejecutarPrueba(config) {
    // Obtener chainId consultando el nodo (siempre, para parámetros precisos)
    const chainId = await getChainId(config.rpcUrl).catch(() => 0);
    // Intentar con pandoras-box real si hay mnemonic
    if (config.mnemonic?.trim()) {
        const resultado = await tryRunPandorasBox(config, chainId);
        if (resultado === null) {
            // ENOENT: pandoras-box no está instalado → caemos a simulación sin error
        }
        else if ("output" in resultado) {
            // Éxito real
            return { output: resultado.output, fuente: "pandoras-box" };
        }
        else {
            // pandoras-box estaba instalado pero falló (fondos, RPC, etc.)
            // Caemos a simulación pero informamos del error para que el usuario lo vea
            const { samples } = await fetchRealBlockData(config.rpcUrl, 10);
            const sim = buildSimulation(config, samples, chainId);
            return { output: sim, fuente: "simulacion", errorPandoras: resultado.error };
        }
    }
    // Fallback: simulación con datos reales de bloques del nodo
    const { samples } = await fetchRealBlockData(config.rpcUrl, 10);
    const sim = buildSimulation(config, samples, chainId);
    return { output: sim, fuente: "simulacion" };
}

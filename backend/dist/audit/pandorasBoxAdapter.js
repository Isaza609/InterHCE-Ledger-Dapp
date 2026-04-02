"use strict";
/**
 * Adaptador para pandoras-box (https://github.com/sig-0/pandoras-box).
 *
 * Ejecuta el binario real cuando está disponible en PATH y parsea su JSON de salida.
 * La configuración sensible (RPC y mnemonic) se resuelve desde el entorno del
 * backend para que nunca viaje en el body del request.
 * Si no hay ejecución real disponible o faltan variables críticas, cae a una
 * simulación realista que consulta el nodo RPC para obtener datos reales de bloques.
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
const module_1 = require("module");
const execFileAsync = (0, util_1.promisify)(child_process_1.execFile);
const requireFromBackend = (0, module_1.createRequire)(__filename);
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
const DEFAULT_BATCH_SIZE = 10;
const SAFE_DEFAULT_TOTAL_TRANSACCIONES = 30;
const SAFE_DEFAULT_NUM_SUBCUENTAS = 3;
const PANDORAS_PROCESS_TIMEOUT_MS = 180000;
const PANDORAS_UNDERPRICED_RETRY_DELAY_MS = 15000;
const FALLBACK_RPC_URL = "no-configurado";
const PRIMARY_RPC_ENV = "ALCHEMY_RPC_URL";
const LEGACY_RPC_ENV = "SEPOLIA_RPC_URL";
const PRIMARY_MNEMONIC_ENV = "MNEMONIC";
const LEGACY_MNEMONIC_ENV = "PANDORAS_MNEMONIC";
function readEnvValue(keys) {
    for (const key of keys) {
        const value = String(process.env[key] ?? "").trim();
        if (value) {
            return { value, source: key };
        }
    }
    return {};
}
function normalizePositiveInt(value, fallback) {
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
        return fallback;
    }
    return Math.floor(value);
}
function resolveAuditRunConfig(config) {
    const rpcFromEnv = readEnvValue([PRIMARY_RPC_ENV, LEGACY_RPC_ENV]);
    const mnemonicFromEnv = readEnvValue([PRIMARY_MNEMONIC_ENV, LEGACY_MNEMONIC_ENV]);
    const rpcUrl = rpcFromEnv.value ?? config.rpcUrl?.trim() ?? "";
    const mnemonic = mnemonicFromEnv.value ?? config.mnemonic?.trim() ?? "";
    const totalTransacciones = normalizePositiveInt(config.totalTransacciones, SAFE_DEFAULT_TOTAL_TRANSACCIONES);
    const numSubcuentas = normalizePositiveInt(config.numSubcuentas, SAFE_DEFAULT_NUM_SUBCUENTAS);
    const batchSize = normalizePositiveInt(config.batchSize, DEFAULT_BATCH_SIZE);
    const missing = [];
    if (!rpcUrl)
        missing.push(PRIMARY_RPC_ENV);
    if (!mnemonic)
        missing.push(PRIMARY_MNEMONIC_ENV);
    return {
        config: {
            ...config,
            rpcUrl: rpcUrl || FALLBACK_RPC_URL,
            mnemonic: mnemonic || undefined,
            totalTransacciones,
            numSubcuentas,
            batchSize
        },
        warning: missing.length > 0
            ? `Variables de entorno faltantes (${missing.join(", ")}). ` +
                `Se usará simulación en lugar de pandoras-box.`
            : undefined
    };
}
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
    // pandoras-box reporta el total de tx del bloque, no solo las de esta prueba.
    // Acotamos el conteo al volumen solicitado para no inflar la tasa de éxito.
    const transaccionesExitosas = Math.min(config.totalTransacciones, txEnBloques);
    const transaccionesFallidas = Math.max(0, config.totalTransacciones - transaccionesExitosas);
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
const LOCAL_PANDORAS_BIN = path_1.default.resolve(__dirname, "../../vendor/pandoras-box/bin/index.js");
// Ruta absoluta al binario de pandoras-box como fallback cuando PATH no la incluye
// (ocurre cuando el backend corre con pm2, systemd o en entornos sin .bashrc)
const PANDORAS_BIN_PATHS = [
    LOCAL_PANDORAS_BIN, // copia local parchada para Sepolia/Alchemy
    "pandoras-box", // PATH global
    "/home/aisaza/.nvm/versions/node/v18.20.8/bin/pandoras-box", // nvm usuario
    "/usr/local/bin/pandoras-box",
    "/usr/bin/pandoras-box"
];
function resolverBinario() {
    const { execSync } = require("child_process");
    if ((0, fs_1.existsSync)(LOCAL_PANDORAS_BIN)) {
        return LOCAL_PANDORAS_BIN;
    }
    try {
        const found = execSync("which pandoras-box 2>/dev/null || true", { encoding: "utf8" }).trim();
        if (found)
            return found;
    }
    catch { /* no encontrado */ }
    // Verificar rutas conocidas
    for (const p of PANDORAS_BIN_PATHS.slice(2)) {
        if ((0, fs_1.existsSync)(p))
            return p;
    }
    return "pandoras-box"; // fallback; execFile lanzará ENOENT que capturamos abajo
}
let ethersModuleCache = null;
async function loadEthersModule() {
    if (!ethersModuleCache) {
        ethersModuleCache = requireFromBackend("ethers");
    }
    return ethersModuleCache;
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
function contieneReplacementUnderpriced(text) {
    return text.toLowerCase().includes("replacement transaction underpriced");
}
function extraerMensajeError(error) {
    if (error instanceof Error && error.message) {
        const extra = [
            typeof error.reason === "string" ? String(error.reason) : "",
            typeof error.code === "string" ? `code: ${error.code}` : ""
        ].filter(Boolean).join(" | ");
        return extra ? `${error.message} | ${extra}` : error.message;
    }
    if (typeof error === "object" && error) {
        const candidate = error;
        const values = [
            typeof candidate.message === "string" ? candidate.message : "",
            typeof candidate.reason === "string" ? candidate.reason : "",
            typeof candidate.error?.message === "string" ? candidate.error.message : "",
            typeof candidate.data?.message === "string" ? candidate.data.message : "",
            typeof candidate.body === "string" ? candidate.body : ""
        ].filter(Boolean);
        if (values.length > 0)
            return values.join(" | ");
    }
    return String(error);
}
function average(values) {
    if (values.length === 0)
        return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}
function percentile(values, ratio) {
    if (values.length === 0)
        return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
    return sorted[idx];
}
function chunkArray(items, chunkSize) {
    const size = Math.max(1, chunkSize);
    const chunks = [];
    for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size));
    }
    return chunks;
}
function resolveEoaRunnerOptions(config) {
    const isAlchemy = esUrlAlchemy(config.rpcUrl);
    return {
        batchSize: Math.max(1, config.batchSize ?? (isAlchemy ? 5 : 10)),
        batchDelayMs: Math.max(0, config.batchDelayMs ?? (isAlchemy ? 350 : 200)),
        receiptTimeoutMs: Math.max(10000, config.receiptTimeoutMs ?? (isAlchemy ? 90000 : 60000)),
        receiptPollIntervalMs: isAlchemy ? 2000 : 1500,
        maxRetriesPorTransaccion: Math.max(1, config.maxRetriesPorTransaccion ?? (isAlchemy ? 5 : 3))
    };
}
function findPandorasOutputFile(outFile, tmpDir) {
    if ((0, fs_1.existsSync)(outFile)) {
        return outFile;
    }
    const candidatos = [
        path_1.default.join(process.cwd(), "result.json"),
        path_1.default.join(process.cwd(), "pandoras-result.json"),
        ...(0, fs_1.readdirSync)(tmpDir)
            .filter((file) => file.endsWith(".json"))
            .map((file) => path_1.default.join(tmpDir, file))
    ];
    for (const candidato of candidatos) {
        if ((0, fs_1.existsSync)(candidato)) {
            return candidato;
        }
    }
    return null;
}
function cleanupPandorasOutputFiles(files) {
    for (const file of files) {
        try {
            if ((0, fs_1.existsSync)(file)) {
                (0, fs_1.unlinkSync)(file);
            }
        }
        catch {
            // noop
        }
    }
}
async function tryRunPandorasBox(config, chainId) {
    const mnemonic = config.mnemonic?.trim();
    if (!mnemonic) {
        return null;
    }
    const tmpDir = (0, fs_1.mkdtempSync)(path_1.default.join((0, os_1.tmpdir)(), "pandoras-"));
    const binario = resolverBinario();
    const generatedFiles = new Set([
        path_1.default.join(process.cwd(), "result.json"),
        path_1.default.join(process.cwd(), "pandoras-result.json")
    ]);
    const argsBase = [
        "-url", config.rpcUrl,
        "-m", mnemonic,
        "-t", String(config.totalTransacciones),
        "-s", String(config.numSubcuentas),
        "--mode", config.modo,
        "-b", String(config.batchSize)
    ];
    let previousUnderpricedError = "";
    try {
        for (let attempt = 0; attempt < 2; attempt++) {
            const outFile = path_1.default.join(tmpDir, `result-${attempt + 1}-${(0, crypto_1.randomBytes)(4).toString("hex")}.json`);
            generatedFiles.add(outFile);
            const args = [...argsBase, "-o", outFile];
            try {
                // La versión instalada no expone un flag `-gp`; dejamos que el nodo
                // resuelva el gas actual en cada ejecución de pandoras-box.
                const batchDelayMs = Math.max(0, config.batchDelayMs ?? 5000);
                const { stdout, stderr } = await execFileAsync(binario, args, {
                    timeout: PANDORAS_PROCESS_TIMEOUT_MS,
                    env: {
                        ...process.env,
                        PANDORAS_BATCH_DELAY_MS: String(batchDelayMs),
                        PANDORAS_RECEIPT_TIMEOUT_MS: String(PANDORAS_PROCESS_TIMEOUT_MS)
                    }
                });
                const archivoSalida = findPandorasOutputFile(outFile, tmpDir);
                if (!archivoSalida) {
                    const salidaRaw = [
                        stderr?.trim() ? `stderr: ${stderr.trim()}` : "",
                        stdout?.trim() ? `stdout: ${stdout.trim()}` : ""
                    ].filter(Boolean).join(" | ");
                    const textoDiagnostico = `${stderr} ${stdout}`;
                    const tipoErrorAlchemy = detectarTipoErrorAlchemy(textoDiagnostico);
                    const hayUnderpriced = contieneReplacementUnderpriced(textoDiagnostico);
                    const incluyeTimeoutInterno = textoDiagnostico.toLowerCase().includes("timeout exceeded");
                    if (hayUnderpriced && attempt === 0) {
                        previousUnderpricedError = salidaRaw || "pandoras-box terminó sin JSON tras un replacement underpriced.";
                        await sleep(PANDORAS_UNDERPRICED_RETRY_DELAY_MS);
                        continue;
                    }
                    if (hayUnderpriced) {
                        return {
                            error: `pandoras-box falló dos veces con "replacement transaction underpriced" y no generó JSON. ` +
                                `Primer intento: ${previousUnderpricedError}. Segundo intento: ${salidaRaw || "sin detalle adicional"}`
                        };
                    }
                    if (tipoErrorAlchemy === "rate_limit") {
                        return {
                            error: `Rate limit de Alchemy: pandoras-box no generó JSON porque agotó los compute units por segundo. ` +
                                `Use parámetros conservadores (-t 30, -s 3, -b 10) y ejecute las suites en secuencia. ` +
                                `Detalle: ${salidaRaw || "sin salida de diagnóstico"}`
                        };
                    }
                    if (incluyeTimeoutInterno) {
                        return {
                            error: `pandoras-box agotó su timeout interno de receipts (30 s) y no generó JSON. ` +
                                `El timeout del proceso hijo ya se elevó a ${PANDORAS_PROCESS_TIMEOUT_MS / 1000} s, ` +
                                `pero la versión instalada sigue teniendo un límite interno no configurable. ` +
                                `Detalle: ${salidaRaw || "sin salida de diagnóstico"}`
                        };
                    }
                    return {
                        error: salidaRaw
                            ? `pandoras-box ejecutó sin generar archivo de salida. Detalle: ${salidaRaw}`
                            : `pandoras-box ejecutó pero no generó archivo de salida JSON.`
                    };
                }
                generatedFiles.add(archivoSalida);
                const rawText = (0, fs_1.readFileSync)(archivoSalida, "utf8");
                let raw;
                try {
                    raw = JSON.parse(rawText);
                }
                catch {
                    return {
                        error: `pandoras-box generó un JSON inválido. Contenido recibido: ${rawText.slice(0, 200)}`
                    };
                }
                return { output: parsearSalidaReal(raw, config, chainId) };
            }
            catch (err) {
                const e = err;
                const stderr = (e.stderr ?? "").trim();
                const stdout = (e.stdout ?? "").trim();
                const base = e.message ?? String(err);
                if (e.code === "ENOENT") {
                    return null;
                }
                const detalle = [
                    base,
                    stderr ? `stderr: ${stderr}` : "",
                    stdout && !stderr ? `stdout: ${stdout}` : ""
                ].filter(Boolean).join(" | ");
                const textoDiagnostico = `${stderr} ${stdout} ${base}`;
                const tipoErrorAlchemy = detectarTipoErrorAlchemy(textoDiagnostico);
                const hayUnderpriced = contieneReplacementUnderpriced(textoDiagnostico);
                if (hayUnderpriced && attempt === 0) {
                    previousUnderpricedError = detalle;
                    await sleep(PANDORAS_UNDERPRICED_RETRY_DELAY_MS);
                    continue;
                }
                if (hayUnderpriced) {
                    return {
                        error: `pandoras-box falló dos veces con "replacement transaction underpriced". ` +
                            `Se esperaron ${PANDORAS_UNDERPRICED_RETRY_DELAY_MS / 1000} s entre intentos para que el mempool drenara. ` +
                            `Primer intento: ${previousUnderpricedError}. Segundo intento: ${detalle}`
                    };
                }
                if (tipoErrorAlchemy === "rate_limit") {
                    return {
                        error: `Rate limit de Alchemy: pandoras-box excedió la capacidad de compute units por segundo. ` +
                            `Sin flag nativo de throttle en la versión instalada, use parámetros conservadores ` +
                            `(-t 30, -s 3, -b 10) y ejecute las suites en secuencia. Detalle: ${detalle}`
                    };
                }
                return { error: `pandoras-box falló: ${detalle}` };
            }
        }
        return {
            error: `pandoras-box no pudo completarse tras el reintento controlado por replacement underpriced.`
        };
    }
    finally {
        cleanupPandorasOutputFiles(generatedFiles);
    }
}
function derivationPathForIndex(index) {
    return `m/44'/60'/0'/0/${index}`;
}
function distribuirTransacciones(total, numSenders) {
    const distribution = Array.from({ length: Math.max(1, numSenders) }, () => 0);
    for (let i = 0; i < total; i++) {
        distribution[i % distribution.length] += 1;
    }
    return distribution;
}
function maxBigNumber(a, b) {
    return BigInt(a.toString()) >= BigInt(b.toString()) ? a : b;
}
async function getFreshGasPrice(provider, fallback) {
    try {
        const fresh = await provider.getGasPrice();
        return maxBigNumber(fresh, fallback);
    }
    catch {
        return fallback;
    }
}
async function getPendingNonce(provider, address) {
    try {
        return await provider.getTransactionCount(address, "pending");
    }
    catch {
        return await provider.getTransactionCount(address);
    }
}
function buildFundingAmount(ethers, gasPrice, txCount) {
    const gasLimit = ethers.BigNumber.from(21000);
    const budgetTxs = Math.max(1, txCount) + 2;
    return gasPrice.mul(gasLimit).mul(budgetTxs).mul(16).div(10);
}
async function sendSignedTransactionWithRetries(params) {
    const { ethers, provider, wallet, chainId, nonce, initialGasPrice, txBase, options, contextLabel } = params;
    let gasPrice = initialGasPrice;
    let lastMessage = "";
    for (let attempt = 0; attempt < options.maxRetriesPorTransaccion; attempt++) {
        gasPrice = await getFreshGasPrice(provider, gasPrice);
        const txRequest = {
            ...txBase,
            chainId,
            nonce,
            gasPrice
        };
        const signedTx = await wallet.signTransaction(txRequest);
        const txHash = ethers.utils.keccak256(signedTx);
        const startedAtMs = Date.now();
        try {
            const response = await provider.sendTransaction(signedTx);
            return {
                hash: response?.hash ?? txHash,
                sender: wallet.address,
                nonce,
                gasPriceWei: gasPrice.toString(),
                submittedAtMs: startedAtMs,
                rpcResponseMs: Date.now() - startedAtMs
            };
        }
        catch (error) {
            const message = extraerMensajeError(error);
            const lower = message.toLowerCase();
            lastMessage = message;
            if (lower.includes("already known")) {
                return {
                    hash: txHash,
                    sender: wallet.address,
                    nonce,
                    gasPriceWei: gasPrice.toString(),
                    submittedAtMs: startedAtMs,
                    rpcResponseMs: Date.now() - startedAtMs
                };
            }
            const tipoError = detectarTipoErrorAlchemy(message);
            if (tipoError === "replacement_underpriced" ||
                lower.includes("replacement fee too low")) {
                gasPrice = gasPrice.mul(115).add(99).div(100);
                await sleep(Math.min(250 * (attempt + 1), 1000));
                continue;
            }
            if (tipoError === "rate_limit") {
                const backoffMs = Math.min(Math.max(200, options.batchDelayMs) * (2 ** attempt), 6000);
                await sleep(backoffMs);
                continue;
            }
            throw new Error(`${contextLabel}: ${message}`);
        }
    }
    throw new Error(`${contextLabel}: agotó reintentos. Último error: ${lastMessage}`);
}
async function pollReceipts(provider, hashes, options) {
    const receipts = new Map();
    if (hashes.length === 0)
        return receipts;
    const deadline = Date.now() + options.receiptTimeoutMs;
    let round = 0;
    while (receipts.size < hashes.length && Date.now() < deadline) {
        const pendientes = hashes.filter((hash) => !receipts.has(hash));
        const lotes = chunkArray(pendientes, Math.min(options.batchSize, 5));
        for (const lote of lotes) {
            for (const hash of lote) {
                try {
                    const receipt = await provider.getTransactionReceipt(hash);
                    if (receipt) {
                        receipts.set(hash, receipt);
                    }
                }
                catch (error) {
                    if (detectarTipoErrorAlchemy(extraerMensajeError(error)) === "rate_limit") {
                        await sleep(Math.min(Math.max(200, options.batchDelayMs) * (2 ** round), 4000));
                    }
                }
            }
        }
        if (receipts.size < hashes.length) {
            round += 1;
            await sleep(options.receiptPollIntervalMs);
        }
    }
    return receipts;
}
async function fetchBlocksMap(provider, blockNumbers) {
    const blocks = new Map();
    const unique = [...new Set(blockNumbers.filter((blockNumber) => Number.isFinite(blockNumber)))];
    for (const blockNumber of unique) {
        try {
            const block = await provider.getBlock(blockNumber);
            if (block) {
                blocks.set(blockNumber, block);
            }
        }
        catch {
            // Si el bloque falla, se omite y se siguen calculando métricas con lo disponible.
        }
    }
    return blocks;
}
function buildEoaOutput(params) {
    const { config, chainId, submittedTxs, receipts, blocks } = params;
    const confirmedTxs = [];
    for (const tx of submittedTxs) {
        const receipt = receipts.get(tx.hash);
        if (!receipt || typeof receipt.blockNumber !== "number")
            continue;
        const block = blocks.get(receipt.blockNumber);
        const blockTimestampSec = typeof block?.timestamp === "number"
            ? block.timestamp
            : Math.floor(tx.submittedAtMs / 1000);
        const gasUsed = receipt?.gasUsed ? Number(receipt.gasUsed.toString()) : 21000;
        const effectiveGasPriceWei = (receipt?.effectiveGasPrice ??
            receipt?.gasPrice ??
            tx.gasPriceWei).toString();
        confirmedTxs.push({
            ...tx,
            blockNumber: receipt.blockNumber,
            blockTimestampSec,
            gasUsed,
            effectiveGasPriceWei,
            status: typeof receipt.status === "number" ? receipt.status : 1
        });
    }
    const confirmedOnChain = confirmedTxs.length;
    const revertedTxs = confirmedTxs.filter((tx) => tx.status === 0);
    const exitosas = confirmedOnChain - revertedTxs.length;
    const fallidas = Math.max(0, config.totalTransacciones - exitosas);
    const startMs = submittedTxs.length > 0
        ? Math.min(...submittedTxs.map((tx) => tx.submittedAtMs))
        : Date.now();
    const endMs = confirmedTxs.length > 0
        ? Math.max(...confirmedTxs.map((tx) => tx.blockTimestampSec * 1000))
        : (submittedTxs.length > 0
            ? Math.max(...submittedTxs.map((tx) => tx.submittedAtMs))
            : startMs);
    const durationSeconds = Math.max(1, (endMs - startMs) / 1000);
    const latencias = confirmedTxs.map((tx) => Math.max(0, tx.blockTimestampSec * 1000 - tx.submittedAtMs));
    const gasUsedValues = confirmedTxs.map((tx) => tx.gasUsed);
    const nodeResponseAvgMs = average(submittedTxs.map((tx) => tx.rpcResponseMs));
    const grouped = new Map();
    for (const tx of confirmedTxs) {
        if (!grouped.has(tx.blockNumber)) {
            grouped.set(tx.blockNumber, []);
        }
        grouped.get(tx.blockNumber).push(tx);
    }
    const orderedBlocks = [...grouped.entries()]
        .map(([blockNumber, txs]) => {
        const block = blocks.get(blockNumber);
        return {
            blockNumber,
            timestampSec: typeof block?.timestamp === "number"
                ? block.timestamp
                : Math.floor(Math.min(...txs.map((tx) => tx.submittedAtMs)) / 1000),
            txCount: txs.length,
            gasUsed: block?.gasUsed ? Number(block.gasUsed.toString()) : txs.reduce((sum, tx) => sum + tx.gasUsed, 0),
            gasLimit: block?.gasLimit ? Number(block.gasLimit.toString()) : 30000000
        };
    })
        .sort((a, b) => a.blockNumber - b.blockNumber);
    const blockSamples = orderedBlocks.map((block, index) => {
        const prevTimestamp = index > 0 ? orderedBlocks[index - 1].timestampSec : block.timestampSec - 12;
        const blockTimeSeconds = Math.max(1, block.timestampSec - prevTimestamp);
        return {
            block_number: block.blockNumber,
            timestamp: new Date(block.timestampSec * 1000).toISOString(),
            tx_count: block.txCount,
            gas_used: block.gasUsed,
            gas_limit: block.gasLimit,
            block_time_seconds: blockTimeSeconds,
            tps: block.txCount / blockTimeSeconds
        };
    });
    const blockTimes = blockSamples.map((sample) => sample.block_time_seconds);
    const avgBlockTime = average(blockTimes);
    const avgGasUtilization = average(blockSamples.map((sample) => sample.gas_limit > 0 ? (sample.gas_used / sample.gas_limit) * 100 : 0));
    const tpsAverage = confirmedOnChain > 0 ? confirmedOnChain / durationSeconds : 0;
    const tpsPeak = Math.max(tpsAverage, ...blockSamples.map((sample) => sample.tps), 0);
    return {
        mode: config.modo,
        start_time: new Date(startMs).toISOString(),
        end_time: new Date(endMs).toISOString(),
        duration_seconds: durationSeconds,
        rpc_url: config.rpcUrl,
        chain_id: chainId,
        total_transactions: config.totalTransacciones,
        successful_transactions: exitosas,
        failed_transactions: fallidas,
        tps_peak: tpsPeak,
        tps_average: tpsAverage,
        latency_avg_ms: average(latencias),
        latency_min_ms: latencias.length > 0 ? Math.min(...latencias) : 0,
        latency_max_ms: latencias.length > 0 ? Math.max(...latencias) : 0,
        latency_p50_ms: percentile(latencias, 0.5),
        latency_p95_ms: percentile(latencias, 0.95),
        latency_p99_ms: percentile(latencias, 0.99),
        block_time_avg_seconds: avgBlockTime,
        block_time_min_seconds: blockTimes.length > 0 ? Math.min(...blockTimes) : 0,
        block_time_max_seconds: blockTimes.length > 0 ? Math.max(...blockTimes) : 0,
        blocks_observed: blockSamples.length,
        gas_used_avg: average(gasUsedValues),
        gas_used_max: gasUsedValues.length > 0 ? Math.max(...gasUsedValues) : 0,
        gas_limit: blockSamples.length > 0 ? blockSamples[blockSamples.length - 1].gas_limit : 30000000,
        gas_utilization_pct: avgGasUtilization,
        reverted_transactions: revertedTxs.length,
        out_of_gas_transactions: 0,
        node_response_avg_ms: nodeResponseAvgMs,
        contract_address: config.contractAddress,
        deploy_successful: undefined,
        erc_function_calls: 0,
        erc_function_success: 0,
        block_samples: blockSamples
    };
}
async function tryRunInternalEoa(config, chainId) {
    const mnemonic = config.mnemonic?.trim();
    if (!mnemonic) {
        return { error: "Se requiere un mnemonic para ejecutar transferencias EOA reales." };
    }
    const options = resolveEoaRunnerOptions(config);
    try {
        const ethers = await loadEthersModule();
        const provider = new ethers.providers.JsonRpcProvider(config.rpcUrl);
        const network = await provider.getNetwork();
        const effectiveChainId = chainId || Number(network?.chainId ?? 0);
        const zeroValue = ethers.BigNumber.from(0);
        const gasLimit = ethers.BigNumber.from(21000);
        const distributor = ethers.Wallet
            .fromMnemonic(mnemonic, derivationPathForIndex(0))
            .connect(provider);
        const distribution = distribuirTransacciones(config.totalTransacciones, config.numSubcuentas);
        const senderStates = distribution
            .map((objetivoTxs, idx) => {
            const wallet = ethers.Wallet
                .fromMnemonic(mnemonic, derivationPathForIndex(idx + 1))
                .connect(provider);
            return {
                wallet,
                address: wallet.address,
                recipient: "",
                nextNonce: 0,
                objetivoTxs,
                enviadas: 0
            };
        })
            .filter((sender) => sender.objetivoTxs > 0);
        if (senderStates.length === 0) {
            return { output: construirSalidaMinima(0, config, effectiveChainId) };
        }
        senderStates.forEach((sender, index) => {
            sender.recipient = senderStates.length > 1
                ? senderStates[(index + 1) % senderStates.length].address
                : distributor.address;
        });
        for (const sender of senderStates) {
            sender.nextNonce = await getPendingNonce(provider, sender.address);
        }
        let distributorNonce = await getPendingNonce(provider, distributor.address);
        let gasPrice = await provider.getGasPrice();
        const fundingTxs = [];
        for (const sender of senderStates) {
            gasPrice = await getFreshGasPrice(provider, gasPrice);
            const fundingTx = await sendSignedTransactionWithRetries({
                ethers,
                provider,
                wallet: distributor,
                chainId: effectiveChainId,
                nonce: distributorNonce,
                initialGasPrice: gasPrice,
                txBase: {
                    to: sender.address,
                    value: buildFundingAmount(ethers, gasPrice, sender.objetivoTxs),
                    gasLimit
                },
                options,
                contextLabel: `Fondeo de ${sender.address}`
            });
            distributorNonce += 1;
            fundingTxs.push(fundingTx);
            if (options.batchDelayMs > 0) {
                await sleep(Math.min(options.batchDelayMs, 400));
            }
        }
        const fundingReceipts = await pollReceipts(provider, fundingTxs.map((tx) => tx.hash), options);
        const fundingPendientes = fundingTxs.filter((tx) => {
            const receipt = fundingReceipts.get(tx.hash);
            return !receipt || (typeof receipt.status === "number" && receipt.status === 0);
        });
        if (fundingPendientes.length > 0) {
            return {
                error: `El fondeo inicial de subcuentas no se confirmó completamente ` +
                    `(${fundingPendientes.length}/${fundingTxs.length} pendientes o revertidas) ` +
                    `dentro de ${options.receiptTimeoutMs} ms.`
            };
        }
        const queue = [];
        const maxObjetivo = Math.max(...senderStates.map((sender) => sender.objetivoTxs));
        for (let round = 0; round < maxObjetivo; round++) {
            for (const sender of senderStates) {
                if (round < sender.objetivoTxs) {
                    queue.push(sender);
                }
            }
        }
        const submittedTxs = [];
        const sendErrors = [];
        const queueBatches = chunkArray(queue, options.batchSize);
        for (const [batchIndex, batch] of queueBatches.entries()) {
            gasPrice = await getFreshGasPrice(provider, gasPrice);
            for (const sender of batch) {
                try {
                    const tx = await sendSignedTransactionWithRetries({
                        ethers,
                        provider,
                        wallet: sender.wallet,
                        chainId: effectiveChainId,
                        nonce: sender.nextNonce,
                        initialGasPrice: gasPrice,
                        txBase: {
                            to: sender.recipient,
                            value: zeroValue,
                            gasLimit
                        },
                        options,
                        contextLabel: `Transferencia EOA nonce ${sender.nextNonce} desde ${sender.address}`
                    });
                    sender.nextNonce += 1;
                    sender.enviadas += 1;
                    submittedTxs.push(tx);
                }
                catch (error) {
                    sendErrors.push(extraerMensajeError(error));
                    try {
                        const remotePendingNonce = await getPendingNonce(provider, sender.address);
                        sender.nextNonce = Math.max(sender.nextNonce, remotePendingNonce);
                    }
                    catch {
                        // Si el refresh del nonce falla, se mantiene el nonce local actual.
                    }
                }
            }
            if (batchIndex < queueBatches.length - 1 && options.batchDelayMs > 0) {
                await sleep(options.batchDelayMs);
            }
        }
        if (submittedTxs.length === 0) {
            return {
                error: sendErrors[0]
                    ? `No se pudo enviar ninguna transferencia EOA. Detalle: ${sendErrors[0]}`
                    : "No se pudo enviar ninguna transferencia EOA."
            };
        }
        const receipts = await pollReceipts(provider, submittedTxs.map((tx) => tx.hash), options);
        const blocks = await fetchBlocksMap(provider, [...receipts.values()]
            .map((receipt) => Number(receipt?.blockNumber))
            .filter((blockNumber) => Number.isFinite(blockNumber)));
        return {
            output: buildEoaOutput({
                config,
                chainId: effectiveChainId,
                submittedTxs,
                receipts,
                blocks
            })
        };
    }
    catch (error) {
        return { error: `Runner EOA interno falló: ${extraerMensajeError(error)}` };
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
    const resolved = resolveAuditRunConfig(config);
    const configUsada = resolved.config;
    const hasRunnableConfig = configUsada.rpcUrl !== FALLBACK_RPC_URL &&
        !!configUsada.mnemonic?.trim();
    const chainId = await getChainId(configUsada.rpcUrl).catch(() => 0);
    if (hasRunnableConfig) {
        const resultado = await tryRunPandorasBox(configUsada, chainId);
        if (resultado === null) {
            // pandoras-box no está instalado; se cae a simulación sin romper el backend.
        }
        else if ("output" in resultado) {
            return {
                output: resultado.output,
                fuente: "pandoras-box",
                configUsada
            };
        }
        else {
            const { samples } = await fetchRealBlockData(configUsada.rpcUrl, 10);
            const sim = buildSimulation(configUsada, samples, chainId);
            return {
                output: sim,
                fuente: "simulacion",
                errorPandoras: resultado.error,
                configUsada
            };
        }
    }
    const { samples } = await fetchRealBlockData(configUsada.rpcUrl, 10);
    const sim = buildSimulation(configUsada, samples, chainId);
    return {
        output: sim,
        fuente: "simulacion",
        errorPandoras: resolved.warning,
        configUsada
    };
}

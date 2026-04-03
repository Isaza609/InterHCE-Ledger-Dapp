"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.tryRunPandorasMeasured = tryRunPandorasMeasured;
const http_1 = __importDefault(require("http"));
const https_1 = __importDefault(require("https"));
const path_1 = __importDefault(require("path"));
const module_1 = require("module");
const requireFromHere = (0, module_1.createRequire)(__filename);
const VENDOR_BIN_DIR = path_1.default.resolve(__dirname, "../../vendor/pandoras-box/bin");
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const DEFAULT_RECEIPT_TIMEOUT_MS = 180000;
const DEFAULT_RECEIPT_POLL_INTERVAL_MS = 2000;
const DEFAULT_BATCH_DELAY_ALCHEMY_MS = 5000;
const DEFAULT_BATCH_DELAY_GENERIC_MS = 1000;
let depsCache = null;
function esUrlAlchemy(rpcUrl) {
    return rpcUrl.includes("alchemy.com") || rpcUrl.includes("alchemyapi.io");
}
function normalizeAddress(value) {
    return value ? value.toLowerCase() : undefined;
}
function toBigIntValue(value) {
    if (typeof value === "bigint")
        return value;
    if (typeof value === "number")
        return BigInt(Math.trunc(value));
    if (typeof value === "string")
        return BigInt(value);
    if (value && typeof value === "object" && "toString" in value) {
        return BigInt(value.toString());
    }
    return 0n;
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
function extraerMensajeError(error) {
    if (error instanceof Error && error.message) {
        return error.message;
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
function serializeArg(value) {
    if (typeof value === "string")
        return value;
    if (typeof value === "number" || typeof value === "bigint")
        return String(value);
    if (Array.isArray(value)) {
        return JSON.stringify(value.map((item) => serializeArg(item)));
    }
    if (value && typeof value === "object" && "toString" in value) {
        return value.toString();
    }
    return JSON.stringify(value);
}
function classifySendError(message) {
    const lower = message.toLowerCase();
    if (lower.includes("nonce too low"))
        return "nonce_too_low";
    if (lower.includes("replacement transaction underpriced") ||
        lower.includes("replacement fee too low")) {
        return "replacement_underpriced";
    }
    if (lower.includes("already known"))
        return "already_known";
    if (lower.includes("compute units") ||
        lower.includes("too many requests") ||
        lower.includes("rate limit") ||
        lower.includes("429")) {
        return "rate_limit";
    }
    if (lower.includes("timeout") ||
        lower.includes("socket") ||
        lower.includes("network") ||
        lower.includes("econn") ||
        lower.includes("fetch failed")) {
        return "rpc_transport";
    }
    return "unknown_send";
}
function classifyExecutionError(message) {
    const lower = message.toLowerCase();
    if (lower.includes("out of gas"))
        return "out_of_gas";
    if (lower.includes("revert"))
        return "revert";
    return "execution_failed_unknown";
}
function normalizeReceiptStatus(status) {
    if (typeof status === "number")
        return status;
    if (typeof status === "string") {
        if (status === "0x1")
            return 1;
        if (status === "0x0")
            return 0;
    }
    return 0;
}
function resolveRunnerOptions(config) {
    return {
        batchSize: Math.max(1, config.batchSize ?? 10),
        batchDelayMs: Math.max(0, config.batchDelayMs ??
            (esUrlAlchemy(config.rpcUrl) ? DEFAULT_BATCH_DELAY_ALCHEMY_MS : DEFAULT_BATCH_DELAY_GENERIC_MS)),
        receiptTimeoutMs: Math.max(10000, config.receiptTimeoutMs ?? DEFAULT_RECEIPT_TIMEOUT_MS),
        receiptPollIntervalMs: Math.max(500, esUrlAlchemy(config.rpcUrl) ? DEFAULT_RECEIPT_POLL_INTERVAL_MS : 1500)
    };
}
function vendorRequire(relativePath) {
    return requireFromHere(path_1.default.join(VENDOR_BIN_DIR, relativePath));
}
async function loadPandoraDependencies() {
    if (depsCache)
        return depsCache;
    try {
        depsCache = {
            ethers: requireFromHere("ethers"),
            Distributor: vendorRequire("distributor/distributor.js").Distributor,
            TokenDistributor: vendorRequire("distributor/tokenDistributor.js").default,
            EOARuntime: vendorRequire("runtime/eoa.js").default,
            ERC20Runtime: vendorRequire("runtime/erc20.js").default,
            ERC721Runtime: vendorRequire("runtime/erc721.js").default,
            Signer: vendorRequire("runtime/signer.js").Signer,
            erc20Artifact: vendorRequire("contracts/ZexCoinERC20.json"),
            erc721Artifact: vendorRequire("contracts/ZexNFTs.json")
        };
        return depsCache;
    }
    catch {
        return null;
    }
}
function classifyOperation(mode, rawTx, iface) {
    if (mode === "EOA") {
        return {
            operationType: "EOA_TRANSFER",
            decodedArgs: []
        };
    }
    if (!iface || !rawTx?.data) {
        return {
            operationType: "DESCONOCIDA",
            decodedArgs: []
        };
    }
    try {
        const parsed = iface.parseTransaction({
            data: String(rawTx.data),
            value: rawTx.value ?? 0
        });
        const decodedArgs = Array.from(parsed.args ?? []).map((arg) => serializeArg(arg));
        if (mode === "ERC20") {
            if (parsed.name === "transfer") {
                return { operationType: "ERC20_TRANSFER", functionName: parsed.name, decodedArgs };
            }
            if (parsed.name === "approve") {
                return { operationType: "ERC20_APPROVE", functionName: parsed.name, decodedArgs };
            }
        }
        if (mode === "ERC721") {
            if (parsed.name === "createNFT") {
                return { operationType: "ERC721_MINT", functionName: parsed.name, decodedArgs };
            }
            if (parsed.name === "transferFrom" || parsed.name === "safeTransferFrom") {
                return { operationType: "ERC721_TRANSFER", functionName: parsed.name, decodedArgs };
            }
        }
    }
    catch {
        // Si no se puede decodificar, dejamos constancia explícita.
    }
    return {
        operationType: "DESCONOCIDA",
        decodedArgs: []
    };
}
async function setupRuntime(config, deps) {
    const provider = new deps.ethers.providers.JsonRpcProvider(config.rpcUrl);
    const network = await provider.getNetwork();
    const chainId = Number(network?.chainId ?? 0);
    if (config.modo === "EOA") {
        return {
            provider,
            runtime: new deps.EOARuntime(config.mnemonic, config.rpcUrl),
            chainId
        };
    }
    if (config.modo === "ERC20") {
        const runtime = new deps.ERC20Runtime(config.mnemonic, config.rpcUrl);
        await runtime.Initialize();
        const contractAddress = runtime.contract?.address;
        return {
            provider,
            runtime,
            chainId,
            contractAddress,
            contract: runtime.contract,
            iface: new deps.ethers.utils.Interface(deps.erc20Artifact.abi)
        };
    }
    const runtime = new deps.ERC721Runtime(config.mnemonic, config.rpcUrl);
    await runtime.Initialize();
    const contractAddress = runtime.contract?.address;
    return {
        provider,
        runtime,
        chainId,
        contractAddress,
        contract: runtime.contract,
        iface: new deps.ethers.utils.Interface(deps.erc721Artifact.abi)
    };
}
async function captureInitialMeasurementState(params) {
    const { config, txContexts, runtimeArtifacts } = params;
    const erc20Balances = new Map();
    if (config.modo === "ERC20" && runtimeArtifacts.contract) {
        const participants = new Set();
        for (const tx of txContexts) {
            if (tx.operationType !== "ERC20_TRANSFER")
                continue;
            participants.add(tx.from);
            if (tx.decodedArgs[0]) {
                participants.add(tx.decodedArgs[0]);
            }
        }
        for (const address of participants) {
            const balance = await runtimeArtifacts.contract.balanceOf(address);
            erc20Balances.set(normalizeAddress(address) ?? address, toBigIntValue(balance));
        }
    }
    return {
        erc20Balances
    };
}
async function prepareWorkload(params) {
    const { config, deps, runtime, iface } = params;
    const distributor = new deps.Distributor(config.mnemonic, config.numSubcuentas, config.totalTransacciones, runtime, config.rpcUrl);
    let accountIndexes = await distributor.distribute();
    if (config.modo === "ERC20") {
        const tokenDistributor = new deps.TokenDistributor(config.mnemonic, accountIndexes, config.totalTransacciones, runtime);
        const fundedIndexes = await tokenDistributor.distributeTokens();
        if (Array.isArray(fundedIndexes) && fundedIndexes.length > 0) {
            accountIndexes = fundedIndexes;
        }
    }
    const signer = new deps.Signer(config.mnemonic, config.rpcUrl);
    const accounts = await signer.getSenderAccounts(accountIndexes, config.totalTransacciones);
    const rawTransactions = await runtime.ConstructTransactions(accounts, config.totalTransacciones);
    const txContexts = [];
    const signFailureMetrics = [];
    for (let i = 0; i < rawTransactions.length; i++) {
        const sender = accounts[i % accounts.length];
        const rawTx = rawTransactions[i];
        const metadata = classifyOperation(config.modo, rawTx, iface);
        try {
            const signedTx = await sender.wallet.signTransaction(rawTx);
            const localHash = deps.ethers.utils.keccak256(signedTx);
            txContexts.push({
                rawTx,
                signedTx,
                localHash,
                from: String(rawTx?.from ?? sender.getAddress()),
                to: rawTx?.to ? String(rawTx.to) : undefined,
                nonce: Number(rawTx?.nonce ?? sender.getNonce()),
                operationType: metadata.operationType,
                functionName: metadata.functionName,
                decodedArgs: metadata.decodedArgs,
                contractAddress: rawTx?.to ? String(rawTx.to) : undefined
            });
        }
        catch (error) {
            signFailureMetrics.push({
                local_hash: undefined,
                from: String(rawTx?.from ?? sender.getAddress()),
                to: rawTx?.to ? String(rawTx.to) : undefined,
                nonce: Number(rawTx?.nonce ?? sender.getNonce()),
                operation_type: metadata.operationType,
                status: "failed_send",
                send_error_type: "unknown_send",
                send_error_message: `Error firmando transacción: ${extraerMensajeError(error)}`,
                rpc_response_ms: 0
            });
        }
    }
    return { txContexts, signFailureMetrics, accountIndexes };
}
async function jsonRpcBatchPost(rpcUrl, requests) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify(requests.map((request) => ({
            jsonrpc: "2.0",
            id: request.id,
            method: request.method,
            params: request.params
        })));
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
            timeout: 30000
        };
        const transport = isHttps ? https_1.default : http_1.default;
        const req = transport.request(options, (res) => {
            let data = "";
            res.on("data", (chunk) => {
                data += chunk;
            });
            res.on("end", () => {
                try {
                    const parsedData = JSON.parse(data);
                    resolve(Array.isArray(parsedData) ? parsedData : [parsedData]);
                }
                catch {
                    reject(new Error(`JSON-RPC batch parse error: ${data.slice(0, 200)}`));
                }
            });
        });
        req.on("error", reject);
        req.on("timeout", () => {
            req.destroy();
            reject(new Error("RPC batch timeout"));
        });
        req.write(body);
        req.end();
    });
}
async function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
async function sendWorkload(params) {
    const { rpcUrl, txContexts, options } = params;
    const batches = chunkArray(txContexts, options.batchSize);
    const submittedTxs = [];
    const sendFailureMetrics = [];
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        const startedAtMs = Date.now();
        const requests = batch.map((tx, idx) => ({
            id: `${batchIndex}-${idx}`,
            method: "eth_sendRawTransaction",
            params: [tx.signedTx]
        }));
        try {
            const responses = await jsonRpcBatchPost(rpcUrl, requests);
            const elapsedMs = Date.now() - startedAtMs;
            const byId = new Map(responses.map((response) => [String(response.id ?? ""), response]));
            batch.forEach((tx, idx) => {
                const response = byId.get(`${batchIndex}-${idx}`);
                if (!response) {
                    sendFailureMetrics.push({
                        tx_hash: undefined,
                        local_hash: tx.localHash,
                        from: tx.from,
                        to: tx.to,
                        nonce: tx.nonce,
                        operation_type: tx.operationType,
                        sent_at: new Date(startedAtMs).toISOString(),
                        rpc_response_ms: elapsedMs,
                        status: "failed_send",
                        send_error_type: "unknown_send",
                        send_error_message: "El nodo no devolvió respuesta para la transacción."
                    });
                    return;
                }
                if (response.error) {
                    const message = response.error.message || "Error JSON-RPC sin mensaje";
                    const errorType = classifySendError(message);
                    if (errorType === "already_known") {
                        submittedTxs.push({
                            ...tx,
                            txHash: tx.localHash,
                            sentAtMs: startedAtMs,
                            rpcResponseMs: elapsedMs
                        });
                        return;
                    }
                    sendFailureMetrics.push({
                        tx_hash: undefined,
                        local_hash: tx.localHash,
                        from: tx.from,
                        to: tx.to,
                        nonce: tx.nonce,
                        operation_type: tx.operationType,
                        sent_at: new Date(startedAtMs).toISOString(),
                        rpc_response_ms: elapsedMs,
                        status: "failed_send",
                        send_error_type: errorType,
                        send_error_message: message
                    });
                    return;
                }
                if (typeof response.result === "string" && response.result) {
                    submittedTxs.push({
                        ...tx,
                        txHash: String(response.result),
                        sentAtMs: startedAtMs,
                        rpcResponseMs: elapsedMs
                    });
                    return;
                }
                sendFailureMetrics.push({
                    tx_hash: undefined,
                    local_hash: tx.localHash,
                    from: tx.from,
                    to: tx.to,
                    nonce: tx.nonce,
                    operation_type: tx.operationType,
                    sent_at: new Date(startedAtMs).toISOString(),
                    rpc_response_ms: elapsedMs,
                    status: "failed_send",
                    send_error_type: "unknown_send",
                    send_error_message: "Respuesta JSON-RPC sin hash de transacción."
                });
            });
        }
        catch (error) {
            const elapsedMs = Date.now() - startedAtMs;
            const message = extraerMensajeError(error);
            const errorType = classifySendError(message);
            batch.forEach((tx) => {
                sendFailureMetrics.push({
                    tx_hash: undefined,
                    local_hash: tx.localHash,
                    from: tx.from,
                    to: tx.to,
                    nonce: tx.nonce,
                    operation_type: tx.operationType,
                    sent_at: new Date(startedAtMs).toISOString(),
                    rpc_response_ms: elapsedMs,
                    status: "failed_send",
                    send_error_type: errorType,
                    send_error_message: message
                });
            });
        }
        if (batchIndex < batches.length - 1 && options.batchDelayMs > 0) {
            await sleep(options.batchDelayMs);
        }
    }
    return { submittedTxs, sendFailureMetrics };
}
async function pollReceipts(provider, hashes, options) {
    const receipts = new Map();
    if (hashes.length === 0)
        return receipts;
    const deadline = Date.now() + options.receiptTimeoutMs;
    while (receipts.size < hashes.length && Date.now() < deadline) {
        const pending = hashes.filter((hash) => !receipts.has(hash));
        for (const hash of pending) {
            try {
                const receipt = await provider.getTransactionReceipt(hash);
                if (receipt) {
                    receipts.set(hash, receipt);
                }
            }
            catch {
                // No usamos heurísticas; si el receipt no está disponible todavía, se reintenta.
            }
        }
        if (receipts.size < hashes.length) {
            await sleep(options.receiptPollIntervalMs);
        }
    }
    return receipts;
}
async function fetchBlocksMap(provider, blockNumbers) {
    const unique = [...new Set(blockNumbers.filter((blockNumber) => Number.isFinite(blockNumber)))];
    const expanded = new Set();
    unique.forEach((blockNumber) => {
        expanded.add(blockNumber);
        if (blockNumber > 0)
            expanded.add(blockNumber - 1);
    });
    const blocks = new Map();
    for (const blockNumber of [...expanded].sort((a, b) => a - b)) {
        try {
            const block = await provider.getBlock(blockNumber);
            if (block) {
                blocks.set(blockNumber, block);
            }
        }
        catch {
            // Si un bloque falla se mantiene el resto de la corrida.
        }
    }
    return blocks;
}
function buildReceiptTimeoutMetrics(submittedTxs, receipts) {
    return submittedTxs
        .filter((tx) => !receipts.has(tx.txHash))
        .map((tx) => ({
        tx_hash: tx.txHash,
        local_hash: tx.localHash,
        from: tx.from,
        to: tx.to,
        nonce: tx.nonce,
        operation_type: tx.operationType,
        sent_at: new Date(tx.sentAtMs).toISOString(),
        rpc_response_ms: tx.rpcResponseMs,
        status: "receipt_timeout",
        execution_error_type: "receipt_timeout",
        execution_error_message: "No se obtuvo receipt dentro del timeout configurado."
    }));
}
async function classifyFailedExecution(provider, tx, blockNumber) {
    try {
        await provider.call({
            from: tx.from,
            to: tx.to,
            data: tx.rawTx?.data,
            value: tx.rawTx?.value,
            gasLimit: tx.rawTx?.gasLimit
        }, Math.max(0, blockNumber - 1));
    }
    catch (error) {
        const message = extraerMensajeError(error);
        return {
            type: classifyFailedExecutionMessage(message),
            message
        };
    }
    return {
        type: "execution_failed_unknown"
    };
}
function classifyFailedExecutionMessage(message) {
    return classifyExecutionError(message);
}
function extractContractEvents(receipt, iface, contractAddress) {
    if (!iface || !Array.isArray(receipt?.logs))
        return [];
    const normalizedContract = normalizeAddress(contractAddress);
    const events = [];
    for (const log of receipt.logs) {
        if (normalizedContract && normalizeAddress(log?.address) !== normalizedContract) {
            continue;
        }
        try {
            const parsed = iface.parseLog(log);
            events.push({
                name: parsed.name,
                args: Array.from(parsed.args ?? [])
            });
        }
        catch {
            // Ignora logs no compatibles con el ABI de interés.
        }
    }
    return events;
}
async function validateConfirmedTransactions(params) {
    const { config, confirmedTxs, runtimeArtifacts, initialState } = params;
    const metricNotes = [
        "TPS real calculado solo con transacciones propias confirmadas on-chain.",
        "Latencia calculada por transacción como block.timestamp - sentAt.",
        "Gas por transacción calculado exclusivamente con receipt.gasUsed."
    ];
    const successfulTxs = confirmedTxs.filter((tx) => tx.receiptStatus === 1);
    const presentOperations = new Set(successfulTxs.map((tx) => tx.operationType));
    if (config.modo === "EOA") {
        successfulTxs.forEach((tx) => {
            tx.eventValid = true;
            tx.stateValid = true;
        });
        return {
            confirmedTxs,
            interoperabilityChecks: {
                total_contract_calls: 0,
                successful_contract_calls: 0,
                event_checks_ok: 0,
                state_checks_ok: 0,
                unsupported_operations: [],
                notes: ["EOA: se valida confirmación efectiva de la transferencia, sin ABI de contrato."]
            },
            metricNotes
        };
    }
    const iface = runtimeArtifacts.iface;
    const provider = runtimeArtifacts.provider;
    const contractAddress = runtimeArtifacts.contractAddress;
    const contract = runtimeArtifacts.contract;
    const unsupportedOperations = [];
    if (config.modo === "ERC20" && !presentOperations.has("ERC20_APPROVE")) {
        unsupportedOperations.push("ERC20_APPROVE");
        metricNotes.push("Pandora no generó operaciones ERC20 approve en esta corrida; solo se midió la carga realmente emitida.");
    }
    if (config.modo === "ERC721" && !presentOperations.has("ERC721_TRANSFER")) {
        unsupportedOperations.push("ERC721_TRANSFER");
        metricNotes.push("Pandora no generó operaciones ERC721 transfer en esta corrida; solo se midió la carga realmente emitida.");
    }
    const erc20Participants = new Set();
    if (config.modo === "ERC20" && contract) {
        successfulTxs.forEach((tx) => {
            if (tx.operationType === "ERC20_TRANSFER") {
                erc20Participants.add(tx.from);
                if (tx.decodedArgs[0])
                    erc20Participants.add(tx.decodedArgs[0]);
            }
        });
    }
    const eventOkTxHashes = new Set();
    const stateOkTxHashes = new Set();
    const balanceDeltas = new Map();
    const lastApprovalByPair = new Map();
    for (const tx of successfulTxs) {
        const receipt = {
            logs: []
        };
        const providerReceipt = await provider.getTransactionReceipt(tx.txHash);
        if (providerReceipt) {
            receipt.logs = providerReceipt.logs ?? [];
        }
        const events = extractContractEvents(receipt, iface, contractAddress);
        if (tx.operationType === "ERC20_TRANSFER") {
            const expectedTo = normalizeAddress(tx.decodedArgs[0]);
            const expectedTokens = tx.decodedArgs[1] ? BigInt(tx.decodedArgs[1]) : 0n;
            const matching = events.find((event) => {
                if (event.name !== "Transfer")
                    return false;
                const from = normalizeAddress(serializeArg(event.args[0]));
                const to = normalizeAddress(serializeArg(event.args[1]));
                const tokens = toBigIntValue(event.args[2]);
                return from === normalizeAddress(tx.from) && to === expectedTo && tokens === expectedTokens;
            });
            tx.eventValid = !!matching;
            if (matching) {
                eventOkTxHashes.add(tx.txHash);
                const fromKey = normalizeAddress(tx.from) ?? tx.from;
                const toKey = expectedTo ?? tx.decodedArgs[0];
                balanceDeltas.set(fromKey, (balanceDeltas.get(fromKey) ?? 0n) - expectedTokens);
                balanceDeltas.set(toKey, (balanceDeltas.get(toKey) ?? 0n) + expectedTokens);
            }
            continue;
        }
        if (tx.operationType === "ERC20_APPROVE") {
            const expectedSpender = normalizeAddress(tx.decodedArgs[0]);
            const expectedTokens = tx.decodedArgs[1] ? BigInt(tx.decodedArgs[1]) : 0n;
            const matching = events.find((event) => {
                if (event.name !== "Approval")
                    return false;
                const owner = normalizeAddress(serializeArg(event.args[0]));
                const spender = normalizeAddress(serializeArg(event.args[1]));
                const tokens = toBigIntValue(event.args[2]);
                return owner === normalizeAddress(tx.from) && spender === expectedSpender && tokens === expectedTokens;
            });
            tx.eventValid = !!matching;
            if (matching) {
                eventOkTxHashes.add(tx.txHash);
                const pairKey = `${normalizeAddress(tx.from)}:${expectedSpender}`;
                lastApprovalByPair.set(pairKey, expectedTokens);
            }
            continue;
        }
        if (tx.operationType === "ERC721_MINT") {
            const matching = events.find((event) => {
                if (event.name !== "Transfer")
                    return false;
                const from = normalizeAddress(serializeArg(event.args[0]));
                const to = normalizeAddress(serializeArg(event.args[1]));
                return from === ZERO_ADDRESS && to === normalizeAddress(tx.from);
            });
            tx.eventValid = !!matching;
            if (matching) {
                eventOkTxHashes.add(tx.txHash);
                const tokenId = serializeArg(matching.args[2]);
                try {
                    const owner = await contract.ownerOf(tokenId);
                    tx.stateValid = normalizeAddress(owner) === normalizeAddress(tx.from);
                    if (tx.stateValid) {
                        stateOkTxHashes.add(tx.txHash);
                    }
                }
                catch {
                    tx.stateValid = false;
                }
            }
            continue;
        }
        if (tx.operationType === "ERC721_TRANSFER") {
            const expectedFrom = normalizeAddress(tx.decodedArgs[0]);
            const expectedTo = normalizeAddress(tx.decodedArgs[1]);
            const expectedTokenId = tx.decodedArgs[2];
            const matching = events.find((event) => {
                if (event.name !== "Transfer")
                    return false;
                const from = normalizeAddress(serializeArg(event.args[0]));
                const to = normalizeAddress(serializeArg(event.args[1]));
                const tokenId = serializeArg(event.args[2]);
                return from === expectedFrom && to === expectedTo && tokenId === expectedTokenId;
            });
            tx.eventValid = !!matching;
            if (matching) {
                eventOkTxHashes.add(tx.txHash);
                try {
                    const owner = await contract.ownerOf(expectedTokenId);
                    tx.stateValid = normalizeAddress(owner) === expectedTo;
                    if (tx.stateValid) {
                        stateOkTxHashes.add(tx.txHash);
                    }
                }
                catch {
                    tx.stateValid = false;
                }
            }
            continue;
        }
        tx.eventValid = false;
        tx.stateValid = false;
    }
    if (config.modo === "ERC20" && contract) {
        const finalBalances = new Map();
        for (const address of erc20Participants) {
            const balance = await contract.balanceOf(address);
            finalBalances.set(normalizeAddress(address) ?? address, toBigIntValue(balance));
        }
        for (const tx of successfulTxs) {
            if (tx.operationType !== "ERC20_TRANSFER" || !tx.eventValid)
                continue;
            const fromKey = normalizeAddress(tx.from) ?? tx.from;
            const toKey = normalizeAddress(tx.decodedArgs[0]) ?? tx.decodedArgs[0];
            const expectedFrom = (initialState.erc20Balances.get(fromKey) ?? 0n) + (balanceDeltas.get(fromKey) ?? 0n);
            const expectedTo = (initialState.erc20Balances.get(toKey) ?? 0n) + (balanceDeltas.get(toKey) ?? 0n);
            tx.stateValid =
                finalBalances.get(fromKey) === expectedFrom &&
                    finalBalances.get(toKey) === expectedTo;
            if (tx.stateValid) {
                stateOkTxHashes.add(tx.txHash);
            }
        }
        for (const tx of successfulTxs) {
            if (tx.operationType !== "ERC20_APPROVE" || !tx.eventValid)
                continue;
            const spender = normalizeAddress(tx.decodedArgs[0]) ?? tx.decodedArgs[0];
            const pairKey = `${normalizeAddress(tx.from)}:${spender}`;
            const expectedAllowance = lastApprovalByPair.get(pairKey);
            if (expectedAllowance === undefined) {
                tx.stateValid = false;
                continue;
            }
            try {
                const allowance = await contract.allowance(tx.from, spender);
                tx.stateValid = toBigIntValue(allowance) === expectedAllowance;
                if (tx.stateValid) {
                    stateOkTxHashes.add(tx.txHash);
                }
            }
            catch {
                tx.stateValid = false;
            }
        }
    }
    return {
        confirmedTxs,
        interoperabilityChecks: {
            total_contract_calls: successfulTxs.length,
            successful_contract_calls: successfulTxs.filter((tx) => tx.eventValid && tx.stateValid).length,
            event_checks_ok: eventOkTxHashes.size,
            state_checks_ok: stateOkTxHashes.size,
            unsupported_operations: unsupportedOperations,
            notes: [
                `Contrato evaluado: ${contractAddress ?? "sin contrato"}.`,
                "Las validaciones de interoperabilidad usan eventos y estado real on-chain, no agregados de bloque."
            ]
        },
        metricNotes
    };
}
function buildOperationBreakdown(txMetrics) {
    const grouped = new Map();
    for (const tx of txMetrics) {
        if (!grouped.has(tx.operation_type)) {
            grouped.set(tx.operation_type, []);
        }
        grouped.get(tx.operation_type).push(tx);
    }
    return [...grouped.entries()].map(([operationType, txs]) => {
        const latencies = txs
            .map((tx) => tx.latency_ms)
            .filter((value) => typeof value === "number");
        const gasValues = txs
            .map((tx) => tx.gas_used)
            .filter((value) => typeof value === "number");
        const confirmedTransactions = txs.filter((tx) => tx.status === "confirmed" || tx.status === "failed_execution").length;
        const successfulTransactions = txs.filter((tx) => tx.status === "confirmed").length;
        return {
            operation_type: operationType,
            total_transactions: txs.length,
            confirmed_transactions: confirmedTransactions,
            successful_transactions: successfulTransactions,
            success_rate: txs.length > 0 ? (successfulTransactions / txs.length) * 100 : 0,
            latency_avg_ms: average(latencies),
            latency_p95_ms: percentile(latencies, 0.95),
            gas_used_avg: average(gasValues),
            gas_used_max: gasValues.length > 0 ? Math.max(...gasValues) : 0
        };
    });
}
function buildErrorBreakdown(txMetrics) {
    const send = {
        nonce_too_low: 0,
        replacement_underpriced: 0,
        already_known: 0,
        rate_limit: 0,
        rpc_transport: 0,
        unknown_send: 0
    };
    const execution = {
        revert: 0,
        out_of_gas: 0,
        execution_failed_unknown: 0,
        receipt_timeout: 0
    };
    for (const tx of txMetrics) {
        if (tx.send_error_type) {
            send[tx.send_error_type] += 1;
        }
        if (tx.execution_error_type) {
            execution[tx.execution_error_type] += 1;
        }
    }
    return { send, execution };
}
function buildBlockSamples(confirmedTxs, blocks) {
    const grouped = new Map();
    for (const tx of confirmedTxs) {
        if (!grouped.has(tx.blockNumber)) {
            grouped.set(tx.blockNumber, []);
        }
        grouped.get(tx.blockNumber).push(tx);
    }
    return [...grouped.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([blockNumber, txs]) => {
        const block = blocks.get(blockNumber);
        const parent = blocks.get(blockNumber - 1);
        const currentTs = typeof block?.timestamp === "number"
            ? block.timestamp
            : Math.floor(Math.min(...txs.map((tx) => tx.sentAtMs)) / 1000);
        const parentTs = typeof parent?.timestamp === "number"
            ? parent.timestamp
            : currentTs - 12;
        const blockTimeSeconds = Math.max(1, currentTs - parentTs);
        const gasUsed = txs.reduce((sum, tx) => sum + tx.gasUsed, 0);
        const gasLimit = block?.gasLimit ? Number(block.gasLimit.toString()) : 0;
        return {
            block_number: blockNumber,
            timestamp: new Date(currentTs * 1000).toISOString(),
            tx_count: txs.length,
            gas_used: gasUsed,
            gas_limit: gasLimit,
            block_time_seconds: blockTimeSeconds,
            tps: txs.length / blockTimeSeconds
        };
    });
}
function buildPandoraReportedMetrics(confirmedTxs, blocks) {
    const uniqueBlocks = [...new Set(confirmedTxs.map((tx) => tx.blockNumber))].sort((a, b) => a - b);
    let totalTime = 0;
    const gasUtilizations = [];
    for (const blockNumber of uniqueBlocks) {
        const current = blocks.get(blockNumber);
        const parent = blocks.get(blockNumber - 1);
        const currentTs = typeof current?.timestamp === "number" ? current.timestamp : 0;
        const parentTs = typeof parent?.timestamp === "number" ? parent.timestamp : Math.max(0, currentTs - 12);
        totalTime += Math.max(1, currentTs - parentTs);
        const gasUsed = current?.gasUsed ? Number(current.gasUsed.toString()) : 0;
        const gasLimit = current?.gasLimit ? Number(current.gasLimit.toString()) : 0;
        gasUtilizations.push(gasLimit > 0 ? (gasUsed / gasLimit) * 100 : 0);
    }
    return {
        tps_average: totalTime > 0 ? Math.ceil(confirmedTxs.length / totalTime) : confirmedTxs.length,
        blocks_observed: uniqueBlocks.length,
        average_block_gas_utilization_pct: average(gasUtilizations),
        notes: [
            "Pandora calcula TPS con transacciones propias confirmadas, pero usa intervalos de bloque agregados y redondeo ceil.",
            "Pandora no reporta latencia real por tx, gasUsed por tx ni clasificación fiable de errores."
        ]
    };
}
function buildMeasurementComparison(realTpsAverage, pandoraMetrics) {
    const tpsDelta = realTpsAverage - pandoraMetrics.tps_average;
    const tpsDeltaPct = pandoraMetrics.tps_average !== 0
        ? (tpsDelta / pandoraMetrics.tps_average) * 100
        : null;
    return {
        real_tps_average: realTpsAverage,
        pandora_tps_average: pandoraMetrics.tps_average,
        tps_delta: tpsDelta,
        tps_delta_pct: tpsDeltaPct,
        no_usar_metricas_pandora: [
            "latencia",
            "gas por transaccion",
            "TPS pico",
            "errores por categoria",
            "interoperabilidad"
        ]
    };
}
function buildTxMetrics(confirmedTxs, extraMetrics) {
    const confirmedMetrics = confirmedTxs.map((tx) => ({
        tx_hash: tx.txHash,
        local_hash: tx.localHash,
        from: tx.from,
        to: tx.to,
        nonce: tx.nonce,
        operation_type: tx.operationType,
        sent_at: new Date(tx.sentAtMs).toISOString(),
        block_number: tx.blockNumber,
        block_timestamp: new Date(tx.blockTimestampSec * 1000).toISOString(),
        latency_ms: tx.latencyMs,
        receipt_status: tx.receiptStatus,
        gas_used: tx.gasUsed,
        effective_gas_price_wei: tx.effectiveGasPriceWei,
        rpc_response_ms: tx.rpcResponseMs,
        status: tx.receiptStatus === 1 ? "confirmed" : "failed_execution",
        execution_error_type: tx.executionErrorType,
        execution_error_message: tx.executionErrorMessage,
        event_valid: tx.eventValid,
        state_valid: tx.stateValid
    }));
    return [...confirmedMetrics, ...extraMetrics];
}
function buildRealTpsWindowSeconds(confirmedTxs, blocks) {
    if (confirmedTxs.length === 0)
        return 0;
    const timestamps = confirmedTxs.map((tx) => tx.blockTimestampSec);
    const minTs = Math.min(...timestamps);
    const maxTs = Math.max(...timestamps);
    if (maxTs > minTs) {
        return maxTs - minTs;
    }
    const blockNumber = confirmedTxs[0].blockNumber;
    const current = blocks.get(blockNumber);
    const parent = blocks.get(blockNumber - 1);
    const currentTs = typeof current?.timestamp === "number" ? current.timestamp : maxTs;
    const parentTs = typeof parent?.timestamp === "number" ? parent.timestamp : Math.max(0, currentTs - 12);
    return Math.max(1, currentTs - parentTs);
}
function buildOutput(params) {
    const { config, chainId, contractAddress, submittedTxs, confirmedTxs, txMetrics, blockSamples, blocks, pandoraMetrics, interoperabilityChecks, operationBreakdown, metricNotes } = params;
    const latencies = confirmedTxs.map((tx) => tx.latencyMs);
    const gasValues = confirmedTxs.map((tx) => tx.gasUsed);
    const successfulTransactions = confirmedTxs.filter((tx) => tx.receiptStatus === 1).length;
    const revertedTransactions = confirmedTxs.filter((tx) => tx.executionErrorType === "revert").length;
    const outOfGasTransactions = confirmedTxs.filter((tx) => tx.executionErrorType === "out_of_gas").length;
    const blockTimes = blockSamples.map((sample) => sample.block_time_seconds);
    const gasUtilizationOwn = blockSamples.map((sample) => {
        return sample.gas_limit > 0 ? (sample.gas_used / sample.gas_limit) * 100 : 0;
    });
    const startMs = submittedTxs.length > 0
        ? Math.min(...submittedTxs.map((tx) => tx.sentAtMs))
        : Date.now();
    const endMs = confirmedTxs.length > 0
        ? Math.max(...confirmedTxs.map((tx) => tx.blockTimestampSec * 1000))
        : (submittedTxs.length > 0
            ? Math.max(...submittedTxs.map((tx) => tx.sentAtMs))
            : startMs);
    const tpsWindowSeconds = buildRealTpsWindowSeconds(confirmedTxs, blocks);
    const tpsAverage = tpsWindowSeconds > 0 ? confirmedTxs.length / tpsWindowSeconds : 0;
    const tpsPeak = Math.max(0, ...blockSamples.map((sample) => sample.tps));
    const gasLimit = blockSamples.length > 0 ? blockSamples[blockSamples.length - 1].gas_limit : 0;
    return {
        mode: config.modo,
        start_time: new Date(startMs).toISOString(),
        end_time: new Date(endMs).toISOString(),
        duration_seconds: Math.max(0, (endMs - startMs) / 1000),
        rpc_url: config.rpcUrl,
        chain_id: chainId,
        total_transactions: config.totalTransacciones,
        successful_transactions: successfulTransactions,
        failed_transactions: Math.max(0, config.totalTransacciones - successfulTransactions),
        tps_peak: tpsPeak,
        tps_average: tpsAverage,
        latency_avg_ms: average(latencies),
        latency_min_ms: latencies.length > 0 ? Math.min(...latencies) : 0,
        latency_max_ms: latencies.length > 0 ? Math.max(...latencies) : 0,
        latency_p50_ms: percentile(latencies, 0.5),
        latency_p95_ms: percentile(latencies, 0.95),
        latency_p99_ms: percentile(latencies, 0.99),
        block_time_avg_seconds: average(blockTimes),
        block_time_min_seconds: blockTimes.length > 0 ? Math.min(...blockTimes) : 0,
        block_time_max_seconds: blockTimes.length > 0 ? Math.max(...blockTimes) : 0,
        blocks_observed: blockSamples.length,
        gas_used_avg: average(gasValues),
        gas_used_max: gasValues.length > 0 ? Math.max(...gasValues) : 0,
        gas_limit: gasLimit,
        gas_utilization_pct: average(gasUtilizationOwn),
        reverted_transactions: revertedTransactions,
        out_of_gas_transactions: outOfGasTransactions,
        node_response_avg_ms: average(submittedTxs.map((tx) => tx.rpcResponseMs)),
        contract_address: contractAddress,
        deploy_successful: config.modo === "EOA" ? undefined : !!contractAddress,
        erc_function_calls: config.modo === "EOA" ? 0 : confirmedTxs.filter((tx) => tx.receiptStatus === 1).length,
        erc_function_success: config.modo === "EOA"
            ? 0
            : confirmedTxs.filter((tx) => tx.receiptStatus === 1 && tx.eventValid && tx.stateValid).length,
        operation_breakdown: operationBreakdown,
        tx_metrics: txMetrics,
        error_breakdown: buildErrorBreakdown(txMetrics),
        pandora_reported_metrics: pandoraMetrics,
        measurement_comparison: buildMeasurementComparison(tpsAverage, pandoraMetrics),
        interoperability_checks: interoperabilityChecks,
        metric_notes: metricNotes,
        block_samples: blockSamples
    };
}
async function tryRunPandorasMeasured(config, chainIdHint) {
    if (!config.mnemonic?.trim()) {
        return null;
    }
    const deps = await loadPandoraDependencies();
    if (!deps) {
        return null;
    }
    try {
        const runtimeArtifacts = await setupRuntime(config, deps);
        const { txContexts, signFailureMetrics } = await prepareWorkload({
            config,
            deps,
            runtime: runtimeArtifacts.runtime,
            iface: runtimeArtifacts.iface
        });
        if (txContexts.length === 0) {
            return {
                error: "Pandora no construyó transacciones firmadas para la corrida."
            };
        }
        const initialState = await captureInitialMeasurementState({
            config,
            txContexts,
            runtimeArtifacts
        });
        const options = resolveRunnerOptions(config);
        const { submittedTxs, sendFailureMetrics } = await sendWorkload({
            rpcUrl: config.rpcUrl,
            txContexts,
            options
        });
        const receipts = await pollReceipts(runtimeArtifacts.provider, submittedTxs.map((tx) => tx.txHash), options);
        const blocks = await fetchBlocksMap(runtimeArtifacts.provider, [...receipts.values()]
            .map((receipt) => Number(receipt?.blockNumber))
            .filter((blockNumber) => Number.isFinite(blockNumber)));
        const confirmedTxs = [];
        for (const tx of submittedTxs) {
            const receipt = receipts.get(tx.txHash);
            if (!receipt || typeof receipt.blockNumber !== "number") {
                continue;
            }
            const block = blocks.get(receipt.blockNumber);
            const blockTimestampSec = typeof block?.timestamp === "number"
                ? block.timestamp
                : Math.floor(tx.sentAtMs / 1000);
            const receiptStatus = normalizeReceiptStatus(receipt.status);
            const confirmed = {
                ...tx,
                blockNumber: receipt.blockNumber,
                blockTimestampSec,
                latencyMs: Math.max(0, (blockTimestampSec * 1000) - tx.sentAtMs),
                gasUsed: receipt?.gasUsed ? Number(receipt.gasUsed.toString()) : 0,
                effectiveGasPriceWei: (receipt?.effectiveGasPrice ??
                    receipt?.gasPrice ??
                    tx.rawTx?.gasPrice ??
                    "0").toString(),
                receiptStatus,
                eventValid: false,
                stateValid: false
            };
            if (receiptStatus === 0) {
                const failure = await classifyFailedExecution(runtimeArtifacts.provider, tx, receipt.blockNumber);
                confirmed.executionErrorType = failure.type;
                confirmed.executionErrorMessage = failure.message;
            }
            confirmedTxs.push(confirmed);
        }
        const validated = await validateConfirmedTransactions({
            config,
            confirmedTxs,
            runtimeArtifacts,
            deps,
            initialState
        });
        const receiptTimeoutMetrics = buildReceiptTimeoutMetrics(submittedTxs, receipts);
        const txMetrics = buildTxMetrics(validated.confirmedTxs, [
            ...signFailureMetrics,
            ...sendFailureMetrics,
            ...receiptTimeoutMetrics
        ]);
        const operationBreakdown = buildOperationBreakdown(txMetrics);
        const blockSamples = buildBlockSamples(validated.confirmedTxs, blocks);
        const pandoraMetrics = buildPandoraReportedMetrics(validated.confirmedTxs, blocks);
        return {
            output: buildOutput({
                config,
                chainId: runtimeArtifacts.chainId || chainIdHint,
                contractAddress: runtimeArtifacts.contractAddress,
                submittedTxs,
                confirmedTxs: validated.confirmedTxs,
                txMetrics,
                blockSamples,
                blocks,
                pandoraMetrics,
                interoperabilityChecks: validated.interoperabilityChecks,
                operationBreakdown,
                metricNotes: validated.metricNotes
            })
        };
    }
    catch (error) {
        return {
            error: `Runner externo de métricas reales falló: ${extraerMensajeError(error)}`
        };
    }
}

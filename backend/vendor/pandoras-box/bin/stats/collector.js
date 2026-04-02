"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlockInfo = exports.CollectorData = exports.StatCollector = void 0;
const bignumber_1 = require("@ethersproject/bignumber");
const providers_1 = require("@ethersproject/providers");
const axios_1 = __importDefault(require("axios"));
const cli_progress_1 = require("cli-progress");
const cli_table3_1 = __importDefault(require("cli-table3"));
const logger_1 = __importDefault(require("../logger/logger"));
const batcher_1 = __importDefault(require("../runtime/batcher"));
const receiptTimeoutMs = Number(process.env.PANDORAS_RECEIPT_TIMEOUT_MS || 180000);
class txStats {
    constructor(txHash, block) {
        this.block = 0;
        this.txHash = txHash;
        this.block = block;
    }
}
class BlockInfo {
    constructor(blockNum, createdAt, numTxs, gasUsed, gasLimit) {
        this.blockNum = blockNum;
        this.createdAt = createdAt;
        this.numTxs = numTxs;
        this.gasUsed = gasUsed.toHexString();
        this.gasLimit = gasLimit.toHexString();
        const largeDivision = gasUsed
            .mul(bignumber_1.BigNumber.from(10000))
            .div(gasLimit)
            .toNumber();
        this.gasUtilization = largeDivision / 100;
    }
}
exports.BlockInfo = BlockInfo;
class CollectorData {
    constructor(tps, blockInfo) {
        this.tps = tps;
        this.blockInfo = blockInfo;
    }
}
exports.CollectorData = CollectorData;
class txBatchResult {
    constructor(succeeded, remaining, errors) {
        this.succeeded = succeeded;
        this.remaining = remaining;
        this.errors = errors;
    }
}
class StatCollector {
    gatherTransactionReceipts(txHashes, batchSize, provider) {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.default.info('Gathering transaction receipts...');
            const receiptBar = new cli_progress_1.SingleBar({
                barCompleteChar: '\u2588',
                barIncompleteChar: '\u2591',
                hideCursor: true,
            });
            receiptBar.start(txHashes.length, 0, {
                speed: 'N/A',
            });
            const fetchErrors = [];
            let receiptBarProgress = 0;
            let retryCounter = Math.ceil(txHashes.length * 0.025);
            let remainingTransactions = txHashes;
            let succeededTransactions = [];
            const providerURL = provider.connection.url;
            // Fetch transaction receipts in batches,
            // until the batch retry counter is reached (to avoid spamming)
            while (remainingTransactions.length > 0) {
                // Get the receipts for this batch
                const result = yield this.fetchTransactionReceipts(remainingTransactions, batchSize, providerURL);
                // Save any fetch errors
                for (const fetchErr of result.errors) {
                    fetchErrors.push(fetchErr);
                }
                // Update the remaining transactions whose
                // receipts need to be fetched
                remainingTransactions = result.remaining;
                // Save the succeeded transactions
                succeededTransactions = succeededTransactions.concat(result.succeeded);
                // Update the user loading bar
                receiptBar.increment(succeededTransactions.length - receiptBarProgress);
                receiptBarProgress = succeededTransactions.length;
                // Decrease the retry counter
                retryCounter--;
                if (remainingTransactions.length == 0 || retryCounter == 0) {
                    // If there are no more remaining transaction receipts to wait on,
                    // or the batch retries have been depleted, stop the batching process
                    break;
                }
                // Wait for a block to be mined on the network before asking
                // for the receipts again
                yield new Promise((resolve) => {
                    provider.once('block', () => {
                        resolve(null);
                    });
                });
            }
            // Wait for the transaction receipts individually
            // if they were not retrieved in the batching process.
            // This process is slower, but it guarantees transaction receipts
            // will eventually get retrieved, regardless of the number of blocks
            for (const txHash of remainingTransactions) {
                const txReceipt = yield provider.waitForTransaction(txHash, 1, receiptTimeoutMs);
                receiptBar.increment(1);
                if (txReceipt.status != undefined && txReceipt.status == 0) {
                    throw new Error(`transaction ${txReceipt.transactionHash} failed on execution`);
                }
                succeededTransactions.push(new txStats(txHash, txReceipt.blockNumber));
            }
            receiptBar.stop();
            if (fetchErrors.length > 0) {
                logger_1.default.warn('Errors encountered during batch sending:');
                for (const err of fetchErrors) {
                    logger_1.default.error(err);
                }
            }
            logger_1.default.success('Gathered transaction receipts');
            return succeededTransactions;
        });
    }
    fetchTransactionReceipts(txHashes, batchSize, url) {
        return __awaiter(this, void 0, void 0, function* () {
            // Create the batches for transaction receipts
            const batches = batcher_1.default.generateBatches(txHashes, batchSize);
            const succeeded = [];
            const remaining = [];
            const batchErrors = [];
            let nextIndx = 0;
            const responses = yield Promise.all(batches.map((hashes) => {
                let singleRequests = '';
                for (let i = 0; i < hashes.length; i++) {
                    singleRequests += JSON.stringify({
                        jsonrpc: '2.0',
                        method: 'eth_getTransactionReceipt',
                        params: [hashes[i]],
                        id: nextIndx++,
                    });
                    if (i != hashes.length - 1) {
                        singleRequests += ',\n';
                    }
                }
                return (0, axios_1.default)({
                    url: url,
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    data: '[' + singleRequests + ']',
                });
            }));
            for (let batchIndex = 0; batchIndex < responses.length; batchIndex++) {
                const data = responses[batchIndex].data;
                for (let txHashIndex = 0; txHashIndex < data.length; txHashIndex++) {
                    const batchItem = data[txHashIndex];
                    if (!batchItem.result) {
                        remaining.push(batches[batchIndex][txHashIndex]);
                        continue;
                    }
                    // eslint-disable-next-line no-prototype-builtins
                    if (batchItem.hasOwnProperty('error')) {
                        // Error occurred during batch sends
                        batchErrors.push(batchItem.error.message);
                        continue;
                    }
                    if (batchItem.result.status == '0x0') {
                        // Transaction failed
                        throw new Error(`transaction ${batchItem.result.transactionHash} failed on execution`);
                    }
                    succeeded.push(new txStats(batchItem.result.transactionHash, batchItem.result.blockNumber));
                }
            }
            return new txBatchResult(succeeded, remaining, batchErrors);
        });
    }
    fetchBlockInfo(stats, provider) {
        return __awaiter(this, void 0, void 0, function* () {
            const blockSet = new Set();
            for (const s of stats) {
                blockSet.add(s.block);
            }
            const blockFetchErrors = [];
            logger_1.default.info('\nGathering block info...');
            const blocksBar = new cli_progress_1.SingleBar({
                barCompleteChar: '\u2588',
                barIncompleteChar: '\u2591',
                hideCursor: true,
            });
            blocksBar.start(blockSet.size, 0, {
                speed: 'N/A',
            });
            const blocksMap = new Map();
            for (const block of blockSet.keys()) {
                try {
                    const fetchedInfo = yield provider.getBlock(block);
                    blocksBar.increment();
                    blocksMap.set(block, new BlockInfo(block, fetchedInfo.timestamp, fetchedInfo.transactions.length, fetchedInfo.gasUsed, fetchedInfo.gasLimit));
                }
                catch (e) {
                    blockFetchErrors.push(e);
                }
            }
            blocksBar.stop();
            logger_1.default.success('Gathered block info');
            if (blockFetchErrors.length > 0) {
                logger_1.default.warn('Errors encountered during block info fetch:');
                for (const err of blockFetchErrors) {
                    logger_1.default.error(err.message);
                }
            }
            return blocksMap;
        });
    }
    calcTPS(stats, provider) {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.default.title('\n🧮 Calculating TPS data 🧮\n');
            let totalTxs = 0;
            let totalTime = 0;
            // Find the average txn time per block
            const blockFetchErrors = [];
            const blockTimeMap = new Map();
            const uniqueBlocks = new Set();
            for (const stat of stats) {
                if (stat.block == 0) {
                    continue;
                }
                totalTxs++;
                uniqueBlocks.add(stat.block);
            }
            for (const block of uniqueBlocks) {
                // Get the parent block to find the generation time
                try {
                    const currentBlockNum = block;
                    const parentBlockNum = currentBlockNum - 1;
                    if (!blockTimeMap.has(parentBlockNum)) {
                        const parentBlock = yield provider.getBlock(parentBlockNum);
                        blockTimeMap.set(parentBlockNum, parentBlock.timestamp);
                    }
                    const parentBlock = blockTimeMap.get(parentBlockNum);
                    if (!blockTimeMap.has(currentBlockNum)) {
                        const currentBlock = yield provider.getBlock(currentBlockNum);
                        blockTimeMap.set(currentBlockNum, currentBlock.timestamp);
                    }
                    const currentBlock = blockTimeMap.get(currentBlockNum);
                    totalTime += Math.round(Math.abs(currentBlock - parentBlock));
                }
                catch (e) {
                    blockFetchErrors.push(e);
                }
            }
            return Math.ceil(totalTxs / totalTime);
        });
    }
    printBlockData(blockInfoMap) {
        logger_1.default.info('\nBlock utilization data:');
        const utilizationTable = new cli_table3_1.default({
            head: [
                'Block #',
                'Gas Used [wei]',
                'Gas Limit [wei]',
                'Transactions',
                'Utilization',
            ],
        });
        const sortedMap = new Map([...blockInfoMap.entries()].sort((a, b) => a[0] - b[0]));
        sortedMap.forEach((info) => {
            utilizationTable.push([
                info.blockNum,
                info.gasUsed,
                info.gasLimit,
                info.numTxs,
                `${info.gasUtilization}%`,
            ]);
        });
        logger_1.default.info(utilizationTable.toString());
    }
    printFinalData(tps, blockInfoMap) {
        // Find average utilization
        let totalUtilization = 0;
        blockInfoMap.forEach((info) => {
            totalUtilization += info.gasUtilization;
        });
        const avgUtilization = totalUtilization / blockInfoMap.size;
        const finalDataTable = new cli_table3_1.default({
            head: ['TPS', 'Blocks', 'Avg. Utilization'],
        });
        finalDataTable.push([
            tps,
            blockInfoMap.size,
            `${avgUtilization.toFixed(2)}%`,
        ]);
        logger_1.default.info(finalDataTable.toString());
    }
    generateStats(txHashes, mnemonic, url, batchSize) {
        return __awaiter(this, void 0, void 0, function* () {
            if (txHashes.length == 0) {
                logger_1.default.warn('No stat data to display');
                return new CollectorData(0, new Map());
            }
            logger_1.default.title('\n⏱ Statistics calculation initialized ⏱\n');
            const provider = new providers_1.JsonRpcProvider(url);
            // Fetch receipts
            const txStats = yield this.gatherTransactionReceipts(txHashes, batchSize, provider);
            // Fetch block info
            const blockInfoMap = yield this.fetchBlockInfo(txStats, provider);
            // Print the block utilization data
            this.printBlockData(blockInfoMap);
            // Print the final TPS and avg. utilization data
            const avgTPS = yield this.calcTPS(txStats, provider);
            this.printFinalData(avgTPS, blockInfoMap);
            return new CollectorData(avgTPS, blockInfoMap);
        });
    }
}
exports.StatCollector = StatCollector;

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
const axios_1 = __importDefault(require("axios"));
const cli_progress_1 = require("cli-progress");
const logger_1 = __importDefault(require("../logger/logger"));
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
class Batcher {
    // Generates batches of items based on the passed in
    // input set
    static generateBatches(items, batchSize) {
        const batches = [];
        // Find the required number of batches
        let numBatches = Math.ceil(items.length / batchSize);
        if (numBatches == 0) {
            numBatches = 1;
        }
        // Initialize empty batches
        for (let i = 0; i < numBatches; i++) {
            batches[i] = [];
        }
        let currentBatch = 0;
        for (const item of items) {
            batches[currentBatch].push(item);
            if (batches[currentBatch].length % batchSize == 0) {
                currentBatch++;
            }
        }
        return batches;
    }
    static batchTransactions(signedTxs, batchSize, url) {
        return __awaiter(this, void 0, void 0, function* () {
            // Generate the transaction hash batches
            const batches = Batcher.generateBatches(signedTxs, batchSize);
            const batchDelayMs = Number(process.env.PANDORAS_BATCH_DELAY_MS || 0);
            logger_1.default.info('Sending transactions in batches...');
            const batchBar = new cli_progress_1.SingleBar({
                barCompleteChar: '\u2588',
                barIncompleteChar: '\u2591',
                hideCursor: true,
            });
            batchBar.start(batches.length, 0, {
                speed: 'N/A',
            });
            const txHashes = [];
            const batchErrors = [];
            try {
                let nextIndx = 0;
                for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
                    const item = batches[batchIndex];
                    let singleRequests = '';
                    for (let i = 0; i < item.length; i++) {
                        singleRequests += JSON.stringify({
                            jsonrpc: '2.0',
                            method: 'eth_sendRawTransaction',
                            params: [item[i]],
                            id: nextIndx++,
                        });
                        if (i != item.length - 1) {
                            singleRequests += ',\n';
                        }
                    }
                    const response = yield (0, axios_1.default)({
                        url: url,
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        data: '[' + singleRequests + ']',
                    });
                    batchBar.increment();
                    const content = response.data;
                    for (const cnt of content) {
                        // eslint-disable-next-line no-prototype-builtins
                        if (cnt.hasOwnProperty('error')) {
                            // Error occurred during batch sends
                            batchErrors.push(cnt.error.message);
                            continue;
                        }
                        txHashes.push(cnt.result);
                    }
                    if (batchDelayMs > 0 && batchIndex < batches.length - 1) {
                        yield sleep(batchDelayMs);
                    }
                }
            }
            catch (e) {
                logger_1.default.error(e.message);
            }
            batchBar.stop();
            if (batchErrors.length > 0) {
                logger_1.default.warn('Errors encountered during batch sending:');
                for (const err of batchErrors) {
                    logger_1.default.error(err);
                }
            }
            logger_1.default.success(`${batches.length} ${batches.length > 1 ? 'batches' : 'batch'} sent`);
            return txHashes;
        });
    }
}
exports.default = Batcher;

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
exports.EngineContext = exports.Engine = void 0;
const logger_1 = __importDefault(require("../logger/logger"));
const batcher_1 = __importDefault(require("./batcher"));
const signer_1 = require("./signer");
class EngineContext {
    constructor(accountIndexes, numTxs, batchSize, mnemonic, url) {
        this.accountIndexes = accountIndexes;
        this.numTxs = numTxs;
        this.batchSize = batchSize;
        this.mnemonic = mnemonic;
        this.url = url;
    }
}
exports.EngineContext = EngineContext;
class Engine {
    static Run(runtime, ctx) {
        return __awaiter(this, void 0, void 0, function* () {
            // Initialize transaction signer
            const signer = new signer_1.Signer(ctx.mnemonic, ctx.url);
            // Get the account metadata
            const accounts = yield signer.getSenderAccounts(ctx.accountIndexes, ctx.numTxs);
            // Construct the transactions
            const rawTransactions = yield runtime.ConstructTransactions(accounts, ctx.numTxs);
            // Sign the transactions
            const signedTransactions = yield signer.signTransactions(accounts, rawTransactions);
            logger_1.default.title(runtime.GetStartMessage());
            // Send the transactions in batches
            return batcher_1.default.batchTransactions(signedTransactions, ctx.batchSize, ctx.url);
        });
    }
}
exports.Engine = Engine;
